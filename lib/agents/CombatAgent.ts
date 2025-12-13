import { LLMAgent, ChunkType, Task } from '../core/LLMAgent';
import { RollDiceTool } from '../tools/battle/RollDiceTool';

export class CombatAgent extends LLMAgent {
    constructor(streamingLLM: any, arena: any) {
        super(streamingLLM, arena);
        this.registerTool(new RollDiceTool());
    }

    buildPrompt(task: Task): string {
        const scratchpadContent = this.getScratchpadContent(task);
        const toolContents = this.getFilteredContents(task, ChunkType.ToolOutput);
        const agentContents = this.getFilteredContents(task, ChunkType.AgentOutput);
        const toolResults = this.parseToolResultsSafe(task, toolContents, true);
        const agentResults = this.parseAgentResultsSafe(task, agentContents, true);

        let prompt = `You are the CombatAgent, specialized in handling combat scenarios.

Current task input: ${JSON.stringify(task.input)}

Scratchpad history:
${scratchpadContent}

`;

        if (toolResults.length === 0) {
            prompt += `You need to roll for attack. Use the RollDice tool to roll a d20.

To call a tool, use the format: <|tool_call|>{"name": "ToolName", "parameters": {...}}<|tool_call_end|>

Available tools:
- RollDice: Roll a die with specified number of sides`;
        } else if (agentResults.length === 0) {
            const roll = toolResults[0].roll;
            prompt += `You rolled a ${roll}. Now determine if it hits (AC 15).

Call the MathAgent to compare the roll against the target's AC.

To call an agent, use the format: <|agent_call|>{"name": "AgentName", "input": {...}}<|agent_call_end|>

Available agents:
- MathAgent: For calculations and comparisons`;
        } else {
            prompt += `Based on the results, provide a combat outcome description.`;
        }

        return prompt;
    }
}