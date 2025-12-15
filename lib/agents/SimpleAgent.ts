import { LLMAgent } from '../core/LLMAgent';
import { Task } from '../../interfaces/AgentTypes';

export class SimpleAgent extends LLMAgent {
    public supportsContinuation: boolean = true;

    buildPrompt(task: Task): string {
        const scratchpadContent = this.getScratchpadContent(task);
        const currentInput = this.getInputText(task);

        let prompt = `You are a helpful assistant.
        
Conversation history (scratchpad):
${scratchpadContent}

Current user input: ${currentInput}

Respond helpfully to the user's input.`;

        return prompt;
    }
}