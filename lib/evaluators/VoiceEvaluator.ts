import { Chunk, ChunkType } from '../../interfaces/AgentTypes';
import { Evaluator } from '../core/Evaluator';
import { VoiceSettings } from '../../interfaces/VoiceConfig';
import { voiceEmitter } from '../voice-emitter';
import { readFileSync } from 'fs';

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
  private voiceQueue: { text: string; voiceFile: string }[] = [];
  private isProcessingVoice: boolean = false;

  constructor(voiceConfig?: Partial<VoiceSettings>) {
    super();
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
      // If no annotation, skip
      return {};
    }
    for (const item of parsedMarkdown as ParsedMarkdownItem[]) {
      this.handleVoice(item.type, item.content);
    }
    // Wait for queue to process? But since async, maybe return immediately
    // For simplicity, process synchronously or return annotation
    return { annotation: { voiceGenerated: true } };
  }

  private handleVoice(category: string, content: string): void {
    const voiceFile = this.voiceSettings.voices[category as keyof typeof this.voiceSettings.voices];
    if (typeof voiceFile === 'string') {
      this.voiceQueue.push({ text: content, voiceFile });
      this.processNextVoice();
    }
  }

  private processNextVoice(): void {
    if (this.isProcessingVoice || this.voiceQueue.length === 0) return;
    this.isProcessingVoice = true;
    const { text, voiceFile } = this.voiceQueue.shift()!;
    this.generateVoice(text, voiceFile).then(() => {
      this.isProcessingVoice = false;
      this.processNextVoice();
    }).catch(() => {
      this.isProcessingVoice = false;
      this.processNextVoice();
    });
  }

  private async generateVoice(text: string, voiceFile: string): Promise<void> {
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
      let binaryString = '';
      for (let i = 0; i < audioArray.length; i++) {
        binaryString += String.fromCharCode(audioArray[i]);
      }
      const base64Audio = btoa(binaryString);
      const audioDataUrl = `data:audio/wav;base64,${base64Audio}`;

      // Forward event to front-end
      voiceEmitter.emit('voice', { audioDataUrl, text });
    } catch (error) {
      console.error('Error generating voice:', error);
    }
  }
}