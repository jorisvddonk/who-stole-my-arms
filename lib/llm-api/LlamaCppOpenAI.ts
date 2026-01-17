import { NonStreamingLLMInvoke, StreamingLLMInvoke, LLMInfo, TokenUtils, GenerationControl } from '../interfaces/LLMInvoke.js';

interface LlamaCppSettings {
  baseUrl: string;
  model: string;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  stop: string[];
  repeatPenalty: number;
  presencePenalty: number;
  frequencyPenalty: number;
}

export class LlamaCppOpenAI implements NonStreamingLLMInvoke, StreamingLLMInvoke, LLMInfo, TokenUtils, GenerationControl {
  private baseUrl: string;
  private model: string;
  private settings: LlamaCppSettings;

  constructor(baseUrl: string = 'http://localhost:8080', model: string = 'llama-3.2-3b-instruct', settings?: Partial<LlamaCppSettings>) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.settings = {
      baseUrl,
      model,
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxTokens: 512,
      stop: ['<|tool_call_end|>', '<|agent_call_end|>', '<|error_end|>'],
      repeatPenalty: 1.0,
      presencePenalty: 0,
      frequencyPenalty: 0,
      ...settings
    };
  }

  updateSettings(newSettings: Partial<LlamaCppSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.baseUrl = this.settings.baseUrl;
    this.model = this.settings.model;
  }

  private async _callApi(endpoint: string, payload?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LlamaCpp error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async generate(prompt: string): Promise<string> {
    const response = await this._callApi('/v1/chat/completions', {
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: this.settings.temperature,
      top_p: this.settings.topP,
      max_tokens: this.settings.maxTokens,
      stop: this.settings.stop,
      repeat_penalty: this.settings.repeatPenalty,
      presence_penalty: this.settings.presencePenalty,
      frequency_penalty: this.settings.frequencyPenalty,
      stream: false
    });

    if (!response.choices || !response.choices[0]) {
      return '';
    }

    return response.choices[0].message?.content || '';
  }

  async *generateStream(prompt: string, sessionId?: string | null, abortSignal?: AbortSignal): AsyncIterable<{ token?: string; finishReason?: string }> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.settings.temperature,
        top_p: this.settings.topP,
        max_tokens: this.settings.maxTokens,
        stop: this.settings.stop,
        repeat_penalty: this.settings.repeatPenalty,
        presence_penalty: this.settings.presencePenalty,
        frequency_penalty: this.settings.frequencyPenalty,
        stream: true
      }),
      signal: abortSignal
    });

    if (!response.ok) {
      throw new Error(`LlamaCpp error: ${response.status}`);
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

        while (buffer.includes('\n\n')) {
          const messageEnd = buffer.indexOf('\n\n');
          const message = buffer.slice(0, messageEnd);
          buffer = buffer.slice(messageEnd + 2);

          for (const line of message.split('\n')) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (dataStr === '[DONE]') {
                return;
              }
              try {
                const data = JSON.parse(dataStr);
                if (data.choices && data.choices[0]) {
                  const choice = data.choices[0];
                  if (choice.delta && choice.delta.content) {
                    yield { token: choice.delta.content };
                  }
                  if (choice.finish_reason) {
                    yield { finishReason: choice.finish_reason };
                    return;
                  }
                }
              } catch {
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

  async getVersion(): Promise<any> {
    try {
      return await this._callApi('/v1/version');
    } catch {
      return { version: 'llama.cpp server' };
    }
  }

  async getModel(): Promise<string> {
    return this.model;
  }

  async getPerformanceStats(): Promise<any> {
    return null;
  }

  async getMaxContextLength(): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models/${this.model}`);
      if (response.ok) {
        const data = await response.json();
        return data?.context_length || 4096;
      }
    } catch {
      // ignore
    }
    return 4096;
  }

  async countTokens(text: string): Promise<{ count: number; tokens: number[] }> {
    const result = await this.tokenize(text);
    return { count: result.length, tokens: result };
  }

  async tokenize(text: string): Promise<number[]> {
    try {
      const response = await this._callApi('/v1/tokenize', { content: text });
      if (response.tokens && Array.isArray(response.tokens)) {
        return response.tokens.map((t: any) => t.id || t);
      }
    } catch {
      // ignore
    }
    return [];
  }

  async detokenize(tokenIds: number[]): Promise<string> {
    try {
      const response = await this._callApi('/v1/detokenize', { tokens: tokenIds });
      return response.content || response.text || '';
    } catch {
      return '';
    }
  }

  async abortGeneration(): Promise<boolean> {
    return false;
  }

  async checkGeneration(): Promise<string | null> {
    return null;
  }
}
