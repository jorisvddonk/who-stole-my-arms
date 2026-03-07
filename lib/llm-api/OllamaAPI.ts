import { NonStreamingLLMInvoke, StreamingLLMInvoke, LLMInfo, TokenUtils, GenerationControl } from '../../interfaces/LLMInvoke.js';

interface OllamaSettings {
  baseUrl: string;
  model: string;
  temperature: number;
  topP: number;
  topK: number;
  numCtx: number;
  numGPU: number;
  numThread: number;
  repeatPenalty: number;
  repeatLastN: number;
  seed: number;
  stop: string[];
  format: string;
}

export class OllamaAPI implements NonStreamingLLMInvoke, StreamingLLMInvoke, LLMInfo, TokenUtils, GenerationControl {
  private baseUrl: string;
  private model: string;
  private settings: OllamaSettings;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'gemma3:1b', settings?: Partial<OllamaSettings>) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.settings = {
      baseUrl,
      model,
      temperature: 0.8,
      topP: 0.9,
      topK: 40,
      numCtx: 4096,
      numGPU: 0,
      numThread: 0,
      repeatPenalty: 1.1,
      repeatLastN: 64,
      seed: -1,
      stop: [],
      format: ''
    };
  }

  updateSettings(newSettings: Partial<OllamaSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.baseUrl = this.settings.baseUrl;
    this.model = this.settings.model;
  }

  async _callApi(endpoint: string, payload?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    return response.json();
  }

  async _callApiGet(endpoint: string): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    return response.json();
  }

  async generate(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: this.settings.temperature,
          top_p: this.settings.topP,
          top_k: this.settings.topK,
          num_ctx: this.settings.numCtx,
          num_gpu: this.settings.numGPU,
          num_thread: this.settings.numThread,
          repeat_penalty: this.settings.repeatPenalty,
          repeat_last_n: this.settings.repeatLastN,
          seed: this.settings.seed,
          stop: this.settings.stop
        },
        format: this.settings.format || undefined
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  async *generateStream(prompt: string, sessionId?: string | null, abortSignal?: AbortSignal): AsyncIterable<{ token?: string; finishReason?: string }> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: prompt,
        stream: true,
        options: {
          temperature: this.settings.temperature,
          top_p: this.settings.topP,
          top_k: this.settings.topK,
          num_ctx: this.settings.numCtx,
          num_gpu: this.settings.numGPU,
          num_thread: this.settings.numThread,
          repeat_penalty: this.settings.repeatPenalty,
          repeat_last_n: this.settings.repeatLastN,
          seed: this.settings.seed,
          stop: this.settings.stop
        },
        format: this.settings.format || undefined
      }),
      signal: abortSignal
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
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

        while (buffer.includes('\n')) {
          const lineEnd = buffer.indexOf('\n');
          if (lineEnd === -1) break;
          
          const line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 1);

          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                yield { token: data.response };
              }
              if (data.done) {
                yield { finishReason: data.stop_reason || 'stop' };
                return;
              }
            } catch (e) {
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async getVersion(): Promise<any> {
    return this._callApiGet('/api/version');
  }

  async getModel(): Promise<string> {
    return this.model;
  }

  async getPerformanceStats(): Promise<any> {
    return null;
  }

  async getMaxContextLength(): Promise<number> {
    return this.settings.numCtx;
  }

  async countTokens(text: string): Promise<{ count: number; tokens: number[] }> {
    const result = await this._callApi('/api/tokenize', { 
      content: text,
      model: this.model 
    });
    return {
      count: result.tokens.length,
      tokens: result.tokens
    };
  }

  async tokenize(text: string): Promise<number[]> {
    const result = await this._callApi('/api/tokenize', { 
      content: text,
      model: this.model 
    });
    return result.tokens;
  }

  async detokenize(tokenIds: number[]): Promise<string> {
    const result = await this._callApi('/api/detokenize', { 
      tokens: tokenIds,
      model: this.model 
    });
    return result.content;
  }

  async abortGeneration(): Promise<boolean> {
    try {
      await this._callApi('/api/generate', { model: this.model, prompt: '', abort: true });
      return true;
    } catch {
      return false;
    }
  }

  async checkGeneration(): Promise<string | null> {
    return null;
  }

  async listModels(): Promise<any> {
    return this._callApiGet('/api/tags');
  }
}
