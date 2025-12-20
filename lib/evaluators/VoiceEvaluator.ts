import { Chunk, ChunkType } from '../../interfaces/AgentTypes';
import { Evaluator } from '../core/Evaluator';
import { VoiceSettings } from '../../interfaces/VoiceConfig';
import { voiceEmitter } from '../voice-emitter';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

interface ParsedMarkdownItem {
  type: 'text' | 'quote' | 'bold' | 'emphasis' | 'code' | 'tool_call' | 'tool_result' | 'reasoning';
  content: string;
  start: number;
  end: number;
}

export class VoiceEvaluator extends Evaluator {
  readonly fqdn: string = 'evaluators.VoiceEvaluator';
  readonly supportedChunkTypes: ChunkType[] = [ChunkType.LlmOutput];
  private voiceSettings: VoiceSettings;
  private voiceQueue: { text: string; voiceFile: string; chunk?: Chunk; voiceItem?: any }[] = [];
  private isProcessingVoice: boolean = false;
  private voicesDirectory: string;
  private currentVoiceItems: Array<{
    type: string;
    content: string;
    filePath?: string;
    referenceVoiceFile?: string;
    status: 'generated' | 'failed' | 'skipped';
  }> = [];
  private pendingGenerations: number = 0;

  constructor(voiceConfig?: Partial<VoiceSettings>) {
    super();

    // Set up voices directory path relative to cwd, like ImageGenerationAgent
    this.voicesDirectory = join(process.cwd(), 'generated', 'voices');

    // Ensure directory exists
    if (!existsSync(this.voicesDirectory)) {
      mkdirSync(this.voicesDirectory, { recursive: true });
    }

    try {
      const settingsData = readFileSync('./voice-settings.json', 'utf-8');
      this.voiceSettings = JSON.parse(settingsData);
    } catch (e) {
      this.voiceSettings = {
        voices: {
          text: 'Robert.wav',
          quote: 'Robert.wav',
          bold: null,
          emphasis: null,
          code: null,
          tool_call: null,
          tool_result: null,
          reasoning: null
        },
        generation: {
          temperature: 0.8,
          exaggeration: 0.5,
          cfg_weight: 1.0,
          speed_factor: 1.0
        }
      };
    }
    if (voiceConfig) {
      // Merge voices
      if (voiceConfig.voices) {
        this.voiceSettings.voices = { ...this.voiceSettings.voices, ...voiceConfig.voices };
      }
      // Merge generation
      if (voiceConfig.generation) {
        this.voiceSettings.generation = { ...this.voiceSettings.generation, ...voiceConfig.generation };
      }
    }
  }

  async evaluate(chunk: Chunk): Promise<{ annotation?: any, annotations?: Record<string, any> }> {
    const parsedMarkdown = chunk.annotations?.['evaluators.MarkdownEvaluator']?.parsedMarkdown;
    if (!parsedMarkdown) {
      // If no markdown annotation, skip voice processing
      return {};
    }

    // Reset voice items and pending generations for this evaluation
    this.currentVoiceItems = [];
    this.pendingGenerations = 0;

    // Process all parsed markdown items and track their voice generation status
    for (const item of parsedMarkdown as ParsedMarkdownItem[]) {
      const voiceItem = {
        type: item.type,
        content: item.content,
        status: 'skipped' as const
      };
      this.currentVoiceItems.push(voiceItem);

      // Try to generate voice for this item
      this.handleVoice(item.type, item.content, chunk, voiceItem);
    }

    // Wait for all queued voices to be processed AND all HTTP requests to complete
    await this.waitForVoiceProcessing();

    return {
      annotation: {
        voiceGenerated: true,
        voiceItems: this.currentVoiceItems.map(item => ({
          ...item,
          filePath: item.filePath ? item.filePath.replace(process.cwd() + '/', '') : undefined
        }))
      }
    };
  }

  private async waitForVoiceProcessing(): Promise<void> {
    return new Promise((resolve) => {
      const checkQueue = () => {
        if (this.voiceQueue.length === 0 && !this.isProcessingVoice && this.pendingGenerations === 0) {
          resolve();
        } else {
          setTimeout(checkQueue, 10);
        }
      };
      checkQueue();
    });
  }

  private handleVoice(category: string, content: string, chunk?: Chunk, voiceItem?: any): void {
    const voiceFile = this.voiceSettings.voices[category as keyof typeof this.voiceSettings.voices];
    if (typeof voiceFile === 'string') {
      voiceItem.status = 'pending';
      voiceItem.referenceVoiceFile = voiceFile;
      this.voiceQueue.push({ text: content, voiceFile, chunk, voiceItem });
      this.processNextVoice();
    } else {
      voiceItem.status = 'skipped';
    }
  }

  private processNextVoice(): void {
    if (this.isProcessingVoice || this.voiceQueue.length === 0) return;
    this.isProcessingVoice = true;
    const { text, voiceFile, chunk, voiceItem } = this.voiceQueue.shift()!;
    this.pendingGenerations++;
    this.generateVoice(text, voiceFile, chunk, voiceItem).then(() => {
      this.pendingGenerations--;
      this.isProcessingVoice = false;
      this.processNextVoice();
    }).catch(() => {
      this.pendingGenerations--;
      if (voiceItem) {
        voiceItem.status = 'failed';
      }
      this.isProcessingVoice = false;
      this.processNextVoice();
    });
  }

  private async generateVoice(text: string, voiceFile: string, chunk?: Chunk, voiceItem?: any): Promise<void> {
    try {
      const body: any = {
        text: text,
        voice_mode: 'clone',
        reference_audio_filename: voiceFile,
        output_format: 'wav'
      };

      // Add optional settings if they exist
      if (typeof this.voiceSettings.generation.temperature === 'number') {
        body.temperature = this.voiceSettings.generation.temperature;
      }
      if (typeof this.voiceSettings.generation.exaggeration === 'number') {
        body.exaggeration = this.voiceSettings.generation.exaggeration;
      }
      if (typeof this.voiceSettings.generation.cfg_weight === 'number') {
        body.cfg_weight = this.voiceSettings.generation.cfg_weight;
      }
      if (typeof this.voiceSettings.generation.speed_factor === 'number') {
        body.speed_factor = this.voiceSettings.generation.speed_factor;
      }

      const response = await fetch('http://localhost:8000/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.error('Failed to generate voice:', response.statusText);
        return;
      }

      const audioBlob = await response.blob();
      const audioBuffer = await audioBlob.arrayBuffer();
      const audioArray = new Uint8Array(audioBuffer);

      // Generate filename similar to ImageGenerationAgent pattern
      // Use messageId if available, otherwise random UUID
      const messageId = chunk?.messageId || 'unknown';
      const evaluatorName = this.constructor.name;
      const now = new Date();
      const timeHHMMSS = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
      const filename = `${messageId}_${evaluatorName}_${timeHHMMSS}.wav`;
      const filePath = join(this.voicesDirectory, filename);

      // Save the file
      writeFileSync(filePath, audioArray);

      // Update voice item status
      if (voiceItem) {
        voiceItem.filePath = filePath;
        voiceItem.status = 'generated';
      }

      // Convert to base64 for frontend compatibility
      let binaryString = '';
      for (let i = 0; i < audioArray.length; i++) {
        binaryString += String.fromCharCode(audioArray[i]);
      }
      const base64Audio = btoa(binaryString);
      const audioDataUrl = `data:audio/wav;base64,${base64Audio}`;

      // Forward event to front-end with both file path and data URL
      voiceEmitter.emit('voice', { audioFilePath: filePath, audioDataUrl, text });
    } catch (error) {
      console.error('Error generating voice:', error);
      throw error; // Re-throw so the promise rejects
    }
  }


}