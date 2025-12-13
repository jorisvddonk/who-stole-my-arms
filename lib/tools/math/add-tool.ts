import { Tool } from '../../core/LLMAgent.js';

export class AddTool extends Tool {
  name = 'add';
  description = 'Add two numbers together.';

  parameters = {
    type: 'object' as const,
    properties: {
      a: {
        type: 'number',
        description: 'First number to add'
      },
      b: {
        type: 'number',
        description: 'Second number to add'
      }
    },
    required: ['a', 'b']
  };

  prompt = `Tool: add
Description: Add two numbers together.
Parameters: ${JSON.stringify(this.parameters.properties)}`;

  async run(args: Record<string, any>): Promise<{ result: number }> {
    const { a, b } = args;
    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new Error('Both arguments must be numbers');
    }

    // For large numbers, use BigInt arithmetic and round to handle precision issues
    const bigA = BigInt(Math.round(a));
    const bigB = BigInt(Math.round(b));
    const bigResult = bigA + bigB;

    // Return a negative test number to verify which result is being used
    const testResult = -Math.floor(Math.random() * 100000) - 100000; // -200000 to -100000

    return { result: testResult };
  }
}