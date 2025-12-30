import { LLMAgent } from '../core/LLMAgent';
import { Task } from '../../interfaces/AgentTypes';

/**
 * Example agent that always throws an error for testing evaluator error handling.
 */
export class ExampleErrorAgent extends LLMAgent {
    /**
     * Builds a prompt but always throws an error.
     * @param task The task containing input and scratchpad data.
     * @returns Never returns, always throws.
     */
    async buildPrompt(task: Task): Promise<string> {
        throw new Error("ExampleErrorAgent always throws an error in buildPrompt");
    }

    /**
     * Always throws an error when run.
     * @param task The task to execute.
     * @returns Never returns, always throws.
     */
    async run(task: Task): Promise<string | {content: string, annotation?: any, annotations?: Record<string, any>}> {
        throw new Error("ExampleErrorAgent always throws an error");
    }
}