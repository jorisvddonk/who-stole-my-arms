import { Chunk, ChunkType } from '../../interfaces/AgentTypes';
import { Evaluator } from '../core/Evaluator';

export class SimpleEvaluator extends Evaluator {
    readonly fqdn: string;
    readonly supportedChunkTypes: ChunkType[];
    private evalFunction: (chunk: Chunk) => {annotation?: any, annotations?: Record<string, any>};

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

    async evaluate(chunk: Chunk, arena: any): Promise<{annotation?: any, annotations?: Record<string, any>}> {
        return this.evalFunction(chunk);
    }
}