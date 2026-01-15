import { LLMAgent } from '../core/LLMAgent';
import { Task, ChunkType } from '../../interfaces/AgentTypes';
import { ComfyUISettingsTool } from '../tools/comfyui-settings-tool';
import { GenerateImageTool } from '../tools/GenerateImageTool';
import * as fs from 'fs';
import * as path from 'path';

export class ImageGenerationAgent extends LLMAgent {
  public supportsContinuation: boolean = true;
  private settingsTool: ComfyUISettingsTool;
  private generateImageTool: GenerateImageTool;
  private sceneDescription: string = '';
  private positivePrompt: string = '';
  private negativePrompt: string = '';
  private toolCallResultInput: string = '';
  private hasToolCallResult: boolean = false;

  constructor(streamingLLM: any, arena: any, comfyuiSettingsTool: ComfyUISettingsTool) {
    super(streamingLLM, arena);
    this.settingsTool = comfyuiSettingsTool;
    this.generateImageTool = new GenerateImageTool(comfyuiSettingsTool);
    this.registerTool(this.generateImageTool);
  }

  async run(task: Task): Promise<string | { content: string, annotation?: any, annotations?: Record<string, any> }> {
    this.currentTask = task;
    this.hasToolCallResult = false;
    this.toolCallResultInput = '';
    this.sceneDescription = '';
    this.positivePrompt = '';
    this.negativePrompt = '';

    const prompt = await this.buildPrompt(task);

    if (this.hasToolCallResult) {
      console.log('Tool call result:', this.toolCallResultInput);
      const jsonMatch = this.toolCallResultInput.match(/<\|tool_result\|>(.*)<\|tool_result_end\|>/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[1]);
        if (Array.isArray(result) && result.length > 0) {
          const imagePath = result[0].path;
          const filename = result[0].filename;
          return {
            content: `Image generated: /images/${imagePath}`,
            annotations: {
              'tool.image.result': result,
              'tool.image.file': imagePath
            }
          };
        }
      }
      return { content: this.toolCallResultInput };
    }

    return this.postProcessResponse('');
  }

  async buildPrompt(task: Task): Promise<string> {
    const input = this.getInputTextOrToolOutput(task);

    const lastChunk = task.scratchpad.filter(c => (c.type === ChunkType.Input || c.type === ChunkType.ToolOutput)).pop();
    if (lastChunk && lastChunk.type === ChunkType.ToolOutput) {
      this.hasToolCallResult = true;
      this.toolCallResultInput = input;
      return '';
    }

    this.sceneDescription = await this.generateStreamingResponse(
      `You are an image description generator. Describe the scene in detail based on this request: "${input}"

Provide a vivid, detailed description of the scene that would be suitable for image generation. Focus on:
- Main subject(s) and their appearance
- Setting/environment details
- Lighting and mood
- Composition and framing
- Any important details that should be included

Description:`
    );

    this.positivePrompt = await this.generateStreamingResponse(
      `Convert this scene description into a detailed Stable Diffusion image generation prompt.

Scene description: ${this.sceneDescription}

Guidelines for positive prompts:
- Be specific and descriptive
- Include quality keywords (e.g., "highly detailed", "8k", "masterpiece")
- Include style keywords (e.g., "photorealistic", "digital art", "oil painting")
- Include lighting and composition details
- Separate different concepts with commas

Generate ONLY the positive prompt, no explanations:`
    );

    this.negativePrompt = await this.generateStreamingResponse(
      `Generate a negative prompt for Stable Diffusion to avoid bad quality based on this scene description.

Scene description: ${this.sceneDescription}

Guidelines for negative prompts:
- Include common quality issues (blurry, low quality, distorted, etc.)
- Include unwanted styles or elements
- Be specific about what to avoid

Generate ONLY the negative prompt, no explanations:`
    );

    return '';
  }

  postProcessResponse(response: string): string | { content: string, annotation?: any, annotations?: Record<string, any> } {
    if (this.hasToolCallResult) {
      return {
        content: this.toolCallResultInput
      };
    }

    if (!this.currentTask) {
      throw new Error('No current task');
    }

    const taskId = this.currentTask.id || 'unknown';
    const agentName = this.constructor.name;
    const now = new Date();
    const timeHHMMSS = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
    const filename = `${taskId}_${agentName}_${timeHHMMSS}.png`;
    const outputDir = path.join(process.cwd(), 'generated', 'images');
    const outputPath = path.join(outputDir, filename);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const seed = -1;
    const workflow = undefined;

    const toolCall = `<|tool_call|>{"name": "GenerateImage", "parameters": ${JSON.stringify({
      positive_prompt: this.positivePrompt,
      negative_prompt: this.negativePrompt,
      seed: seed,
      workflow: workflow,
      filename: filename
    })}}<|tool_call_end|>`;

    return {
      content: toolCall,
      annotations: {
        'tools.image.generation': {
          sceneDescription: this.sceneDescription,
          positivePrompt: this.positivePrompt,
          negativePrompt: this.negativePrompt,
          filename: filename,
          outputPath: outputPath
        }
      }
    };
  }
}
