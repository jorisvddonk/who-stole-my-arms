import { ChunkType } from '../core/LLMAgent';
import { Evaluator } from '../core/Evaluator';
import { SimpleEvaluator } from './SimpleEvaluator';
import { AgentEvaluator } from './AgentEvaluator';
import { SentimentAgent } from '../agents/SentimentAgent';
import { Logger } from '../logging/debug-logger';

export class EvaluatorManager {
    private static instance: EvaluatorManager;
    private evaluators: Record<string, Evaluator> = {};
    private initialized = false;

    private constructor() {}

    static getInstance(): EvaluatorManager {
        if (!EvaluatorManager.instance) {
            EvaluatorManager.instance = new EvaluatorManager();
        }
        return EvaluatorManager.instance;
    }

    init(streamingLLM: any): void {
        if (this.initialized) return;
        this.initialized = true;

        Logger.debugLog('Initializing EvaluatorManager');

        // Load hardcoded evaluators
        this.evaluators = {
            'LengthEvaluator': new SimpleEvaluator(
                (chunk) => ({
                    annotation: {
                        chars: chunk.content.length,
                        words: chunk.content.split(/\s+/).filter(w => w.length > 0).length
                    }
                }),
                [ChunkType.Input, ChunkType.LlmOutput, ChunkType.ToolOutput, ChunkType.AgentOutput],
                'evaluators.LengthEvaluator'
            ),
            'TypeEvaluator': new SimpleEvaluator(
                (chunk) => ({
                    annotation: {
                        type: chunk.type,
                        timestamp: Date.now(),
                        processed: chunk.processed
                    }
                }),
                [ChunkType.Input, ChunkType.LlmOutput, ChunkType.ToolOutput, ChunkType.AgentOutput],
                'evaluators.TypeEvaluator'
            ),
            'SentimentEvaluator': new AgentEvaluator(
                SentimentAgent,
                streamingLLM,
                [ChunkType.Input],
                'evaluators.SentimentEvaluator'
            )
        };

        // TODO: Load dynamic evaluators if needed

        Logger.debugLog(`EvaluatorManager loaded evaluators: ${Object.keys(this.evaluators).join(', ')}`);
    }

    getEvaluators(): Record<string, Evaluator> {
        return { ...this.evaluators };
    }

    getEvaluatorNames(): string[] {
        return Object.keys(this.evaluators);
    }

    getEvaluator(name: string): Evaluator | undefined {
        return this.evaluators[name];
    }
}