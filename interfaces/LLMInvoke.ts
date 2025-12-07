export interface NonStreamingLLMInvoke {
  generate(prompt: string): Promise<string>;
}

export interface StreamingLLMInvoke {
  generateStream(prompt: string, sessionId?: string | null, abortSignal?: AbortSignal): AsyncIterable<{ token?: string; finishReason?: string; tool_call?: any; tool_result?: any; reasoning?: string }>;
}

export interface LLMInfo {
  getVersion(): Promise<any>;
  getModel(): Promise<string>;
  getPerformanceStats(): Promise<any>;
  getMaxContextLength(): Promise<number>;
}

export interface TokenUtils {
  countTokens(text: string): Promise<{ count: number; tokens: number[] }>;
  tokenize(text: string): Promise<number[]>;
  detokenize(tokenIds: number[]): Promise<string>;
}

export interface GenerationControl {
  abortGeneration(): Promise<boolean>;
  checkGeneration(): Promise<string | null>;
}