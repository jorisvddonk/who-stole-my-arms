import { LLMAgent } from '../core/LLMAgent';
import { Task } from '../../interfaces/AgentTypes';

/**
 * Minimal agent that only does LLM turns with no tools, evaluators, or subagents.
 * Has a simple system prompt: "You are a simple AI agent"
 */
export class SimplestAgent extends LLMAgent {
    public supportsContinuation: boolean = true;

    constructor(streamingLLM: any, arena: any) {
        super(streamingLLM, arena);
        this.evaluators = []; // No evaluators
    }

    async buildPrompt(task: Task): Promise<string> {
        const formattedHistory = await this.formatHistory(task);
        const currentInput = this.getInputText(task);

        let prompt = `You are a simple AI agent.

${formattedHistory}
${currentInput}`;

        return prompt;
    }
}
