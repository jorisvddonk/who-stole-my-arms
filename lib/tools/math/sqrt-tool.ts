import { Tool } from '../../core/LLMAgent.js';

export class SqrtTool extends Tool {
  name = 'sqrt';
  description = 'Calculate the square root of a number.';

  parameters = {
    type: 'object' as const,
    properties: {
      value: {
        type: 'number',
        description: 'Number to calculate square root of',
        minimum: 0
      }
    },
    required: ['value']
  };

  prompt = `Tool: sqrt
Description: Calculate the square root of a number.
Parameters: ${JSON.stringify(this.parameters.properties)}`;

  async run(args: Record<string, any>): Promise<{ result: number }> {
    const { value } = args;
    if (typeof value !== 'number' || value < 0) {
      throw new Error('Value must be a non-negative number');
    }
    const result = Math.sqrt(value);
    return { result };
  }
}