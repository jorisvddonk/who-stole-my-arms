import { NonStreamingLLMInvoke, StreamingLLMInvoke, LLMInfo, TokenUtils, GenerationControl } from '../interfaces/LLMInvoke.js';
import { LLMToolManager } from './llm-tool-manager.js';
import { logToolCall } from './logging/logger.js';

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export class ToolCallingLLM implements NonStreamingLLMInvoke, StreamingLLMInvoke, LLMInfo, TokenUtils, GenerationControl {
  private llm: NonStreamingLLMInvoke & StreamingLLMInvoke;
  private toolManager: LLMToolManager;

  constructor(llm: NonStreamingLLMInvoke & StreamingLLMInvoke, toolManager: LLMToolManager) {
    this.llm = llm;
    this.toolManager = toolManager;
  }

  private parseToolCall(response: string): ToolCall | null {
    // console.log(`[TOOL_DEBUG] Parsing tool call from: ${response.slice(-100)}`);
    // Look for XML-like tool call tags: <|tool_call|>...JSON...<|tool_call_end|>
    const toolCallRegex = /<\|tool_call\|>(.*?)<\|tool_call_end\|>/s;
    const match = response.match(toolCallRegex);
    if (match) {
      try {
        const toolCallJson = match[1].trim();
        const toolCallObj = JSON.parse(toolCallJson);
        if (toolCallObj.name && toolCallObj.arguments) {
          console.log(`[TOOL_DEBUG] 🎯 DETECTED TOOL CALL: ${toolCallObj.name}(${JSON.stringify(toolCallObj.arguments)})`);
          return {
            id: `call_${Date.now()}`,
            name: toolCallObj.name,
            arguments: toolCallObj.arguments
          };
        }
      } catch (e) {
        console.log(`[TOOL_DEBUG] Error parsing tool call:`, e);
      }
    }
    // console.log(`[TOOL_DEBUG] No tool call found`);
    return null;
  }

  private removeToolCallFromResponse(response: string, toolCall: ToolCall): string {
    // Remove the tool call XML tags and JSON from the response
    const toolCallStr = `<|tool_call|>${JSON.stringify({ name: toolCall.name, arguments: toolCall.arguments })}<|tool_call_end|>`;
    return response.replace(toolCallStr, '').trim();
  }

  async generate(prompt: string, sessionId?: string | null): Promise<string> {
    let response = await this.llm.generate(prompt);
    let toolCall = this.parseToolCall(response);
    console.log(`[TOOL_DEBUG] Parsed tool call:`, toolCall);

    while (toolCall) {
      try {
        console.log(`[TOOL_DEBUG] 🔧 EXECUTING TOOL CALL: ${toolCall.name} with args:`, toolCall.arguments);
        const result = await this.toolManager.executeTool(toolCall.name, toolCall.arguments);
        console.log(`[TOOL_DEBUG] ✅ TOOL RESULT: ${toolCall.name} returned:`, result);
        logToolCall(toolCall.name, toolCall.arguments, result, sessionId);
        const toolResultPrompt = `\n\nTool result for ${toolCall.name}: ${JSON.stringify(result)}\n\n`;
        response = this.removeToolCallFromResponse(response, toolCall);
        const continuationPrompt = prompt + response + toolResultPrompt;
        const continuationResponse = await this.llm.generate(continuationPrompt);
        console.log(`[TOOL_DEBUG] Continuation response: ${continuationResponse.slice(0, 100)}`);
        response += continuationResponse;
        toolCall = this.parseToolCall(continuationResponse);
      } catch (error) {
        console.log(`[TOOL_DEBUG] Tool execution error: ${(error as Error).message}`);
        logToolCall(toolCall.name, toolCall.arguments, { error: (error as Error).message }, sessionId);
        const errorPrompt = `\n\nTool error for ${toolCall!.name}: ${(error as Error).message}\n\n`;
        response = this.removeToolCallFromResponse(response, toolCall!);
        const continuationPrompt = prompt + response + errorPrompt;
        const continuationResponse = await this.llm.generate(continuationPrompt);
        response += continuationResponse;
        toolCall = this.parseToolCall(continuationResponse);
      }
    }

    return response;
  }

  async *generateStream(prompt: string, sessionId?: string | null, abortSignal?: AbortSignal): AsyncIterable<{ token?: string; finishReason?: string; tool_call?: any; tool_result?: any; reasoning?: string }> {
    let currentPrompt = prompt;

    // Loop to handle multiple tool calls by restarting generation
    while (true) {
      let accumulatedResponse = '';
      let toolCallDetected = false;

      // console.log(`[TOOL_DEBUG] Starting streaming generation with prompt length: ${currentPrompt.length}`);

       // Stream the current prompt
        for await (const chunk of this.llm.generateStream(currentPrompt, sessionId, abortSignal)) {
         if (chunk.token || chunk.reasoning) {
           if (chunk.token) {
             // console.log(`\x1b[31m[TOOL_DEBUG]\x1b[0m \x1b[90mReceived token:\x1b[0m \x1b[95m\`${chunk.token}\`\x1b[0m`);
             accumulatedResponse += chunk.token;
           }
           if (chunk.reasoning) {
             // console.log(`\x1b[31m[TOOL_DEBUG]\x1b[0m \x1b[90mReceived reasoning:\x1b[0m \x1b[95m\`${chunk.reasoning}\`\x1b[0m`);
             // not accumulating here
           }

           // Always yield the chunk first
           yield chunk;

          // Then check for complete tool calls in the accumulated response
          const toolCall = this.parseToolCall(accumulatedResponse);
          if (toolCall) {
            console.log(`[TOOL_DEBUG] 🎯 STREAMING TOOL CALL DETECTED:`, toolCall);
            toolCallDetected = true;

            // Abort current generation
            console.log(`[TOOL_DEBUG] Aborting current generation for tool execution`);
            await this.llm.abortGeneration();

            try {
              console.log(`[TOOL_DEBUG] 🔧 STREAMING TOOL EXECUTION: ${toolCall.name} with args:`, toolCall.arguments);
              const result = await this.toolManager.executeTool(toolCall.name, toolCall.arguments);
              console.log(`[TOOL_DEBUG] ✅ STREAMING TOOL RESULT: ${toolCall.name} returned:`, result);
              logToolCall(toolCall.name, toolCall.arguments, result, sessionId);

              // Send tool call and result messages
              yield { tool_call: toolCall };
              yield { tool_result: { name: toolCall.name, result } };

              // Yield the tool result as formatted text
              const toolResultText = `<|tool_result|>{"name": "${toolCall.name}", "result": ${JSON.stringify(result)}}<|tool_result_end|>`;
              for (const char of toolResultText) {
                yield { token: char };
              }

              // Create new prompt for continuation
              const toolResultPrompt = `\n\n${toolResultText}\n\n`;
              currentPrompt = currentPrompt + accumulatedResponse + toolResultPrompt;

              console.log(`[TOOL_DEBUG] Restarting generation with updated prompt`);
              break; // Exit inner loop to restart with new prompt

            } catch (error) {
              console.log(`[TOOL_DEBUG] Tool execution error: ${(error as Error).message}`);
              logToolCall(toolCall.name, toolCall.arguments, { error: (error as Error).message }, sessionId);

              // Send error result
              yield { tool_call: toolCall };
              yield { tool_result: { name: toolCall.name, error: (error as Error).message } };

              // Yield the tool error as formatted text
              const toolErrorText = `<|tool_result|>{"name": "${toolCall.name}", "error": "${(error as Error).message}"}<|tool_result_end|>`;
              for (const char of toolErrorText) {
                yield { token: char };
              }

              // Create error continuation prompt
              const errorPrompt = `\n\n${toolErrorText}\n\n`;
              currentPrompt = currentPrompt + accumulatedResponse + errorPrompt;

              console.log(`[TOOL_DEBUG] Restarting generation after tool error`);
              break; // Exit inner loop to restart with new prompt
            }
          }
        } else if (chunk.finishReason) {
          console.log(`[TOOL_DEBUG] Generation finished with reason: ${chunk.finishReason}`);

          // Final check for tool calls in the complete response
          const finalToolCall = this.parseToolCall(accumulatedResponse);
          if (finalToolCall) {
            console.log(`[TOOL_DEBUG] 🎯 FINAL TOOL CALL DETECTED:`, finalToolCall);

            try {
              console.log(`[TOOL_DEBUG] 🔧 FINAL TOOL EXECUTION: ${finalToolCall.name} with args:`, finalToolCall.arguments);
              const result = await this.toolManager.executeTool(finalToolCall.name, finalToolCall.arguments);
              console.log(`[TOOL_DEBUG] ✅ FINAL TOOL RESULT: ${finalToolCall.name} returned:`, result);
              logToolCall(finalToolCall.name, finalToolCall.arguments, result, sessionId);

              // Send tool call and result messages
              yield { tool_call: finalToolCall };
              yield { tool_result: { name: finalToolCall.name, result } };

              // Yield the tool result as formatted text
              const toolResultText = `<|tool_result|>{"name": "${finalToolCall.name}", "result": ${JSON.stringify(result)}}<|tool_result_end|>`;
              for (const char of toolResultText) {
                yield { token: char };
              }

              // Create new prompt for continuation
              const toolResultPrompt = `\n\n${toolResultText}\n\n`;
              currentPrompt = currentPrompt + accumulatedResponse + toolResultPrompt;

              console.log(`[TOOL_DEBUG] Restarting generation after final tool call`);
              break; // Exit inner loop to restart with new prompt

            } catch (error) {
              console.log(`[TOOL_DEBUG] Final tool execution error: ${(error as Error).message}`);
              logToolCall(finalToolCall.name, finalToolCall.arguments, { error: (error as Error).message }, sessionId);

              // Send error result
              yield { tool_call: finalToolCall };
              yield { tool_result: { name: finalToolCall.name, error: (error as Error).message } };

              // Yield the tool error as formatted text
              const toolErrorText = `<|tool_result|>{"name": "${finalToolCall.name}", "error": "${(error as Error).message}"}<|tool_result_end|>`;
              for (const char of toolErrorText) {
                yield { token: char };
              }

              // Create error continuation prompt
              const errorPrompt = `\n\n${toolErrorText}\n\n`;
              currentPrompt = currentPrompt + accumulatedResponse + errorPrompt;

              console.log(`[TOOL_DEBUG] Restarting generation after final tool error`);
              break; // Exit inner loop to restart with new prompt
            }
          } else {
            yield chunk;
            return; // No more tool calls, end streaming
          }
        }
      }

      // If no tool call was detected in this iteration, we're done
      if (!toolCallDetected) {
        console.log(`[TOOL_DEBUG] No tool call detected, ending stream`);
        break;
      }
    }
  }

  // Delegate other methods to the underlying LLM
  async getVersion(): Promise<any> {
    return (this.llm as any).getVersion();
  }

  async getModel(): Promise<string> {
    return (this.llm as any).getModel();
  }

  async getPerformanceStats(): Promise<any> {
    return (this.llm as any).getPerformanceStats();
  }

  async getMaxContextLength(): Promise<number> {
    return (this.llm as any).getMaxContextLength();
  }

  async countTokens(text: string): Promise<{ count: number; tokens: number[] }> {
    return (this.llm as any).countTokens(text);
  }

  async tokenize(text: string): Promise<number[]> {
    return (this.llm as any).tokenize(text);
  }

  async detokenize(tokenIds: number[]): Promise<string> {
    return (this.llm as any).detokenize(tokenIds);
  }

  async abortGeneration(): Promise<boolean> {
    return (this.llm as any).abortGeneration();
  }

  async checkGeneration(): Promise<string | null> {
    return (this.llm as any).checkGeneration();
  }

  updateSettings?(newSettings: any) {
    if ((this.llm as any).updateSettings) {
      (this.llm as any).updateSettings(newSettings);
    }
  }
}