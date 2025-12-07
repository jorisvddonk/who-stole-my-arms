import { LLMTool } from '../interfaces/LLMTool.js';

export class LLMToolManager {
  private tools: Map<string, LLMTool> = new Map();

  registerTool(tool: LLMTool) {
    this.tools.set(tool.name, tool);
  }

  getTools(): LLMTool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): LLMTool | undefined {
    return this.tools.get(name);
  }

  async executeTool(name: string, args: Record<string, any>): Promise<any> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }
    return await tool.execute(args);
  }

  getToolDefinitions(): LLMTool[] {
    return this.getTools();
  }
}