// Mock streaming LLM interface
export class MockStreamingLLM {
    async *streamResponse(prompt: string): AsyncGenerator<string> {
        yield 'Mock response';
    }
}