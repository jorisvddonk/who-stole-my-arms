export interface LLMInvoke {
  generate(prompt: string): Promise<string>;
  generateStream(prompt: string): AsyncIterable<string>;
}