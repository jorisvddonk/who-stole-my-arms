import { LLMTool } from '../interfaces/LLMTool.js';

export class DieTool implements LLMTool {
  name = 'roll_die';
  description = 'Roll a die with the specified number of sides. Returns a random number between 1 and the number of sides.';

  parameters = {
    type: 'object' as const,
    properties: {
      sides: {
        type: 'integer',
        description: 'The number of sides on the die (e.g., 6 for a d6, 20 for a d20)',
        minimum: 2,
        maximum: 100
      }
    },
    required: ['sides']
  };

  prompt = `Tool: roll_die
Description: Roll a die with the specified number of sides. Returns a random number between 1 and the number of sides.
Parameters: ${JSON.stringify(this.parameters.properties)}`;

  async execute(args: Record<string, any>): Promise<{ result: number; sides: number }> {
    const { sides } = args;
    if (typeof sides !== 'number' || sides < 2 || sides > 100) {
      throw new Error('Die must have between 2 and 100 sides');
    }
    const result = Math.floor(Math.random() * sides) + 1;
    return { result, sides };
  }
}