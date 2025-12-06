import { ChatMessage } from './chat-history.js';

export class FormatterRegistry {
  private static instance: FormatterRegistry;
  private formatters: Map<string, (input: any) => string> = new Map();

  private constructor() {}

  static getInstance(): FormatterRegistry {
    if (!FormatterRegistry.instance) {
      FormatterRegistry.instance = new FormatterRegistry();
    }
    return FormatterRegistry.instance;
  }

  register(name: string, formatter: (input: any) => string): void {
    this.formatters.set(name, formatter);
  }

  get(name: string): ((input: any) => string) | undefined {
    return this.formatters.get(name);
  }
}

// Register the chat history message formatter
const registry = FormatterRegistry.getInstance();
registry.register('chatHistoryMessageFormatter', (message: ChatMessage) => {
  const actorLabel = message.actor === 'user' ? 'User' : 'Game Master';
  return `${actorLabel}: ${message.content}`;
});