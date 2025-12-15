import { LLMAgent, ChunkType, Task } from '../core/LLMAgent';

export class SentimentAgent extends LLMAgent {
    // supportsContinuation = false (default)

    buildPrompt(task: Task): string {
        const inputs = task.scratchpad.filter(c => c.type === ChunkType.Input);
        let text: string;
        if (inputs.length > 0) {
            // Use the content of the last input chunk
            text = inputs[inputs.length - 1].content;
        } else {
            // Fallback to task.input.text if available
            const input = task.input;
            text = (typeof input === 'object' && input !== null && 'text' in input) ? input.text : JSON.stringify(input);
        }

        const prompt = `You are a sentiment analysis expert. Analyze the sentiment of the following text.

Text to analyze: "${text}"

Return your analysis in the following JSON format:
{
  "score": <number from -1.0 to 1.0, where -1 is very negative, 0 is neutral, 1 is very positive>,
  "explanation": "<brief explanation of the sentiment>"
}

Only return the JSON, no other text.`;

        return `{{[INPUT]}}${prompt}{{[OUTPUT]}}`;
    }

    postProcessResponse(response: string): string | { content: string, annotation?: any, annotations?: Record<string, any> } {
        // Try to parse as JSON, if successful return as annotation, else return a default
        try {
            const parsed = JSON.parse(response.trim());
            if (typeof parsed.score === 'number' && typeof parsed.explanation === 'string') {
                return { content: "", annotation: parsed };
            }
        } catch (e) {
            // Not valid JSON
        }
        // Fallback
        return { content: "", annotation: { score: 0, explanation: "Unable to analyze sentiment" } };
    }
}