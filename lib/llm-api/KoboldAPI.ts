import { NonStreamingLLMInvoke, StreamingLLMInvoke, LLMInfo, TokenUtils, GenerationControl } from '../interfaces/LLMInvoke.js';

interface KoboldSettings {
  baseUrl: string;
  n: number;
  maxContextLength: number;
  maxLength: number;
  repetitionPenalty: number;
  temperature: number;
  topP: number;
  topK: number;
  topA: number;
  typical: number;
  tfs: number;
  repPenRange: number;
  repPenSlope: number;
  samplerOrder: number[];
  memory: string;
  trimStop: boolean;
  minP: number;
  dynatempRange: number;
  dynatempExponent: number;
  smoothingFactor: number;
  nsigma: number;
  bannedTokens: number[];
  renderSpecial: boolean;
  logprobs: boolean;
  replaceInstructPlaceholders: boolean;
  presencePenalty: number;
  logitBias: Record<string, number>;
  stopSequence: string[];
  useDefaultBadwordsids: boolean;
  bypassEos: boolean;
}

/**
 * KoboldAI API client that implements multiple LLM interfaces.
 * Provides access to KoboldAI-compatible LLM servers with streaming and non-streaming support.
 */
export class KoboldAPI implements NonStreamingLLMInvoke, StreamingLLMInvoke, LLMInfo, TokenUtils, GenerationControl {
  private baseUrl: string;
  private genkey: string;
  private settings: KoboldSettings;

  /**
   * Creates a new KoboldAPI instance.
   * @param baseUrl The base URL of the KoboldAI server
   * @param settings Optional settings to override defaults
   */
  constructor(baseUrl: string = 'http://localhost:5001', settings?: Partial<KoboldSettings>) {
    this.baseUrl = baseUrl;
    this.genkey = `KCPP${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    this.settings = {
      baseUrl,
      n: 1,
      maxContextLength: 10240,
      maxLength: 500,
      repetitionPenalty: 1.05,
      temperature: 0.75,
      topP: 0.92,
      topK: 100,
      topA: 0,
      typical: 1,
      tfs: 1,
      repPenRange: 360,
      repPenSlope: 0.7,
      samplerOrder: [6, 0, 1, 3, 4, 2, 5],
      memory: '',
      trimStop: false,
      minP: 0,
      dynatempRange: 0,
      dynatempExponent: 1,
      smoothingFactor: 0,
      nsigma: 0,
      bannedTokens: [],
      renderSpecial: false,
      logprobs: false,
      replaceInstructPlaceholders: true,
      presencePenalty: 0,
      logitBias: {},
       stopSequence: ['{{[INPUT]}}', '{{[OUTPUT]}}', '<|tool_call_end|>', '<|agent_call_end|>', '<|error_end|>'],
      useDefaultBadwordsids: false,
      bypassEos: false,
      ...settings
    };
  }

  updateSettings(newSettings: Partial<KoboldSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.baseUrl = this.settings.baseUrl;
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
        n: this.settings.n,
        max_context_length: this.settings.maxContextLength,
        max_length: this.settings.maxLength,
        rep_pen: this.settings.repetitionPenalty,
        temperature: this.settings.temperature,
        top_p: this.settings.topP,
        top_k: this.settings.topK,
        top_a: this.settings.topA,
        typical: this.settings.typical,
        tfs: this.settings.tfs,
        rep_pen_range: this.settings.repPenRange,
        rep_pen_slope: this.settings.repPenSlope,
        sampler_order: this.settings.samplerOrder,
        memory: this.settings.memory,
        trim_stop: this.settings.trimStop,
        genkey: this.genkey,
        min_p: this.settings.minP,
        dynatemp_range: this.settings.dynatempRange,
        dynatemp_exponent: this.settings.dynatempExponent,
        smoothing_factor: this.settings.smoothingFactor,
        nsigma: this.settings.nsigma,
        banned_tokens: this.settings.bannedTokens,
        render_special: this.settings.renderSpecial,
        logprobs: this.settings.logprobs,
        replace_instruct_placeholders: this.settings.replaceInstructPlaceholders,
        presence_penalty: this.settings.presencePenalty,
        logit_bias: this.settings.logitBias,
        stop_sequence: this.settings.stopSequence,
        use_default_badwordsids: this.settings.useDefaultBadwordsids,
        bypass_eos: this.settings.bypassEos,
      })
    });

    if (!response.ok) {
      throw new Error(`Koboldcpp error: ${response.status}`);
    }

    const data = await response.json();
    return data.results ? data.results[0].text : '';
  }

  async *generateStream(prompt: string, sessionId?: string | null, abortSignal?: AbortSignal): AsyncIterable<{ token?: string; finishReason?: string }> {
    const response = await fetch(`${this.baseUrl}/api/extra/generate/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        n: this.settings.n,
        max_context_length: this.settings.maxContextLength,
        max_length: this.settings.maxLength,
        rep_pen: this.settings.repetitionPenalty,
        temperature: this.settings.temperature,
        top_p: this.settings.topP,
        top_k: this.settings.topK,
        top_a: this.settings.topA,
        typical: this.settings.typical,
        tfs: this.settings.tfs,
        rep_pen_range: this.settings.repPenRange,
        rep_pen_slope: this.settings.repPenSlope,
        sampler_order: this.settings.samplerOrder,
        memory: this.settings.memory,
        trim_stop: this.settings.trimStop,
        genkey: this.genkey,
        min_p: this.settings.minP,
        dynatemp_range: this.settings.dynatempRange,
        dynatemp_exponent: this.settings.dynatempExponent,
        smoothing_factor: this.settings.smoothingFactor,
        nsigma: this.settings.nsigma,
        banned_tokens: this.settings.bannedTokens,
        render_special: this.settings.renderSpecial,
        logprobs: this.settings.logprobs,
        replace_instruct_placeholders: this.settings.replaceInstructPlaceholders,
        presence_penalty: this.settings.presencePenalty,
        logit_bias: this.settings.logitBias,
        stop_sequence: this.settings.stopSequence,
        use_default_badwordsids: this.settings.useDefaultBadwordsids,
        bypass_eos: this.settings.bypassEos,
      }),
      signal: abortSignal
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
                  yield { token: data.token };
                }
                if (data.finish_reason) {
                  yield { finishReason: data.finish_reason };
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