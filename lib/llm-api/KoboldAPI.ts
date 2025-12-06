import { NonStreamingLLMInvoke, StreamingLLMInvoke, LLMInfo, TokenUtils, GenerationControl } from '../interfaces/LLMInvoke.js';

export class KoboldAPI implements NonStreamingLLMInvoke, StreamingLLMInvoke, LLMInfo, TokenUtils, GenerationControl {
  private baseUrl: string;
  private genkey: string;

  constructor(baseUrl: string = 'http://localhost:5001') {
    this.baseUrl = baseUrl;
    this.genkey = `KCPP${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }

  private async _callApi(endpoint: string, payload?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined
    });

    if (!response.ok) {
      throw new Error(`Koboldcpp error: ${response.status}`);
    }

    return response.json();
  }

  private async _callApiGet(endpoint: string): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Koboldcpp error: ${response.status}`);
    }

    return response.json();
  }

  async generate(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/v1/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        max_length: 100,
        genkey: this.genkey,
      })
    });

    if (!response.ok) {
      throw new Error(`Koboldcpp error: ${response.status}`);
    }

    const data = await response.json();
    return data.results ? data.results[0].text : '';
  }

  async *generateStream(prompt: string): AsyncIterable<string> {
    const response = await fetch(`${this.baseUrl}/api/extra/generate/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        max_length: 100,
        genkey: this.genkey,
      })
    });

    if (!response.ok) {
      throw new Error(`Koboldcpp error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        while (buffer.includes('\n\n')) {
          const messageEnd = buffer.indexOf('\n\n');
          const message = buffer.slice(0, messageEnd);
          buffer = buffer.slice(messageEnd + 2);

          for (const line of message.split('\n')) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.token) {
                  yield data.token;
                }
                if (data.finish_reason && (data.finish_reason === 'length' || data.finish_reason === 'stop')) {
                  return;
                }
              } catch (e) {
                // Skip malformed JSON
                continue;
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // Info and utility methods
  async getVersion(): Promise<any> {
    return this._callApiGet('/api/extra/version');
  }

  async getModel(): Promise<string> {
    const result = await this._callApiGet('/api/v1/model');
    return result.result;
  }

  async getPerformanceStats(): Promise<any> {
    return this._callApiGet('/api/extra/perf');
  }

  async getMaxContextLength(): Promise<number> {
    const result = await this._callApiGet('/api/extra/true_max_context_length');
    return result.value;
  }

  async countTokens(text: string): Promise<{ count: number; tokens: number[] }> {
    const result = await this._callApi('/api/extra/tokencount', { prompt: text });
    return {
      count: result.value,
      tokens: result.ids
    };
  }

  async tokenize(text: string): Promise<number[]> {
    const result = await this._callApi('/api/extra/tokenize', { prompt: text });
    return result.ids;
  }

  async detokenize(tokenIds: number[]): Promise<string> {
    const result = await this._callApi('/api/extra/detokenize', { ids: tokenIds });
    return result.result;
  }

  async abortGeneration(): Promise<boolean> {
    try {
      await this._callApi('/api/extra/abort', { genkey: this.genkey });
      return true;
    } catch {
      return false;
    }
  }

  async checkGeneration(): Promise<string | null> {
    try {
      const result = await this._callApi('/api/extra/generate/check', { genkey: this.genkey });
      return result.results[0].text;
    } catch {
      return null;
    }
  }
}