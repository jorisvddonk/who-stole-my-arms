import { MarkdownEventHandler } from "./markdown-parser.js";
import { voiceEmitter } from "./voice-emitter.js";
import { readFileSync } from "fs";

interface VoiceSettings {
  voices: { [key: string]: string | null };
  generation: { [key: string]: number };
}

export class ChatterboxVoiceEngine implements MarkdownEventHandler {
  private voiceSettings: VoiceSettings;
  private voiceQueue: { text: string; voiceFile: string }[] = [];
  private isProcessingVoice: boolean = false;

  constructor() {
    try {
      const settingsData = readFileSync('./voice-settings.json', 'utf-8');
      this.voiceSettings = JSON.parse(settingsData);
    } catch (e) {
      // Default settings if file not found
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
  }

  onText(text: string): void {
    this.handleVoice('text', text);
  }

  onQuote(content: string): void {
    this.handleVoice('quote', content);
  }

  onBold(content: string): void {
    this.handleVoice('bold', content);
  }

  onEmphasis(content: string): void {
    this.handleVoice('emphasis', content);
  }

  onCode(content: string): void {
    this.handleVoice('code', content);
  }

  onToolCall(toolCall: any): void {
    // Skip tool calls
  }

  onToolResult(toolResult: any): void {
    // Skip tool results
  }

  onReasoning(reasoning: string): void {
    this.handleVoice('reasoning', reasoning);
  }

  private handleVoice(category: string, content: string): void {
    const voiceFile = this.voiceSettings.voices[category];
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