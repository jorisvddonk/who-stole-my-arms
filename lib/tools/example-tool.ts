import { Tool } from '../core/LLMAgent';

export class ExampleTool extends Tool {
    readonly name = 'example';
    readonly description = 'An example tool that demonstrates chunk annotations by returning metadata.';
    readonly parameters = {
        type: 'object' as const,
        properties: {
            input: {
                type: 'string',
                description: 'A string input to process'
            }
        },
        required: ['input']
    };
    readonly prompt = 'Use this tool to process a string input and get annotated results.';

    async run(parameters: any, context?: { arena: any, task: any }): Promise<any | { result: any, annotations?: Record<string, any> }> {
        const { input } = parameters;
        const result = `Processed: ${input.toUpperCase()}`;

        // Return with annotations to demonstrate
        return {
            result,
            annotations: {
                'tools.example': {
                    processedAt: new Date().toISOString(),
                    inputLength: input.length,
                    outputLength: result.length
                }
            }
        };
    }
}