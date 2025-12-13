import { Tool } from '../../core/LLMAgent';

export class RollDiceTool extends Tool {
    readonly name = "RollDice";
    readonly description = "Roll a die with the specified number of sides.";
    readonly parameters = {
        type: 'object' as const,
        properties: {
            sides: {
                type: 'integer',
                description: 'The number of sides on the die',
                minimum: 2,
                maximum: 100
            }
        },
        required: ['sides']
    };
    readonly prompt = `Tool: RollDice
Description: Roll a die with the specified number of sides.
Parameters: ${JSON.stringify(this.parameters.properties)}`;

    async run(parameters: any): Promise<any> {
        const roll = Math.floor(Math.random() * parameters.sides) + 1;
        return { roll };
    }
}