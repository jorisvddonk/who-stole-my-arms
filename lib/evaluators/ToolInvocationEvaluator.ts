import { Chunk, ChunkType } from '../../interfaces/AgentTypes';
import { Evaluator } from '../core/Evaluator';
import { TOOL_CALL_DETECTION_EVALUATOR_FQDN, ToolDetectionAnnotation } from './ToolCallDetectionEvaluator';
import { Logger, TOOL_COLOR, RESET } from '../logging/debug-logger';

export interface ToolInvocationAnnotation {
    toolInvocations: Array<{
        name: string;
        parameters: any;
        success: boolean;
        result?: any;
        error?: string;
    }>;
    hasToolInvocations: boolean;
}

export class ToolInvocationEvaluator extends Evaluator {
    readonly fqdn: string = 'evaluators.ToolInvocationEvaluator';
    readonly supportedChunkTypes: ChunkType[] = [ChunkType.LlmOutput];

    async evaluate(chunk: Chunk, arena: any, agent?: any): Promise<{ annotation: ToolInvocationAnnotation }> {
        const results: Array<{ name: string; parameters: any; success: boolean; result?: any; error?: string }> = [];

        const detectionAnnotation = chunk.annotations?.[TOOL_CALL_DETECTION_EVALUATOR_FQDN] as ToolDetectionAnnotation | undefined;

        if (!detectionAnnotation || !detectionAnnotation.toolCalls || detectionAnnotation.toolCalls.length === 0) {
            return {
                annotation: {
                    toolInvocations: [],
                    hasToolInvocations: false
                }
            };
        }

        for (const call of detectionAnnotation.toolCalls) {
            const tool = agent.tools?.[call.name];
            let toolResult: any;
            let success = true;
            let error: string | undefined;

            try {
                if (tool) {
                    const toolReturn = await tool.run(call.parameters, { arena, task: null });

                    if (typeof toolReturn === 'object' && toolReturn !== null && 'result' in toolReturn) {
                        toolResult = toolReturn.result;
                    } else {
                        toolResult = toolReturn;
                    }

                    Logger.debugLog(`Tool ${TOOL_COLOR}${call.name}${RESET} output: ${JSON.stringify(toolResult)}`);
                } else {
                    success = false;
                    error = `Unknown tool: ${call.name}`;
                    toolResult = "unknown tool";
                    Logger.debugLog(`Tool ${TOOL_COLOR}${call.name}${RESET} not found`);
                }
            } catch (e) {
                success = false;
                error = (e as any).message || String(e);
                toolResult = { error };
                Logger.debugLog(`Tool ${TOOL_COLOR}${call.name}${RESET} failed: ${e}`);
            }

            Logger.debugLog(`Tool result: <|tool_result|>${JSON.stringify(toolResult)}<|tool_result_end|>`);

            results.push({
                name: call.name,
                parameters: call.parameters,
                success,
                result: success ? toolResult : undefined,
                error
            });
        }

        return {
            annotation: {
                toolInvocations: results,
                hasToolInvocations: results.length > 0
            }
        };
    }
}
