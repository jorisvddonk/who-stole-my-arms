import { LLMAgent, ChunkType, Task } from '../core/LLMAgent';

export class SimpleAgent extends LLMAgent {
    public supportsContinuation: boolean = true;

    buildPrompt(task: Task): string {
        const scratchpadContent = this.getScratchpadContent(task);
        const inputs = task.scratchpad.filter(c => c.type === ChunkType.Input);
        const currentInput = inputs.length > 0 ? inputs[inputs.length - 1].content : task.input;

        let prompt = `You are a helpful assistant.
        
Conversation history (scratchpad):
${scratchpadContent}

Current user input: ${currentInput}

Respond helpfully to the user's input.`;

        return prompt;
    }
}