import { ChatMessage } from './chat-history.js';

interface ChatMessageFormatter {
  historyMessage: (chatMessage: ChatMessage) => string;
  postLastHistoryMessage?: (chatMessage: ChatMessage) => string;
  preFirstMessage?: (chatMessage: ChatMessage) => string;
  postUserPrompt?: (prompt: string) => string;
  preUserPrompt?: (prompt: string) => string;
  userPrompt?: (prompt: string) => string;
}

export class FormatterRegistry {
  private static instance: FormatterRegistry;
  private formatters: Map<string, ChatMessageFormatter> = new Map();

  private constructor() {}

  static getInstance(): FormatterRegistry {
    if (!FormatterRegistry.instance) {
      FormatterRegistry.instance = new FormatterRegistry();
    }
    return FormatterRegistry.instance;
  }

  register(name: string, formatter: ChatMessageFormatter): void {
    this.formatters.set(name, formatter);
  }

  get(name: string): ChatMessageFormatter | undefined {
    return this.formatters.get(name);
  }

  getAvailableFormatters(): { name: string; functions: { [key: string]: string } }[] {
    return Array.from(this.formatters.entries()).map(([name, formatter]) => ({
      name,
      functions: {
        historyMessage: formatter.historyMessage.toString(),
        ...(formatter.postLastHistoryMessage && { postLastHistoryMessage: formatter.postLastHistoryMessage.toString() }),
        ...(formatter.preFirstMessage && { preFirstMessage: formatter.preFirstMessage.toString() }),
        ...(formatter.postUserPrompt && { postUserPrompt: formatter.postUserPrompt.toString() }),
        ...(formatter.preUserPrompt && { preUserPrompt: formatter.preUserPrompt.toString() }),
        ...(formatter.userPrompt && { userPrompt: formatter.userPrompt.toString() })
      }
    }));
  }
}

// Register chat history message formatters
const registry = FormatterRegistry.getInstance();
registry.register('chatHistoryMessageFormatter_Basic', {
  historyMessage: (chatMessage: ChatMessage) => {
    const actorLabel = chatMessage.actor === 'user' ? 'User' : 'Game Master';
    return `${actorLabel}: ${chatMessage.content}`;
  }
});

registry.register('chatHistoryMessageFormatter_Alpaca', {
  historyMessage: (chatMessage: ChatMessage) => {
    if (chatMessage.actor === 'user') {
      return `{{[INPUT]}}${chatMessage.content}`;
    } else {
      return `{{[OUTPUT]}}${chatMessage.content}`;
    }
  },
  postLastHistoryMessage: (chatMessage: ChatMessage) => {
    if (chatMessage.actor === 'user') {
      return `{{[OUTPUT]}}`;
    }
    return ``;
  },
  userPrompt: (prompt: string) => {
    return `{{[INPUT]}}${prompt}{{[OUTPUT]}}`
  }
});

registry.register('chatHistoryMessageFormatter_Verbatim', {
  historyMessage: (chatMessage: ChatMessage) => {
    return `${chatMessage.content}`;
  }
});