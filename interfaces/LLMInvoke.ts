export interface NonStreamingLLMInvoke {
  generate(prompt: string): Promise<string>;
}

export interface StreamingLLMInvoke {
  generateStream(prompt: string): AsyncIterable<string>;
}