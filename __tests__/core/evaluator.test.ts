import { describe, test, expect, beforeEach } from 'bun:test';
import { Evaluator } from '../../lib/core/Evaluator';
import { Chunk, ChunkType } from '../../interfaces/AgentTypes';
import { setupTestEnv } from '../test-setup';

setupTestEnv();

// Concrete implementation for testing the abstract Evaluator class
class TestEvaluator extends Evaluator {
    public readonly fqdn = 'test.evaluator';
    public readonly supportedChunkTypes = [ChunkType.LlmOutput, ChunkType.Input];

    async evaluate(chunk: Chunk, arena: any, agent?: any): Promise<{annotation?: any, annotations?: Record<string, any>}> {
        if (chunk.type === ChunkType.LlmOutput) {
            return { annotation: { wordCount: chunk.content.split(' ').length } };
        }
        return {};
    }
}

describe('Evaluator', () => {
    let evaluator: TestEvaluator;

    beforeEach(() => {
        evaluator = new TestEvaluator();
    });

    describe('properties', () => {
        test('should have correct fqdn', () => {
            expect(evaluator.fqdn).toBe('test.evaluator');
        });

        test('should have correct supported chunk types', () => {
            expect(evaluator.supportedChunkTypes).toEqual([ChunkType.LlmOutput, ChunkType.Input]);
        });
    });

    describe('evaluate', () => {
        test('should evaluate LLM output chunks', async () => {
            const chunk = {
                type: ChunkType.LlmOutput,
                content: 'This is a test message',
                processed: false
            };

            const result = await evaluator.evaluate(chunk, null, null);

            expect(result).toEqual({
                annotation: { wordCount: 5 }
            });
        });

        test('should return empty result for unsupported chunk types', async () => {
            const chunk = {
                type: ChunkType.Data,
                content: 'test data',
                processed: false
            };

            const result = await evaluator.evaluate(chunk, null, null);

            expect(result).toEqual({});
        });

        test('should handle input chunks', async () => {
            const chunk = {
                type: ChunkType.Input,
                content: 'input data',
                processed: false
            };

            const result = await evaluator.evaluate(chunk, null, null);

            expect(result).toEqual({});
        });
    });

    describe('chunk type support', () => {
        test('should support LLM output chunks', () => {
            expect(evaluator.supportedChunkTypes).toContain(ChunkType.LlmOutput);
        });

        test('should support input chunks', () => {
            expect(evaluator.supportedChunkTypes).toContain(ChunkType.Input);
        });

        test('should not support tool output chunks by default', () => {
            expect(evaluator.supportedChunkTypes).not.toContain(ChunkType.ToolOutput);
        });
    });
});