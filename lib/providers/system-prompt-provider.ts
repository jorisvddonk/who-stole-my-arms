import { PromptProvider, NamedGroup, PromptItem } from '../prompt-manager.js';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { Logger } from '../logging/debug-logger.js';

export class SystemPromptProvider implements PromptProvider {
  private customPrompts: Record<string, NamedGroup> = {};

  constructor() {
    if (existsSync('system-prompts.json')) {
      try {
        const data = readFileSync('system-prompts.json', 'utf-8');
        this.customPrompts = JSON.parse(data);
      } catch (error) {
        Logger.debugLog("Invalid json for system-prompts.json, ignoring");
        // Invalid JSON, ignore
      }
    }

    // Load additional prompts from environment variable paths
    const searchPaths = process.env.WSMA_SYSTEM_PROMPT_SEARCH_PATH;
    if (searchPaths) {
      const paths = searchPaths.split(';').map(p => p.trim()).filter(p => p);
      for (const promptsPath of paths) {
        try {
          const files = readdirSync(promptsPath);
          for (const file of files) {
            if (extname(file) === '.json') {
              const filePath = join(promptsPath, file);
              Logger.debugLog(`Attempting to load prompts from: ${filePath}`);
              try {
                const data = readFileSync(filePath, 'utf-8');
                const additionalPrompts = JSON.parse(data);
                const count = Object.keys(additionalPrompts).length;
                this.customPrompts = { ...this.customPrompts, ...additionalPrompts };
                Logger.debugLog(`Successfully loaded ${count} prompt groups from ${filePath}`);
              } catch (error) {
                Logger.debugLog(`Invalid JSON in ${filePath}, ignoring`);
              }
            }
          }
        } catch (error) {
          Logger.debugLog(`Failed to read prompts path ${promptsPath}: ${error}`);
        }
      }
    }
  }
  async getNamedPromptGroup(groupName: string, context?: any): Promise<NamedGroup | null> {
    if (this.customPrompts[groupName]) {
      return this.customPrompts[groupName];
    }

    switch (groupName) {
      case 'basic':
        return {
          type: 'group',
          name: 'basic',
          items: [
            {
              type: 'prompt',
              name: 'system-role',
              prompt: 'You are a dungeon master AI assistant, conducting a fantastical roleplaying game!',
              tags: ['system', 'role']
            }
          ]
        };

       case 'advanced':
         return {
           type: 'group',
           name: 'advanced',
           items: [
             {
               type: 'prompt',
               name: 'system-role',
               prompt: 'You are an AI assistant with access to tools. Use tools when they would be helpful for the user\'s request.',
               tags: ['system', 'role']
             },
             {
               type: 'prompt',
               name: 'response-style',
               prompt: 'Be helpful and use available tools when appropriate.',
               tags: ['system', 'style']
             }
           ]
         };

      default:
        return null;
    }
  }

  getAvailablePromptGroups(): { name: string; description: string }[] {
    const groups = [
      { name: 'basic', description: 'Simple system prompt' },
      { name: 'advanced', description: 'Detailed system prompt with formatting' }
    ];

    for (const name in this.customPrompts) {
      const group = this.customPrompts[name];
      groups.push({ name, description: group.description || `Custom prompt group: ${name}` });
    }

    return groups;
  }
}