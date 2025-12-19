// Mock streaming LLM interface
export class MockStreamingLLM {
    async *generateStream(prompt: string): AsyncGenerator<{ token?: string; finishReason?: string }> {
        yield { token: 'Mock' };
        yield { token: ' response' };
        yield { finishReason: 'stop' };
    }

    // Legacy method for backward compatibility
    async *streamResponse(prompt: string): AsyncGenerator<string> {
        yield 'Mock response';
    }
}