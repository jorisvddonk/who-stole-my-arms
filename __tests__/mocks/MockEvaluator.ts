import { EventEmitter } from 'node:events';
import { Evaluator } from '../../lib/core/Evaluator';
import { Chunk, ChunkType } from '../../interfaces/AgentTypes';

// Mock evaluator class
export class MockEvaluator extends Evaluator {
    public readonly fqdn = 'mock-evaluator';
    public readonly supportedChunkTypes = [ChunkType.LlmOutput];
    public eventEmitter = new EventEmitter();

    async evaluate(chunk: Chunk, arena: any, agent?: any): Promise<{annotation?: any, annotations?: Record<string, any>}> {
        return { annotation: { mock: true } };
    }
}