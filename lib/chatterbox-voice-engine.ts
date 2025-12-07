import { MarkdownEventHandler } from "./markdown-parser.js";
import { voiceEmitter } from "./voice-emitter.js";

export class ChatterboxVoiceEngine implements MarkdownEventHandler {
  private quoteQueue: string[] = [];
  private isProcessingVoice: boolean = false;

  onText(text: string): void {
    // No action for text
  }

  onQuote(content: string): void {
    this.quoteQueue.push(content);
    this.processNextQuote();
  }

  private processNextQuote(): void {
    if (this.isProcessingVoice || this.quoteQueue.length === 0) return;
    this.isProcessingVoice = true;
    const text = this.quoteQueue.shift()!;
    this.generateVoice(text).then(() => {
      this.isProcessingVoice = false;
      this.processNextQuote();
    }).catch(() => {
      this.isProcessingVoice = false;
      this.processNextQuote();
    });
  }

  onBold(content: string): void {
    // No action for bold
  }

  onEmphasis(content: string): void {
    // No action for emphasis
  }

  onCode(content: string): void {
    // No action for code
  }

  onToolCall(toolCall: any): void {
    // No action for tool call
  }

  onToolResult(toolResult: any): void {
    // No action for tool result
  }

  onReasoning(reasoning: string): void {
    // No action for reasoning
  }

  private async generateVoice(text: string): Promise<void> {
    try {
      const response = await fetch('http://localhost:8000/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice_mode: 'clone',
          reference_audio_filename: 'Robert.wav',
          output_format: 'wav'
        }),
      });

      if (!response.ok) {
        console.error('Failed to generate voice:', response.statusText);
        return;
      }

      const audioBlob = await response.blob();
      const audioBuffer = await audioBlob.arrayBuffer();
      const audioArray = new Uint8Array(audioBuffer);
      const base64Audio = btoa(String.fromCharCode(...audioArray));
      const audioDataUrl = `data:audio/wav;base64,${base64Audio}`;

      // Forward event to front-end
      voiceEmitter.emit('voice', { audioDataUrl, text });
    } catch (error) {
      console.error('Error generating voice:', error);
    }
  }
}