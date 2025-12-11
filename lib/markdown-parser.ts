type EventListener = (...args: any[]) => void;

export interface MarkdownEventHandler {
  onText(text: string): void;
  onQuote(content: string): void;
  onBold(content: string): void;
  onEmphasis(content: string): void;
  onCode(content: string): void;
  onToolCall(toolCall: any): void;
  onToolResult(toolResult: any): void;
  onReasoning(reasoning: string): void;
}

class EventEmitter {
  private listeners: { [event: string]: EventListener[] } = {};

  on(event: string, listener: EventListener) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(listener);
  }

  emit(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(listener => listener(...args));
    }
  }
}

export class MarkdownParser extends EventEmitter {
  constructor() {
    super();
  }

  registerHandler(handler: MarkdownEventHandler) {
    this.on('text', handler.onText.bind(handler));
    this.on('quote', handler.onQuote.bind(handler));
    this.on('bold', handler.onBold.bind(handler));
    this.on('emphasis', handler.onEmphasis.bind(handler));
    this.on('code', handler.onCode.bind(handler));
    this.on('tool_call', handler.onToolCall.bind(handler));
    this.on('tool_result', handler.onToolResult.bind(handler));
    this.on('reasoning', handler.onReasoning.bind(handler));
  }

  parse(text: string) {
    const toolCallTag = '<|tool_call|>';
    const toolCallEndTag = '<|tool_call_end|>';
    const toolResultTag = '<|tool_result|>';
    const toolResultEndTag = '<|tool_result_end|>';
    const reasoningTag = '<reasoning>';
    const reasoningEndTag = '</reasoning>';
    let pos = 0;
    while (pos < text.length) {
      let callStart = text.indexOf(toolCallTag, pos);
      let resultStart = text.indexOf(toolResultTag, pos);
      let reasoningStart = text.indexOf(reasoningTag, pos);
      // Find the earliest tag
      let earliest = Math.min(
        callStart !== -1 ? callStart : Infinity,
        resultStart !== -1 ? resultStart : Infinity,
        reasoningStart !== -1 ? reasoningStart : Infinity
      );
      if (earliest === Infinity) {
        let plainText = text.slice(pos);
        this.parseMarkdown(plainText);
        break;
      }
      if (earliest === callStart) {
        // process tool_call
        let plainText = text.slice(pos, callStart);
        this.parseMarkdown(plainText);
        let callEnd = text.indexOf(toolCallEndTag, callStart);
        if (callEnd === -1) {
          plainText = text.slice(callStart);
          this.parseMarkdown(plainText);
          break;
        }
        let json = text.slice(callStart + toolCallTag.length, callEnd);
        try {
          const toolCall = JSON.parse(json);
          this.emit('tool_call', toolCall);
        } catch (e) {
          plainText = text.slice(callStart, callEnd + toolCallEndTag.length);
          this.parseMarkdown(plainText);
        }
        pos = callEnd + toolCallEndTag.length;
      } else if (earliest === resultStart) {
        // process tool_result
        let plainText = text.slice(pos, resultStart);
        this.parseMarkdown(plainText);
        let resultEnd = text.indexOf(toolResultEndTag, resultStart);
        if (resultEnd === -1) {
          plainText = text.slice(resultStart);
          this.parseMarkdown(plainText);
          break;
        }
        let json = text.slice(resultStart + toolResultTag.length, resultEnd);
        try {
          const toolResult = JSON.parse(json);
          this.emit('tool_result', toolResult);
        } catch (e) {
          plainText = text.slice(resultStart, resultEnd + toolResultEndTag.length);
          this.parseMarkdown(plainText);
        }
        pos = resultEnd + toolResultEndTag.length;
      } else if (earliest === reasoningStart) {
        // process reasoning
        let plainText = text.slice(pos, reasoningStart);
        this.parseMarkdown(plainText);
        let reasoningEnd = text.indexOf(reasoningEndTag, reasoningStart);
        if (reasoningEnd === -1) {
          plainText = text.slice(reasoningStart);
          this.parseMarkdown(plainText);
          break;
        }
        let reasoningText = text.slice(reasoningStart + reasoningTag.length, reasoningEnd);
        this.emit('reasoning', reasoningText);
        pos = reasoningEnd + reasoningEndTag.length;
      }
    }
  }

  private parseMarkdown(text: string) {
    let pos = 0;
    const patterns = [
      { regex: /"([^"]*)"/g, type: 'quote' },
      { regex: /\*\*([^*]*)\*\*/g, type: 'bold' },
      { regex: /\*([^*]*)\*/g, type: 'emphasis' },

       { regex: /(?<!\w)_([^_]+)_(?!\w)/g, type: 'emphasis' },
      { regex: /`([^`]*)`/g, type: 'code' }
    ];
    while (pos < text.length) {
      let earliestMatch: { match: RegExpExecArray; type: string; regex: RegExp } | null = null;
      let earliestIndex = text.length;
      for (const { regex, type } of patterns) {
        regex.lastIndex = pos;
        const match = regex.exec(text);
        if (match && match.index < earliestIndex) {
          earliestMatch = { match, type, regex };
          earliestIndex = match.index;
        }
      }
      if (!earliestMatch) {
        const plain = text.slice(pos);
        if (plain) {
          this.emit('text', plain);
        }
        break;
      }
      if (earliestMatch.match.index > pos) {
        const plain = text.slice(pos, earliestMatch.match.index);
        this.emit('text', plain);
      }
      this.emit(earliestMatch.type, earliestMatch.match[1]);
      pos = earliestMatch.regex.lastIndex;
    }
  }
}