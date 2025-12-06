import { LLMInvoke } from '../interfaces/LLMInvoke.js';

export class KoboldAPI implements LLMInvoke {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:5001') {
    this.baseUrl = baseUrl;
  }

  async generate(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/v1/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        max_length: 100,
      })
    });

    if (!response.ok) {
      throw new Error(`Koboldcpp error: ${response.status}`);
    }

    const data = await response.json();
    return data.results ? data.results[0].text : '';
  }
}