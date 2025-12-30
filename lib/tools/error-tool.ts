import { Tool } from '../core/Tool';
import { Task } from '../../interfaces/AgentTypes';

export class ErrorTool extends Tool {
    name = 'error';
    description = 'A tool that always throws an error.';

    parameters = {
        type: 'object' as const,
        properties: {
            message: {
                type: 'string',
                description: 'The error message to throw'
            }
        },
        required: ['message']
    };

    prompt = `Tool: error
Description: A tool that always throws an error.
Parameters: ${JSON.stringify(this.parameters.properties)}`;

    async run(parameters: any, context?: { arena: any, task: Task }): Promise<any> {
        throw new Error(parameters.message || 'ErrorTool always throws an error');
    }
}