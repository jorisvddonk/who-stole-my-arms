import { LLMAgent } from '../core/LLMAgent';
import { ChunkType, Task } from '../../interfaces/AgentTypes';

export class TopLevelAgent extends LLMAgent {
    buildPrompt(task: Task): string {
        const scratchpadContent = this.getScratchpadContent(task);
        const agentContents = this.getFilteredContents(task, ChunkType.AgentOutput);
        const agentResults = this.parseAgentResultsSafe(task, agentContents);

        const text = this.getInputText(task);

        let prompt = `You are the TopLevelAgent, the main coordinator for handling user requests.

Current task input: ${text}

Scratchpad history:
${scratchpadContent}

`;

        if (agentResults.length > 0) {
            const lastResult = agentResults[agentResults.length - 1];
            prompt += `Previous agent results: ${lastResult}

You have completed the task. Provide a final response to the user.`;
        } else {
            prompt += `Available agents you can call:
- CombatAgent: For handling combat-related actions like attacks, defenses, etc.
- MathAgent: For mathematical calculations and comparisons

To call an agent, use the format: <|agent_call|>{"name": "AgentName", "input": {...}}<|agent_call_end|>

If you can handle this directly, provide a response. Otherwise, delegate to appropriate agents.`;
        }

        return prompt;
    }
}