import { Chunk, ChunkType } from '../../interfaces/AgentTypes';
import { Evaluator } from '../core/Evaluator';

/**
 * Simple synchronous evaluator that applies a function to chunks.
 * Provides a lightweight way to add annotations without full agent complexity.
 */
export class SimpleEvaluator extends Evaluator {
    /** Fully qualified domain name for this evaluator */
    readonly fqdn: string;
    /** Array of chunk types that this evaluator can process */
    readonly supportedChunkTypes: ChunkType[];
    /** The evaluation function to apply to chunks */
    private evalFunction: (chunk: Chunk) => {annotation?: any, annotations?: Record<string, any>};

    /**
     * Creates a new SimpleEvaluator instance.
     * @param evalFunction The function to apply to chunks for evaluation.
     * @param supportedChunkTypes Array of chunk types this evaluator can process.
     * @param fqdn Optional FQDN override for this evaluator.
     */
    constructor(
        evalFunction: (chunk: Chunk) => {annotation?: any, annotations?: Record<string, any>},
        supportedChunkTypes: ChunkType[],
        fqdn?: string
    ) {
        super();
        this.evalFunction = evalFunction;
        this.supportedChunkTypes = supportedChunkTypes;
        this.fqdn = fqdn || `evaluators.${this.constructor.name}`;
    }

    /**
     * Evaluates a chunk by applying the configured evaluation function.
     * @param chunk The chunk to evaluate.
     * @param arena The arena context (not used by SimpleEvaluator).
     * @returns The result of applying the evaluation function to the chunk.
     */
    async evaluate(chunk: Chunk, arena: any): Promise<{annotation?: any, annotations?: Record<string, any>}> {
        return this.evalFunction(chunk);
    }
}