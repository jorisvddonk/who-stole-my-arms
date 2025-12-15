/**
 * Interface for non-streaming LLM generation.
 */
export interface NonStreamingLLMInvoke {
  /** Generates a complete response for the given prompt */
  generate(prompt: string): Promise<string>;
}

/**
 * Interface for streaming LLM generation with tool support.
 */
export interface StreamingLLMInvoke {
  /**
   * Generates a streaming response for the given prompt.
   * @param prompt The prompt to generate from
   * @param sessionId Optional session identifier
   * @param abortSignal Optional signal to abort generation
   */
  generateStream(prompt: string, sessionId?: string | null, abortSignal?: AbortSignal): AsyncIterable<{ token?: string; finishReason?: string; tool_call?: any; tool_result?: any; reasoning?: string }>;
}

/**
 * Interface for retrieving information about an LLM.
 */
export interface LLMInfo {
  /** Gets version information about the LLM */
  getVersion(): Promise<any>;
  /** Gets the model name/identifier */
  getModel(): Promise<string>;
  /** Gets performance statistics */
  getPerformanceStats(): Promise<any>;
  /** Gets the maximum context length supported */
  getMaxContextLength(): Promise<number>;
}

/**
 * Interface for tokenization utilities.
 */
export interface TokenUtils {
  /** Counts tokens in text and returns token IDs */
  countTokens(text: string): Promise<{ count: number; tokens: number[] }>;
  /** Converts text to token IDs */
  tokenize(text: string): Promise<number[]>;
  /** Converts token IDs back to text */
  detokenize(tokenIds: number[]): Promise<string>;
}

/**
 * Interface for controlling LLM generation.
 */
export interface GenerationControl {
  /** Aborts the current generation */
  abortGeneration(): Promise<boolean>;
  /** Checks the status of current generation */
  checkGeneration(): Promise<string | null>;
}