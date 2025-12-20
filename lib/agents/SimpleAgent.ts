import { LLMAgent } from '../core/LLMAgent';
import { Task } from '../../interfaces/AgentTypes';
import { SimpleEvaluator } from '../evaluators/SimpleEvaluator';
import { ChunkType } from '../../interfaces/AgentTypes';
import { MarkdownEvaluator } from '../evaluators/MarkdownEvaluator';
import { VoiceEvaluator } from '../evaluators/VoiceEvaluator';

/**
 * Simple conversational agent that provides basic assistance.
 * Supports continuation for multi-turn conversations.
 */
export class SimpleAgent extends LLMAgent {
    public supportsContinuation: boolean = true;

    constructor(streamingLLM: any, arena: any) {
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
        this.evaluators = [[markdownEvaluator, voiceEvaluator]];
    }

    /**
     * Builds a prompt for the simple agent that includes conversation history and current input.
     * @param task The task containing input and scratchpad data
     * @returns The constructed prompt string
     */
    buildPrompt(task: Task): string {
        const scratchpadContent = this.getScratchpadContent(task);
        const currentInput = this.getInputText(task);

        let prompt = `You are a helpful assistant.
        
Conversation history (scratchpad):
${scratchpadContent}

Current user input: ${currentInput}

Respond helpfully to the user's input.`;

        return prompt;
    }
}