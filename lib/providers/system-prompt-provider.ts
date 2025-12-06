import { PromptProvider, NamedGroup, PromptItem } from '../prompt-manager.js';

export class SystemPromptProvider implements PromptProvider {
  async getNamedPromptGroup(groupName: string, context?: any): Promise<NamedGroup | null> {
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
              prompt: 'You are a dungeon master AI assistant.',
              tags: ['system', 'role']
            },
            {
              type: 'prompt',
              name: 'response-style',
              prompt: 'Always respond in a fantastical manner that makes for an enjoyable game.',
              tags: ['system', 'style']
            }
          ]
        };

      default:
        return null;
    }
  }

  getAvailablePromptGroups(): string[] {
    return ['basic', 'advanced'];
  }
}