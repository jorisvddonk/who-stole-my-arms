import { PromptProvider, NamedGroup } from '../prompt-manager.js';
import { LLMToolManager } from '../llm-tool-manager.js';

export class ToolPromptProvider implements PromptProvider {
  constructor(private toolManager: LLMToolManager) {}

  async getNamedPromptGroup(groupName: string, context?: any): Promise<NamedGroup | null> {
    if (groupName === 'tools') {
      const tools = this.toolManager.getToolDefinitions();

      if (tools.length === 0) {
        return null;
      }

      const toolPrompts = tools.map(tool => ({
        type: 'prompt' as const,
        name: `tool-${tool.name}`,
        prompt: tool.prompt || `Tool: ${tool.name}\nDescription: ${tool.description}\nParameters: ${JSON.stringify(tool.parameters.properties)}`,
        tags: ['tools', tool.name]
      }));

      // Add the tool usage instructions - make them very prominent
      toolPrompts.unshift({
        type: 'prompt' as const,
        name: 'tool-usage',
        prompt: 'IMPORTANT TOOLS AVAILABLE:\nWhen the user asks you to perform an action that matches a tool, you MUST use that tool by responding with ONLY this exact format:\n<|tool_call|>{"name": "tool_name", "arguments": {...}}<|tool_call_end|>\n\nDo NOT respond with normal text when using tools. Only output the tool call format.\n\nAvailable tools:',
        tags: ['tools', 'usage']
      });

      return {
        type: 'group',
        name: 'tools',
        items: toolPrompts
      };
    }

    return null;
  }

  getAvailablePromptGroups(): { name: string; description: string }[] {
    return [
      { name: 'tools', description: 'Tool instructions and usage guidelines' }
    ];
  }
}