import { Chunk, ChunkType } from '../../interfaces/AgentTypes';
import { Evaluator } from '../core/Evaluator';
import { Logger } from '../logging/debug-logger';

export class AnswerQuestionsEvaluator extends Evaluator {
    readonly fqdn: string;
    readonly supportedChunkTypes: ChunkType[];
    private questions: Record<string, string>;

    constructor(
        questions: Record<string, string>,
        supportedChunkTypes: ChunkType[],
        fqdn?: string
    ) {
        super();
        this.questions = questions;
        this.supportedChunkTypes = supportedChunkTypes;
        this.fqdn = fqdn || 'evaluators.AnswerQuestionsEvaluator';
    }

    async evaluate(chunk: Chunk, arena: any, agent?: any): Promise<{ annotation?: any, annotations?: Record<string, any> }> {
        if (!arena || !arena.streamingLLM) {
            Logger.debugLog(`[${this.fqdn}] No arena or streamingLLM available`);
            return {};
        }

        const answers: Record<string, boolean> = {};

        for (const [questionKey, question] of Object.entries(this.questions)) {
            Logger.debugLog(`[${this.fqdn}] Processing question ${questionKey}: ${question}`);

            let allowedError = 0;
            let retries = 0;
            let done = false;

            while (!done && retries < 10) {
                let currentError = 0;
                const prompt = this.buildPrompt(chunk.content, question);
                Logger.debugLog(`[${this.fqdn}] Sending prompt for question ${questionKey}, attempt ${retries + 1}`);

                try {
                    let response = '';
                    if (arena.streamingLLM.generateStream) {
                        for await (const element of arena.streamingLLM.generateStream(prompt)) {
                            if (element.token) {
                                response += element.token;
                            }
                            if (element.finishReason) {
                                break;
                            }
                        }
                    } else if (arena.streamingLLM.generate) {
                        response = await arena.streamingLLM.generate(prompt);
                    } else {
                        Logger.debugLog(`[${this.fqdn}] No generate method available on streamingLLM`);
                        break;
                    }

                    Logger.debugLog(`[${this.fqdn}] Received response for question ${questionKey}: ${response}`);

                    const cleanedResponse = response.trim().toLowerCase();
                    let answer: boolean | null = null;

                    // Normalize by removing trailing punctuation
                    const normalized = cleanedResponse.replace(/[.,!?;:]+$/, '');
                    const words = normalized.trim().split(/\s+/);
                    const lastWord = words.length > 0 ? words[words.length - 1] : '';

                    if (lastWord === 'yes' || cleanedResponse === 'true') {
                        answer = true;
                    } else if (lastWord === 'no' || cleanedResponse === 'false') {
                        answer = false;
                    } else {
                        currentError = 1;
                        Logger.debugLog(`[${this.fqdn}] Invalid response for question ${questionKey}, retrying`);
                    }

                    if (answer !== null && currentError <= allowedError) {
                        answers[questionKey] = answer;
                        Logger.debugLog(`[${this.fqdn}] Question ${questionKey} answer: ${answer}`);
                        done = true;
                    } else {
                        retries += 1;
                        allowedError += 0.25;
                    }
                } catch (error) {
                    Logger.debugLog(`[${this.fqdn}] Error processing question ${questionKey}: ${error instanceof Error ? error.message : String(error)}`);
                    currentError = 1;
                    retries += 1;
                    allowedError += 0.25;
                }
            }

            if (!done) {
                Logger.debugLog(`[${this.fqdn}] Retries exceeded for question ${questionKey}`);
            }
        }

        return { annotation: { answers } };
    }

    private buildPrompt(chunkContent: string, question: string): string {
        let text = chunkContent;

        try {
            const chunkData = JSON.parse(text);
            if (chunkData.content) {
                text = chunkData.content;
            }
        } catch (e) {
        }

        let prompt = `You are an AI assistant that analyzes text to answer yes/no questions.\n\n`;
        const prompt2 = `Based on the following incoming text:\n\n${text}\n\n---\nYour task: Answer this question with ONLY "yes" or "no": ${question}\n\nDo not add any explanation or extra text.`;
        prompt += prompt2;

        return prompt;
    }
}
