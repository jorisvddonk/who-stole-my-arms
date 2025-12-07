export interface LLMTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  prompt?: string; // Optional custom prompt for this tool
  execute: (args: Record<string, any>) => Promise<any>;
}