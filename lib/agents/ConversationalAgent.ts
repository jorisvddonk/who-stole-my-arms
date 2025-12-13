import { LLMAgent, ChunkType, Task } from '../core/LLMAgent';

export class ConversationalAgent extends LLMAgent {
    public supportsContinuation: boolean = true;

    buildPrompt(task: Task): string {
        const scratchpadContent = this.getScratchpadContent(task);
        const inputs = task.scratchpad.filter(c => c.type === ChunkType.Input);
        const currentInput = inputs.length > 0 ? inputs[inputs.length - 1].content : task.input;

        let prompt = `You are the ConversationalAgent, the main coordinator for handling ongoing user conversations.

Current user input: ${currentInput}

Conversation history (scratchpad):
${scratchpadContent}

Available agents you can call:
- CombatAgent: For handling combat-related actions like attacks, defenses, etc.
- MathAgent: For mathematical calculations and comparisons

To call an agent, use the format: <|agent_call|>{"name": "AgentName", "input": {...}}<|agent_call_end|>

Respond to the current input based on the history. If you can handle it directly, provide a response. Otherwise, delegate to appropriate agents or use tools. The agents and tools will respond to you but the user can't see the contents of them, so you MUST reword their output to the user.`;

        return prompt;
    }
}