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
    private evaluators: (Evaluator | Evaluator[])[] = [];
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

        this.evaluators = [];

        // TODO: Load dynamic evaluators if needed

        Logger.debugLog(`EvaluatorManager loaded evaluators: ${Object.keys(this.evaluators).join(', ')}`);
    }

    /**
     * Gets a copy of all loaded evaluators.
     * @returns Array of evaluators or evaluator groups.
     */
    getEvaluators(): (Evaluator | Evaluator[])[] {
        return [...this.evaluators];
    }

    /**
     * Gets the fqdns of all loaded evaluators.
     * @returns Array of evaluator fqdns.
     */
    getEvaluatorNames(): string[] {
        const flat = this.evaluators.flat();
        return flat.map(e => e.fqdn);
    }

    /**
     * Gets a specific evaluator by fqdn.
     * @param fqdn The fqdn of the evaluator to retrieve.
     * @returns The evaluator instance, or undefined if not found.
     */
    getEvaluator(fqdn: string): Evaluator | undefined {
        const flat = this.evaluators.flat();
        return flat.find(e => e.fqdn === fqdn);
    }
}