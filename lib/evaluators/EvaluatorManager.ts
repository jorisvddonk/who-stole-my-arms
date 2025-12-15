import { ChunkType } from '../../interfaces/AgentTypes';
import { Evaluator } from '../core/Evaluator';
import { SimpleEvaluator } from './SimpleEvaluator';
import { AgentEvaluator } from './AgentEvaluator';
import { SentimentAgent } from '../agents/SentimentAgent';
import { Logger } from '../logging/debug-logger';

/**
 * Singleton manager for loading and managing evaluators.
 * Handles initialization and registration of evaluators that analyze chunks.
 */
export class EvaluatorManager {
    private static instance: EvaluatorManager;
    private evaluators: Record<string, Evaluator> = {};
    private initialized = false;

    /** Private constructor for singleton pattern */
    private constructor() {}

    /**
     * Gets the singleton instance of EvaluatorManager.
     * @returns The EvaluatorManager instance.
     */
    static getInstance(): EvaluatorManager {
        if (!EvaluatorManager.instance) {
            EvaluatorManager.instance = new EvaluatorManager();
        }
        return EvaluatorManager.instance;
    }

    /**
     * Initializes the evaluator manager by loading all available evaluators.
     * @param streamingLLM The streaming LLM interface to pass to agent-based evaluators.
     */
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

    /**
     * Gets a copy of all loaded evaluators.
     * @returns Record mapping evaluator names to evaluator instances.
     */
    getEvaluators(): Record<string, Evaluator> {
        return { ...this.evaluators };
    }

    /**
     * Gets the names of all loaded evaluators.
     * @returns Array of evaluator names.
     */
    getEvaluatorNames(): string[] {
        return Object.keys(this.evaluators);
    }

    /**
     * Gets a specific evaluator by name.
     * @param name The name of the evaluator to retrieve.
     * @returns The evaluator instance, or undefined if not found.
     */
    getEvaluator(name: string): Evaluator | undefined {
        return this.evaluators[name];
    }
}