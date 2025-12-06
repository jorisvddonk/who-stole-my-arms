export interface ToolboxTool {
  init(toolboxCollector: any): void;
  getRoutes(): Record<string, any>;
}