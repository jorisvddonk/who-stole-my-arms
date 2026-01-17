import { LLMAgent } from '../core/LLMAgent';
import { ChunkType, Task } from '../../interfaces/AgentTypes';
import { DieTool } from '../tools/die-tool';

export class DieRollerAgent extends LLMAgent {
    constructor(streamingLLM: any, arena: any) {
        super(streamingLLM, arena);
        this.registerTool(new DieTool());
    }

    async run(task: Task): Promise<string | { content: string, annotation?: any, annotations?: Record<string, any> }> {
        this.currentTask = task;
        const toolContents = this.getFilteredContents(task, ChunkType.ToolOutput);
        const toolResults = this.parseToolResultsSafe(task, toolContents, true);

        if (toolResults.length > 0) {
            // Return the formatted roll result directly
            const roll = toolResults[0]?.roll ?? 'unknown';
            const sides = toolResults[0]?.sides ?? 'unknown';
            return `Rolled a d${sides}: ${roll}`;
        }

        // No tool results yet, proceed with normal LLM flow
        return super.run(task);
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
            prompt += `You are a specialized dice rolling agent. Your ONLY job is to roll dice - do not perform any calculations, additions, or modifications.

Analyze the user input to determine what die to roll. Look for patterns like "d20", "d6", etc.

Examples:
- "roll a d20" → roll_die with sides=20
- "roll 2d6" → this is not supported, just roll one die based on the type mentioned
- "roll a die" → assume d6

Call the roll_die tool with the appropriate number of sides. Do not explain, just call the tool.

To call a tool, use the format: <|tool_call|>{"name": "roll_die", "parameters": {"sides": NUMBER}}<|tool_call_end|>

Available tools:
- roll_die: Roll a die with specified number of sides. Returns only the roll result.`;
        }

        return prompt;
    }
}