import { LLMAgent } from '../core/LLMAgent';
import { Task } from '../../interfaces/AgentTypes';
import { ErrorTool } from '../tools/error-tool';

/**
 * Example agent that always invokes the ErrorTool.
 */
export class ExampleErrorToolAgent extends LLMAgent {
    constructor(streamingLLM: any, arena: any) {
        super(streamingLLM, arena);
        // Register the ErrorTool
        this.registerTool(new ErrorTool());
    }

    /**
     * Builds a prompt that instructs to always call the error tool.
     * @param task The task containing input and scratchpad data.
     * @returns The constructed prompt string.
     */
    async buildPrompt(task: Task): Promise<string> {
        const scratchpadContent = this.getScratchpadContent(task);

        const prompt = `You are an agent that always calls the error tool.

Available tools:
${Object.values(this.tools).map(tool => tool.prompt).join('\n\n')}

Current task input: ${JSON.stringify(task.input)}

Scratchpad history:
${scratchpadContent}

Always respond by calling the error tool with a message.`;

        return prompt;
    }

    /**
     * Runs the agent, but since we want it to always call the tool, we can override to directly return a tool call response.
     * @param task The task to execute.
     * @returns A response string with a tool call.
     */
    async run(task: Task): Promise<string | {content: string, annotation?: any, annotations?: Record<string, any>}> {
        // Always return a tool call for the error tool
        const toolCall = {
            name: 'error',
            parameters: { message: 'ExampleErrorToolAgent always calls error tool' }
        };
        return `<|tool_call|>${JSON.stringify(toolCall)}<|tool_call_end|>`;
    }
}