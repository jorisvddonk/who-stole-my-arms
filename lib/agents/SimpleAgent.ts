import { LLMAgent } from '../core/LLMAgent';
import { Evaluator } from '../core/Evaluator';
import { Task, Chunk, ChunkType } from '../../interfaces/AgentTypes';
import { MarkdownEvaluator } from '../evaluators/MarkdownEvaluator';
import { VoiceEvaluator } from '../evaluators/VoiceEvaluator';
import { AgentEvaluator, CopyChunksOption } from '../evaluators/AgentEvaluator';
import { AnswerQuestionsEvaluator } from '../evaluators/AnswerQuestionsEvaluator';
import { ExampleErrorAgent } from './ExampleErrorAgent';
import { ExampleErrorToolAgent } from './ExampleErrorToolAgent';
import { ImageGenerationAgent } from './ImageGenerationAgent';
import { ComfyUISettingsTool } from '../tools/comfyui-settings-tool';
import { FormatterRegistry } from '../formatters';
import { ChatMessage } from '../chat-history';
import { Logger } from '../logging/debug-logger';

/**
 * Simple conversational agent that provides basic assistance.
 * Supports continuation for multi-turn conversations.
 */
export class SimpleAgent extends LLMAgent {
    public supportsContinuation: boolean = true;

    constructor(streamingLLM: any, arena: any, comfyuiSettingsTool?: ComfyUISettingsTool) {
        super(streamingLLM, arena);
        // Set up evaluators for markdown parsing and voice generation
        const markdownEvaluator = new MarkdownEvaluator();
        const voiceEvaluator = new VoiceEvaluator({
            voices: {
                text: 'Robert.wav',
                bold: 'Eli.wav',
                emphasis: 'Adrian.wav',
                quote: 'Austin.wav'
            },
            generation: {
                temperature: 1.0
            }
        });
        const answerQuestionsEvaluator = new AnswerQuestionsEvaluator(
            {
                'hasQuestion': 'Is the user asking at least one question?',
                'didUserRequestImage': 'did the user request an image to be generated?'
            },
            [ChunkType.Input]
        );
        const evaluators: Evaluator[][] = [[markdownEvaluator, voiceEvaluator], [answerQuestionsEvaluator]];
        if (comfyuiSettingsTool) {
            const imageGenerationEvaluator = new AgentEvaluator(
                (streamingLLM, arena) => {
                    const agent = new ImageGenerationAgent(streamingLLM, arena, comfyuiSettingsTool);
                    agent.supportsContinuation = false;
                    return agent;
                },
                streamingLLM,
                [ChunkType.Input],
                async (chunk: Chunk, arena: any, agent?: any) => {
                    const answers = chunk.annotations?.['evaluators.AnswerQuestionsEvaluator']?.answers || {};
                    Logger.debugLog(`[ImageGenerationPrecondition] Answers: ${JSON.stringify(answers)}`);
                    const result = answers['didUserRequestImage'] === true;
                    Logger.debugLog(`[ImageGenerationPrecondition] didUserRequestImage: ${answers['didUserRequestImage']}, result: ${result}`);
                    return result;
                },
                CopyChunksOption.LAST_LLMOUTPUT
            );
            evaluators[1].push(imageGenerationEvaluator);
        }
        this.evaluators = evaluators;
    }

    /**
     * Builds a prompt for the simple agent that includes conversation history and current input.
     * @param task The task containing input and scratchpad data
     * @returns The constructed prompt string
     */
    async buildPrompt(task: Task): Promise<string> {
        const formattedHistory = await this.formatHistory(task);
        const currentInput = this.getInputText(task);

        const registry = FormatterRegistry.getInstance();
        const formatter = registry.get('chatHistoryMessageFormatter_Alpaca');
        let formattedInput = currentInput;
        if (formatter?.userPrompt) {
            formattedInput = formatter.userPrompt(currentInput);
        }

        let prompt = `You are a helpful assistant with the ability to generate images. When users request image creation, you can acknowledge the request and the image will be automatically generated in the background by a specialized subagent. The generated images will be delivered seamlessly without requiring any additional action from you.

${formattedHistory}
${formattedInput}`;

        return prompt;
    }


}