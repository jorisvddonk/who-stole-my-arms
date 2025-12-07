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
    return [
      { name: 'basic', description: 'Simple system prompt' },
      { name: 'advanced', description: 'Detailed system prompt with formatting' }
    ];
  }
}