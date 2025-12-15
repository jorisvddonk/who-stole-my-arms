import { LLMAgent, Task } from '../core/LLMAgent';

export class MathAgent extends LLMAgent {
    buildPrompt(task: Task): string {
        const scratchpadContent = this.getScratchpadContent(task);

        const prompt = `You are the MathAgent, specialized in mathematical calculations and comparisons.

Current task input: ${this.getInputText(task)}

Scratchpad history:
${scratchpadContent}

Perform the requested mathematical operation or comparison and provide the result. Be precise and direct.`;

        return prompt;
    }
}