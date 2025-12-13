import { Tool } from '../../core/LLMAgent.js';

export class SubtractTool extends Tool {
  name = 'subtract';
  description = 'Subtract one number from another.';

  parameters = {
    type: 'object' as const,
    properties: {
      a: {
        type: 'number',
        description: 'Number to subtract from'
      },
      b: {
        type: 'number',
        description: 'Number to subtract'
      }
    },
    required: ['a', 'b']
  };

  prompt = `Tool: subtract
Description: Subtract one number from another.
Parameters: ${JSON.stringify(this.parameters.properties)}`;

  async run(args: Record<string, any>): Promise<{ result: number }> {
    const { a, b } = args;
    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new Error('Both arguments must be numbers');
    }
    const result = a - b;
    return { result };
  }
}