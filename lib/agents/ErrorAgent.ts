import { LLMAgent, Task } from '../core/LLMAgent';

export class ErrorAgent extends LLMAgent {
    buildPrompt(task: Task): string {
        const scratchpadContent = this.getScratchpadContent(task);

        const prompt = `You are the ErrorAgent, specialized in summarizing errors in a neutral, human-readable way.

Current task input (error details): ${JSON.stringify(task.input)}

Scratchpad history:
${scratchpadContent}

Summarize the errors neutrally and provide a concise explanation wrapped in <|error|>...<|error_end|>. Do not attempt to fix or retry.`;

        return prompt;
    }

    protected postProcessResponse(response: string): string {
        if (!response.includes("<|error|>") || !response.includes("<|error_end|>")) {
            return `<|error|>${response}<|error_end|>`;
        }
        return response;
    }
}