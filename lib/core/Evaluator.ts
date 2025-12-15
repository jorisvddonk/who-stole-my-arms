import { Chunk, ChunkType } from './LLMAgent';

export abstract class Evaluator {
    abstract readonly fqdn: string;
    abstract readonly supportedChunkTypes: ChunkType[];
    abstract evaluate(chunk: Chunk, arena: any): Promise<{annotation?: any, annotations?: Record<string, any>}>;
}