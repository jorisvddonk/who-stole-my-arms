import { LLMAgent } from '../core/LLMAgent';
import { Task } from '../../interfaces/AgentTypes';

/**
 * Specialized agent for summarizing and presenting errors in a neutral, readable format.
 * Does not attempt to fix or retry failed operations.
 */
export class ErrorAgent extends LLMAgent {
    /**
     * Builds a prompt for error summarization that includes error details and history.
     * @param task The task containing error information
     * @returns The constructed prompt string
     */
    buildPrompt(task: Task): string {
        const scratchpadContent = this.getScratchpadContent(task);

        const prompt = `You are the ErrorAgent, specialized in summarizing errors in a neutral, human-readable way.

Current task input (error details): ${JSON.stringify(task.input)}

Scratchpad history:
${scratchpadContent}

Summarize the errors neutrally and provide a concise explanation wrapped in <|error|>...<|error_end|>. Do not attempt to fix or retry.`;

        return prompt;
    }

    /**
     * Post-processes the response to ensure error messages are properly wrapped.
     * @param response The raw response from the LLM
     * @returns The response wrapped in error tags if not already wrapped
     */
    protected postProcessResponse(response: string): string {
        if (!response.includes("<|error|>") || !response.includes("<|error_end|>")) {
            return `<|error|>${response}<|error_end|>`;
        }
        return response;
    }
}