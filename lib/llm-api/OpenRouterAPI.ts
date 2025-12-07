import { NonStreamingLLMInvoke, StreamingLLMInvoke, LLMInfo, TokenUtils, GenerationControl } from '../interfaces/LLMInvoke.js';

interface OpenRouterSettings {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  enableReasoning: boolean;
}

export class OpenRouterAPI implements NonStreamingLLMInvoke, StreamingLLMInvoke, LLMInfo, TokenUtils, GenerationControl {
  private apiKey: string;
  private model: string;
  private settings: OpenRouterSettings;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string, model: string = 'tngtech/tng-r1t-chimera:free', settings?: Partial<OpenRouterSettings>) {
    console.log('[OpenRouter] Constructor called with model:', model);
    this.apiKey = apiKey;
    this.model = model;
    this.settings = {
      apiKey,
      model,
      maxTokens: 100,
      temperature: 0.7,
      topP: 0.9,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      enableReasoning: true,
      ...settings
    };
    console.log('[OpenRouter] Initialized with settings:', {...this.settings, ...{apiKey: "<hidden>"}});
  }

  updateSettings(newSettings: Partial<OpenRouterSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.apiKey = this.settings.apiKey;
    this.model = this.settings.model;
  }

  private async _callApi(endpoint: string, payload?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    console.log('[OpenRouter] API call:', { url, method: 'POST', hasPayload: !!payload });
    if (payload) {
      console.log('[OpenRouter] Payload:', JSON.stringify(payload, null, 2));
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: payload ? JSON.stringify(payload) : undefined
    });

    console.log('[OpenRouter] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OpenRouter] Error response:', errorText);
      throw new Error(`OpenRouter error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[OpenRouter] Response data keys:', Object.keys(data));
    return data;
  }

  private async _callApiGet(endpoint: string): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`OpenRouter error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async generate(prompt: string): Promise<string> {
    console.log('[OpenRouter] NON-STREAMING generate called with prompt length:', prompt.length);

    const payload: any = {
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: this.settings.maxTokens,
      temperature: this.settings.temperature,
      top_p: this.settings.topP,
      frequency_penalty: this.settings.frequencyPenalty,
      presence_penalty: this.settings.presencePenalty,
      stream: false
    };

    if (this.settings.enableReasoning) {
      payload.reasoning = { effort: 'medium' };
    } else {
      payload.reasoning = { exclude: true };
    }

    console.log('[OpenRouter] Generate request:', { model: this.model, promptLength: prompt.length });
    const response = await this._callApi('/chat/completions', payload);
    console.log('[OpenRouter] Generate response keys:', Object.keys(response));

    if (!response.choices || !response.choices[0]) {
      console.error('[OpenRouter] No choices in response');
      return '';
    }

    const text = response.choices[0].message?.content || '';
    console.log('[OpenRouter] Generated text:', text.substring(0, 100), '...');
    console.log('[OpenRouter] Generated text length:', text.length);
    return text;
  }

  async *generateStream(prompt: string, sessionId?: string | null, abortSignal?: AbortSignal): AsyncIterable<{ token?: string; finishReason?: string }> {
    console.log('[OpenRouter] generateStream called with prompt length:', prompt.length);

    const payload: any = {
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: this.settings.maxTokens,
      temperature: this.settings.temperature,
      top_p: this.settings.topP,
      frequency_penalty: this.settings.frequencyPenalty,
      presence_penalty: this.settings.presencePenalty,
      stream: true
    };

    if (this.settings.enableReasoning) {
      payload.reasoning = { effort: 'medium' };
    } else {
      payload.reasoning = { exclude: true };
    }

    console.log('[OpenRouter] Making streaming API call to /chat/completions');
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: abortSignal
    });

    if (!response.ok) {
      throw new Error(`OpenRouter error: ${response.status} ${response.statusText}`);
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
              const dataStr = line.slice(6);
              if (dataStr === '[DONE]') {
                return;
              }
               try {
                 const data = JSON.parse(dataStr);
                  if (data.choices && data.choices[0]) {
                    const choice = data.choices[0];
                    // console.log('[OpenRouter] Stream chunk:', JSON.stringify(choice, null, 2));
                    if (choice.delta) {
                      if (choice.delta.content) {
                        // console.log('[OpenRouter] Yielding token:', choice.delta.content);
                        yield { token: choice.delta.content };
                      }
                      if (choice.delta.reasoning_details) {
                        // Handle reasoning details
                        for (const detail of choice.delta.reasoning_details) {
                          if (detail.type === 'reasoning.text' && detail.text) {
                            // console.log('[OpenRouter] Yielding reasoning:', detail.text);
                            yield { reasoning: detail.text } as any;
                          } else if (detail.type === 'reasoning.summary' && detail.summary) {
                            console.log('[OpenRouter] Yielding reasoning summary:', detail.summary);
                            yield { reasoning: detail.summary } as any;
                          }
                          // Handle other types if needed
                        }
                      }
                    }
                    if (choice.finish_reason) {
                      console.log('[OpenRouter] Finish reason:', choice.finish_reason);
                      yield { finishReason: choice.finish_reason };
                      return;
                    }
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
    // OpenRouter doesn't have a version endpoint, return a placeholder
    return { version: 'OpenRouter API' };
  }

  async getModel(): Promise<string> {
    return this.model;
  }

  async getPerformanceStats(): Promise<any> {
    // OpenRouter doesn't provide performance stats
    return null;
  }

  async getMaxContextLength(): Promise<number> {
    try {
      const models = await this._callApiGet('/models');
      const modelInfo = models.data.find((m: any) => m.id === this.model);
      return modelInfo ? modelInfo.context_length : 4096; // Default fallback
    } catch {
      return 4096; // Fallback
    }
  }

  async countTokens(text: string): Promise<{ count: number; tokens: number[] }> {
    // Approximate token count (rough estimate: 1 token ≈ 4 characters)
    const count = Math.ceil(text.length / 4);
    const tokens = Array.from({ length: count }, (_, i) => i);
    return { count, tokens };
  }

  async tokenize(text: string): Promise<number[]> {
    // Approximate tokenization
    const count = Math.ceil(text.length / 4);
    return Array.from({ length: count }, (_, i) => i);
  }

  async detokenize(tokenIds: number[]): Promise<string> {
    // Since we can't really detokenize without proper tokenizer, return a placeholder
    throw new Error('Detokenization not supported for OpenRouter API');
  }

  async abortGeneration(): Promise<boolean> {
    // OpenRouter doesn't support aborting generations
    return false;
  }

  async checkGeneration(): Promise<string | null> {
    // OpenRouter doesn't support checking generation status
    return null;
  }
}