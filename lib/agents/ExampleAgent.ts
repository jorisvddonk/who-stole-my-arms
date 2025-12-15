import { LLMAgent } from '../core/LLMAgent';
import { ChunkType, Task } from '../../interfaces/AgentTypes';
import { ExampleTool } from '../tools/example-tool';

export class ExampleAgent extends LLMAgent {
    public supportsContinuation: boolean = true;

    constructor(streamingLLM: any, arena: any) {
        super(streamingLLM, arena);
        this.tools['example'] = new ExampleTool();
    }

    buildPrompt(task: Task): string {
        const scratchpadContent = this.getScratchpadContent(task);

        let prompt = `You are the ExampleAgent, demonstrating tool usage and annotations.

Current task input: ${this.getInputText(task)}

Scratchpad history:
${scratchpadContent}

You can use the 'example' tool to process strings.

To call a tool, use the format: <|tool_call|>{"name": "example", "parameters": {"input": "your string here"}}<|tool_call_end|>

Available tools:
- example: Processes a string input and returns annotated results.

Provide a response, and consider using the tool if appropriate.`;

        return prompt;
    }

    async run(task: Task): Promise<string | { content: string, annotation?: any, annotations?: Record<string, any> }> {
        // Build prompt and generate response, then count tokens
        const prompt = this.buildPrompt(task);            
        let tokenCount = 0;
        let callback = () => {
            tokenCount += 1;
        };
        this.eventEmitter.on('token', callback);
        let response = await this.generateStreamingResponse(prompt);
        this.eventEmitter.removeListener('token', callback);

        // Demonstrate annotations: add token count
        
        return {
            content: response,
            annotations: {
                'agents.ExampleAgent': {
                    tokenCount,
                }
            }
        };
    }
}