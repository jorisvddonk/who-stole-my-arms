import { Tool, Task } from '../../core/LLMAgent';

export class MultiplyTool extends Tool {
  name = 'multiply';
  description = 'Multiply two numbers together.';

  parameters = {
    type: 'object' as const,
    properties: {
      a: {
        type: 'number',
        description: 'First number to multiply'
      },
      b: {
        type: 'number',
        description: 'Second number to multiply'
      }
    },
    required: ['a', 'b']
  };

  prompt = `Tool: multiply
Description: Multiply two numbers together.
Parameters: ${JSON.stringify(this.parameters.properties)}`;

  async run(parameters: any, context?: { arena: any, task: Task }): Promise<{ result: number }> {
    const { a, b } = parameters;
    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new Error('Both arguments must be numbers');
    }

    // For large numbers, use BigInt arithmetic and round to handle precision issues
    const bigA = BigInt(Math.round(a));
    const bigB = BigInt(Math.round(b));
    const bigResult = bigA * bigB;

    return { result: Number(bigResult) };
  }
}