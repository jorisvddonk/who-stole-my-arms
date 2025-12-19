import { describe, test, expect, beforeEach } from 'bun:test';
import { EvaluatorManager } from '../../lib/evaluators/EvaluatorManager';
import { Evaluator } from '../../lib/core/Evaluator';
import { ChunkType } from '../../interfaces/AgentTypes';
import { MockStreamingLLM } from '../mocks/MockStreamingLLM';

// Mock evaluator for testing
class MockTestEvaluator extends Evaluator {
    public readonly fqdn = 'test.mock.evaluator';
    public readonly supportedChunkTypes = [ChunkType.LlmOutput];

    async evaluate(chunk: any, arena: any, agent?: any): Promise<{annotation?: any, annotations?: Record<string, any>}> {
        return { annotation: { test: true } };
    }
}

describe('EvaluatorManager', () => {
    let streamingLLM: MockStreamingLLM;
    let evaluatorManager: EvaluatorManager;

    beforeEach(() => {
        streamingLLM = new MockStreamingLLM();
        // Reset singleton instance
        (EvaluatorManager as any).instance = undefined;
        evaluatorManager = EvaluatorManager.getInstance();
    });

    describe('getInstance', () => {
        test('should return singleton instance', () => {
            const instance1 = EvaluatorManager.getInstance();
            const instance2 = EvaluatorManager.getInstance();

            expect(instance1).toBe(instance2);
            expect(instance1).toBeInstanceOf(EvaluatorManager);
        });
    });

    describe('init', () => {
        test('should initialize without loading evaluators', () => {
            evaluatorManager.init(streamingLLM);

            const evaluators = evaluatorManager.getEvaluators();
            expect(evaluators).toEqual([]);
        });

        test('should not reinitialize if already initialized', () => {
            evaluatorManager.init(streamingLLM);

            // Manually add an evaluator to test that it doesn't get cleared
            (evaluatorManager as any).evaluators.push(new MockTestEvaluator());

            evaluatorManager.init(streamingLLM);

            // Should still have the evaluator
            expect(evaluatorManager.getEvaluators().length).toBe(1);
        });
    });

    describe('getEvaluators', () => {
        test('should return copy of evaluators array', () => {
            const evaluators1 = evaluatorManager.getEvaluators();
            const evaluators2 = evaluatorManager.getEvaluators();

            expect(evaluators1).toEqual(evaluators2);
            expect(evaluators1).not.toBe(evaluators2); // Should be different objects
        });

        test('should handle evaluator groups', () => {
            // Manually add evaluators including a group
            (evaluatorManager as any).evaluators = [
                new MockTestEvaluator(),
                [new MockTestEvaluator(), new MockTestEvaluator()]
            ];

            const evaluators = evaluatorManager.getEvaluators();

            expect(evaluators.length).toBe(2);
            expect(evaluators[0]).toBeInstanceOf(MockTestEvaluator);
            expect(Array.isArray(evaluators[1])).toBe(true);
            expect(evaluators[1].length).toBe(2);
        });
    });

    describe('getEvaluatorNames', () => {
        test('should return fqdns of all evaluators', () => {
            // Manually add evaluators
            (evaluatorManager as any).evaluators = [
                new MockTestEvaluator(),
                [new MockTestEvaluator(), new MockTestEvaluator()]
            ];

            const names = evaluatorManager.getEvaluatorNames();

            expect(names).toEqual([
                'test.mock.evaluator',
                'test.mock.evaluator',
                'test.mock.evaluator'
            ]);
        });

        test('should return empty array when no evaluators', () => {
            const names = evaluatorManager.getEvaluatorNames();

            expect(names).toEqual([]);
        });
    });

    describe('getEvaluator', () => {
        test('should return evaluator by fqdn', () => {
            const evaluator = new MockTestEvaluator();
            (evaluatorManager as any).evaluators = [evaluator];

            const found = evaluatorManager.getEvaluator('test.mock.evaluator');

            expect(found).toBe(evaluator);
        });

        test('should return evaluator from group by fqdn', () => {
            const evaluator = new MockTestEvaluator();
            (evaluatorManager as any).evaluators = [[evaluator]];

            const found = evaluatorManager.getEvaluator('test.mock.evaluator');

            expect(found).toBe(evaluator);
        });

        test('should return undefined for non-existent fqdn', () => {
            const evaluator = new MockTestEvaluator();
            (evaluatorManager as any).evaluators = [evaluator];

            const found = evaluatorManager.getEvaluator('non.existent.evaluator');

            expect(found).toBeUndefined();
        });
    });
});