export class ToolboxCollector {
  private tools: string[] = [];

  register(url: string) {
    this.tools.push(url);
  }

  getTools(): string[] {
    return [...this.tools];
  }
}

export const toolboxCollector = new ToolboxCollector();