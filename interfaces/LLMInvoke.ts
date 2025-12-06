export interface LLMInvoke {
  generate(prompt: string): Promise<string>;
}