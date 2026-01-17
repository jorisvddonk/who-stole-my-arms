import { LLMAgent } from '../core/LLMAgent';
import { ChunkType, Task } from '../../interfaces/AgentTypes';
import { DieTool } from '../tools/die-tool';

export class DieRollerAgent extends LLMAgent {
    constructor(streamingLLM: any, arena: any) {
        super(streamingLLM, arena);
        this.registerTool(new DieTool());
    }

    async buildPrompt(task: Task): Promise<string> {
        const scratchpadContent = this.getScratchpadContent(task);
        const toolContents = this.getFilteredContents(task, ChunkType.ToolOutput);
        const toolResults = this.parseToolResultsSafe(task, toolContents, true);

        let prompt = `You are the DieRollerAgent, specialized in rolling dice for RPG games.

Current task input: ${this.getInputText(task)}

Scratchpad history:
${scratchpadContent}

`;

        if (toolResults.length === 0) {
            prompt += `Roll the requested die using the roll_die tool.

To call a tool, use the format: <|tool_call|>{"name": "roll_die", "parameters": {...}}<|tool_call_end|>

Available tools:
- roll_die: Roll a die with specified number of sides`;
        } else {
            console.log('DieRollerAgent toolResults:', JSON.stringify(toolResults));
            prompt += `You rolled a ${toolResults[0]?.roll ?? 'unknown'} on a d${toolResults[0]?.sides ?? 'unknown'}. Report the result.`;
        }

        return prompt;
    }
}