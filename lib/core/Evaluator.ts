import { Chunk, ChunkType } from '../../interfaces/AgentTypes';

/**
 * Abstract base class for evaluators that analyze and annotate chunks.
 * Evaluators automatically process chunks as they are emitted and add metadata.
 */
export abstract class Evaluator {
    /**
     * Fully qualified domain name for this evaluator, used as a key in chunk annotations.
     */
    abstract readonly fqdn: string;

    /**
     * Array of chunk types that this evaluator can process.
     */
    abstract readonly supportedChunkTypes: ChunkType[];

    /**
     * Evaluates a chunk and returns annotations to add to it.
     * @param chunk The chunk to evaluate.
     * @param arena The arena context containing evaluators and data.
     * @returns Promise resolving to annotation data or multiple annotations.
     */
    abstract evaluate(chunk: Chunk, arena: any): Promise<{annotation?: any, annotations?: Record<string, any>}>;
}