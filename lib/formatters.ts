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

  getAvailableFormatters(): { name: string; code: string }[] {
    return Array.from(this.formatters.entries()).map(([name, formatter]) => ({
      name,
      code: formatter.toString()
    }));
  }
}

// Register chat history message formatters
const registry = FormatterRegistry.getInstance();
registry.register('chatHistoryMessageFormatter_Basic', (message: ChatMessage) => {
  const actorLabel = message.actor === 'user' ? 'User' : 'Game Master';
  return `${actorLabel}: ${message.content}`;
});

registry.register('chatHistoryMessageFormatter_Alpaca', (message: ChatMessage) => {
  const actorLabel = message.actor === 'user' ? 'User' : 'Game Master';
  return `${actorLabel}: ${message.content}`;
});

registry.register('chatHistoryMessageFormatter_Verbatim', (message: ChatMessage) => {
  return `${message.content}`;
});