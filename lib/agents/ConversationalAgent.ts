import { LLMAgent } from '../core/LLMAgent';
import { Task } from '../../interfaces/AgentTypes';
import { ChunkType } from '../../interfaces/AgentTypes';
import { FormatterRegistry } from '../formatters';
import { ChatMessage } from '../chat-history';

export class ConversationalAgent extends LLMAgent {
    public supportsContinuation: boolean = true;

    buildPrompt(task: Task): string {
        const formattedHistory = this.formatHistory(task);
        const currentInput = this.getInputText(task);

        const registry = FormatterRegistry.getInstance();
        const formatter = registry.get('chatHistoryMessageFormatter_Alpaca');
        let formattedInput = currentInput;
        if (formatter?.userPrompt) {
            formattedInput = formatter.userPrompt(currentInput);
        }

        let prompt = `You are the ConversationalAgent, the main coordinator for handling ongoing user conversations.

${formattedHistory}
${formattedInput}

Available agents you can call:
- CombatAgent: For handling combat-related actions like attacks, defenses, etc.
- MathAgent: For mathematical calculations and comparisons

To call an agent, use the format: <|agent_call|>{"name": "AgentName", "input": {...}}<|agent_call_end|>

Respond to the current input based on the history. If you can handle it directly, provide a response. Otherwise, delegate to appropriate agents or use tools. The agents and tools will respond to you but the user can't see the contents of them, so you MUST reword their output to the user.

Your response:`;

        return prompt;
    }


}