import { Chunk, ChunkType } from '../../interfaces/AgentTypes';
import { Evaluator } from '../core/Evaluator';

export const TOOL_CALL_DETECTION_EVALUATOR_FQDN = 'evaluators.ToolCallDetectionEvaluator';

interface DetectedToolCall {
    name: string;
    parameters: any;
    start: number;
    end: number;
}

export interface ToolDetectionAnnotation {
    toolCalls: DetectedToolCall[];
    hasToolCalls: boolean;
}

export class ToolCallDetectionEvaluator extends Evaluator {
    readonly fqdn: string = TOOL_CALL_DETECTION_EVALUATOR_FQDN;
    readonly supportedChunkTypes: ChunkType[] = [ChunkType.LlmOutput];

    async evaluate(chunk: Chunk): Promise<{ annotation: ToolDetectionAnnotation }> {
        const toolCalls = this.parseToolCalls(chunk.content);
        const hasToolCalls = toolCalls.length > 0;

        return {
            annotation: {
                toolCalls,
                hasToolCalls
            }
        };
    }

    private parseToolCalls(response: string): DetectedToolCall[] {
        const calls: DetectedToolCall[] = [];
        const startCount = (response.match(/<\|tool_call\|>/g) || []).length;
        const endCount = (response.match(/<\|tool_call_end\|>/g) || []).length;

        if (startCount !== endCount) {
            return calls;
        }

        const toolCallRegex = /<\|tool_call\|>(.*?)<\|tool_call_end\|>/gs;
        let match;

        while ((match = toolCallRegex.exec(response)) !== null) {
            try {
                const callData = JSON.parse(match[1]);
                if (callData.name && callData.parameters !== undefined) {
                    calls.push({
                        name: callData.name,
                        parameters: callData.parameters,
                        start: match.index,
                        end: match.index + match[0].length
                    });
                }
            } catch (e) {
            }
        }

        return calls;
    }
}
