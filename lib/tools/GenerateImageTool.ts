import { Tool } from '../core/Tool';
import { Task } from '../../interfaces/AgentTypes';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ComfyUISettingsTool } from './comfyui-settings-tool';

interface ComfyUIWorkflow {
  [key: string]: any;
}

export class GenerateImageTool extends Tool {
  readonly name = 'GenerateImage';
  readonly description = 'Generate an image using ComfyUI based on positive and negative prompts. Supports workflows with ImpactWildcardEncode or CLIPTextEncode nodes. Uses default workflow by default.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      positive_prompt: {
        type: 'string',
        description: 'The positive prompt for image generation.'
      },
      negative_prompt: {
        type: 'string',
        description: 'The negative prompt for image generation.'
      },
      seed: {
        type: 'number',
        description: 'Seed for reproducible generation, -1 for random.',
        default: -1
      },
      workflow: {
        type: 'object',
        description: 'Custom ComfyUI workflow JSON. If not provided, uses default workflow.'
      },
      filename: {
        type: 'string',
        description: 'Optional filename for the output image.'
      }
    },
    required: ['positive_prompt']
  };
  readonly prompt = `Tool: GenerateImage
 Description: Generate an image using ComfyUI based on positive and negative prompts.
 Parameters: ${JSON.stringify(this.parameters.properties)}`;

  private settingsTool: ComfyUISettingsTool;

  constructor(settingsTool: ComfyUISettingsTool) {
    super();
    this.settingsTool = settingsTool;
  }

  private setNestedValue(obj: any, path: string, value: any) {
    const keys = path.split('.');
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
  }

  async run(parameters: { positive_prompt: string, negative_prompt?: string, seed?: number, workflow?: ComfyUIWorkflow, filename?: string }, context?: { arena: any, task: Task }): Promise<any> {
    console.log('GenerateImage run, parameters keys:', Object.keys(parameters));
    const { positive_prompt, negative_prompt = "", seed = -1, workflow: customWorkflow, filename } = parameters;
    const settings = this.settingsTool.getSettings();
    const outputFolder = settings.outputFolder;
    console.log('customWorkflow defined:', !!customWorkflow);

    let workflow: ComfyUIWorkflow;
    if (customWorkflow) {
      workflow = JSON.parse(JSON.stringify(customWorkflow));
    } else {
      const workflowPath = path.resolve(settings.workflowPath);
      if (fs.existsSync(workflowPath)) {
        workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
      } else {
        throw new Error(`Default workflow not found at ${workflowPath}`);
      }
    }

    let outputFilename = filename;

    let positiveNodeId: string | null = null;
    let negativeNodeId: string | null = null;
    let seedNodeId: string | null = null;

    for (const nodeId in workflow) {
      const node = workflow[nodeId];
      if (node.class_type === 'ImpactWildcardEncode' && node.inputs) {
        const title = node._meta?.title || '';
        if (title.toLowerCase().includes('positive')) {
          positiveNodeId = nodeId;
          if (!node.inputs.original_wildcard_text) {
            node.inputs.original_wildcard_text = node.inputs.wildcard_text || '';
          }
          node.inputs.wildcard_text = positive_prompt;
          node.inputs.populated_text = positive_prompt;
        } else if (title.toLowerCase().includes('negative')) {
          negativeNodeId = nodeId;
          if (!node.inputs.original_wildcard_text) {
            node.inputs.original_wildcard_text = node.inputs.wildcard_text || '';
          }
          node.inputs.wildcard_text = negative_prompt;
          node.inputs.populated_text = negative_prompt;
        }
      } else if (node.class_type === 'CLIPTextEncode' && node.inputs) {
        const title = node._meta?.title || '';
        if (title.toLowerCase().includes('positive') && !positiveNodeId) {
          positiveNodeId = nodeId;
          if (!node.inputs.original_text) {
            node.inputs.original_text = node.inputs.text || '';
          }
          node.inputs.text = positive_prompt;
        } else if (title.toLowerCase().includes('negative') && !negativeNodeId) {
          negativeNodeId = nodeId;
          if (!node.inputs.original_text) {
            node.inputs.original_text = node.inputs.text || '';
          }
          node.inputs.text = negative_prompt;
        } else if (!positiveNodeId) {
          positiveNodeId = nodeId;
          if (!node.inputs.original_text) {
            node.inputs.original_text = node.inputs.text || '';
          }
          node.inputs.text = positive_prompt;
        } else if (!negativeNodeId) {
          negativeNodeId = nodeId;
          if (!node.inputs.original_text) {
            node.inputs.original_text = node.inputs.text || '';
          }
          node.inputs.text = negative_prompt;
        }
      } else if ((node.class_type === 'Seed (rgthree)' || node.class_type === 'Seed') && node.inputs) {
        seedNodeId = nodeId;
        node.inputs.seed = seed === -1 ? Math.floor(Math.random() * 1000000) : seed;
      } else if (node.class_type === 'KSampler' && node.inputs && !seedNodeId && node.inputs.seed && typeof node.inputs.seed === 'number') {
        seedNodeId = nodeId;
        node.inputs.seed = seed === -1 ? Math.floor(Math.random() * 1000000) : seed;
      }
    }

    if (outputFilename && workflow) {
      if (!outputFilename.endsWith('.png')) {
        outputFilename += '.png';
      }
      for (const nodeId in workflow) {
        const node = workflow[nodeId];
        if (node.class_type === 'SaveImage') {
          if (node.inputs?.filename_prefix) {
            node.inputs.filename_prefix = outputFilename.replace('.png', '');
          } else if (node.inputs?.filename) {
            node.inputs.filename = outputFilename;
          }
        } else if (node.class_type === 'Image Saver Simple') {
          if (node.inputs?.filename) {
            node.inputs.filename = outputFilename.replace('.png', '');
          }
          if (node.inputs?.path) {
            node.inputs.path = outputFolder;
          }
        }
      }
    }

    // const patchedWorkflowPath = '/tmp/comfyui-patched-workflow.json';
    // fs.writeFileSync(patchedWorkflowPath, JSON.stringify(workflow, null, 2));

    const clientId = "wsma_" + Date.now();

    if (settings.debugBypass || process.env.DEBUG_BYPASS === 'true') {
      return [{
        filename: outputFilename || "test123.png",
        subfolder: "test",
        type: "output",
        path: path.join(process.cwd(), 'generated', 'images', outputFilename || "test123.png")
      }];
    }

    const queueResponse = await this.sendRequest(settings.host, settings.port, '/prompt', {
      prompt: workflow,
      client_id: clientId
    });

    if (!queueResponse.prompt_id) {
      throw new Error('Failed to queue prompt: ' + JSON.stringify(queueResponse));
    }

    const promptId = queueResponse.prompt_id;

    let attempts = 0;
    const maxAttempts = 60;
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const history = await this.sendRequest(settings.host, settings.port, '/history/' + promptId, {}, 'GET');

      if (history && history[promptId] && history[promptId].status?.completed) {
        const outputs = history[promptId].outputs;
        let allImages: any[] = [];
        for (const nodeId in outputs) {
          if (outputs[nodeId].images && outputs[nodeId].images.length > 0) {
            const images = outputs[nodeId].images.filter((img: any) => img.type === "output").map((img: any) => {
              const base = outputFolder;
              let imagePath;
              if (img.filename.startsWith('/')) {
                imagePath = img.filename;
              } else if (img.subfolder && img.subfolder.startsWith('/')) {
                imagePath = `${img.subfolder}/${img.filename}`;
              } else {
                const relativePath = img.subfolder ? `${img.subfolder}/${img.filename}` : img.filename;
                imagePath = `${base}/${relativePath}`;
              }
              return { ...img, type: "output", path: imagePath };
            });
            allImages.push(...images);
          }
        }
        if (allImages.length > 0) {
          return allImages;
        }
      }

      attempts++;
    }

    throw new Error('Image generation timed out');
  }

  private async sendRequest(host: string, port: number, path: string, data?: any, method: string = 'POST'): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: host,
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }
}
