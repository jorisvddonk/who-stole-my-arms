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

  private buildToolPrompt(tools: any[]): string {
    if (tools.length === 0) return '';

    let prompt = 'SYSTEM: You have access to these tools. When the user asks for something a tool can do, use the tool by responding ONLY with JSON.\n\nTOOLS:\n';
    for (const tool of tools) {
      prompt += `Name: ${tool.name}\nDescription: ${tool.description}\nParameters: ${JSON.stringify(tool.parameters.properties)}\n\n`;
    }
    prompt += 'TOOL CALL FORMAT: {"tool_call": {"name": "tool_name", "arguments": {...}}}\n\n';
    prompt += 'IMPORTANT: If you need to use a tool, your response must be ONLY the JSON above. No other text.\n\n';
    return prompt;
  }

  private parseToolCall(response: string): ToolCall | null {
    // Find the last complete JSON object in the response
    const lines = response.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('{') && line.endsWith('}')) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.tool_call && parsed.tool_call.name && parsed.tool_call.arguments) {
            return {
              id: `call_${Date.now()}`,
              name: parsed.tool_call.name,
              arguments: parsed.tool_call.arguments
            };
          }
        } catch (e) {
          // Not valid JSON, continue
        }
      }
    }
    return null;
  }

  private removeToolCallFromResponse(response: string, toolCall: ToolCall): string {
    // Remove the tool call JSON from the response
    const toolCallStr = JSON.stringify({ tool_call: { name: toolCall.name, arguments: toolCall.arguments } });
    return response.replace(toolCallStr, '').trim();
  }

  async generate(prompt: string, sessionId?: string | null): Promise<string> {
    const tools = this.toolManager.getToolDefinitions();
    const toolPrompt = this.buildToolPrompt(tools);
    const fullPrompt = prompt + '\n\n' + toolPrompt;

    console.log(`[TOOL_DEBUG] Tools available: ${tools.length}`);
    console.log(`[TOOL_DEBUG] Tool prompt length: ${toolPrompt.length}`);
    console.log(`[TOOL_DEBUG] Full prompt ends with: ${fullPrompt.slice(-200)}`);

    let response = await this.llm.generate(fullPrompt);
    console.log(`[TOOL_DEBUG] Response contains tool_call: ${response.includes('tool_call')}`);
    let toolCall = this.parseToolCall(response);

    while (toolCall) {
      try {
        const result = await this.toolManager.executeTool(toolCall.name, toolCall.arguments);
        logToolCall(toolCall.name, toolCall.arguments, result, sessionId);
        const toolResultPrompt = `\n\nTool result for ${toolCall.name}: ${JSON.stringify(result)}\n\n`;
        response = this.removeToolCallFromResponse(response, toolCall);
        const continuationPrompt = fullPrompt + response + toolResultPrompt;
        const continuationResponse = await this.llm.generate(continuationPrompt);
        response += continuationResponse;
        toolCall = this.parseToolCall(continuationResponse);
      } catch (error) {
        logToolCall(toolCall.name, toolCall.arguments, { error: (error as Error).message }, sessionId);
        const errorPrompt = `\n\nTool error for ${toolCall!.name}: ${(error as Error).message}\n\n`;
        response = this.removeToolCallFromResponse(response, toolCall!);
        const continuationPrompt = fullPrompt + response + errorPrompt;
        const continuationResponse = await this.llm.generate(continuationPrompt);
        response += continuationResponse;
        toolCall = this.parseToolCall(continuationResponse);
      }
    }

    return response;
  }

  async *generateStream(prompt: string, sessionId?: string | null): AsyncIterable<{ token?: string; finishReason?: string }> {
    const tools = this.toolManager.getToolDefinitions();
    const toolPrompt = this.buildToolPrompt(tools);
    const fullPrompt = prompt + '\n\n' + toolPrompt;

    let accumulatedResponse = '';
    let toolCall: ToolCall | null = null;

    // First stream: generate initial response
    for await (const chunk of this.llm.generateStream(fullPrompt)) {
      if (chunk.token) {
        accumulatedResponse += chunk.token;
        yield chunk;

        // Check if we have a complete tool call
        if (!toolCall) {
          toolCall = this.parseToolCall(accumulatedResponse);
          if (toolCall) {
            // Stop yielding tokens until tool is executed
            break;
          }
        }
      } else if (chunk.finishReason) {
        yield chunk;
        return;
      }
    }

    // If we have a tool call, execute it and continue streaming
    while (toolCall) {
      try {
        const result = await this.toolManager.executeTool(toolCall.name, toolCall.arguments);
        logToolCall(toolCall.name, toolCall.arguments, result, sessionId);
        const toolResultPrompt = `\n\nTool result for ${toolCall.name}: ${JSON.stringify(result)}\n\n`;
        accumulatedResponse = this.removeToolCallFromResponse(accumulatedResponse, toolCall);
        const continuationPrompt = fullPrompt + accumulatedResponse + toolResultPrompt;

        let continuationResponse = '';
        for await (const chunk of this.llm.generateStream(continuationPrompt)) {
          if (chunk.token) {
            continuationResponse += chunk.token;
            yield chunk;
          } else if (chunk.finishReason) {
            yield chunk;
            return;
          }
        }

        accumulatedResponse += continuationResponse;
        toolCall = this.parseToolCall(continuationResponse);
      } catch (error) {
        logToolCall(toolCall.name, toolCall.arguments, { error: (error as Error).message }, sessionId);
        const errorPrompt = `\n\nTool error for ${toolCall.name}: ${(error as Error).message}\n\n`;
        accumulatedResponse = this.removeToolCallFromResponse(accumulatedResponse, toolCall);
        const continuationPrompt = fullPrompt + accumulatedResponse + errorPrompt;

        let continuationResponse = '';
        for await (const chunk of this.llm.generateStream(continuationPrompt)) {
          if (chunk.token) {
            continuationResponse += chunk.token;
            yield chunk;
          } else if (chunk.finishReason) {
            yield chunk;
            return;
          }
        }

        accumulatedResponse += continuationResponse;
        toolCall = this.parseToolCall(continuationResponse);
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