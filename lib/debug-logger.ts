import type { MarkdownEventHandler } from './markdown-parser.js';

export class DebugLogger implements MarkdownEventHandler {
  onText(text: string) {
    console.log('MarkdownParser: text -', text);
  }

  onQuote(content: string) {
    console.log('MarkdownParser: quote -', content);
  }

  onBold(content: string) {
    console.log('MarkdownParser: bold -', content);
  }

  onEmphasis(content: string) {
    console.log('MarkdownParser: emphasis -', content);
  }

  onCode(content: string) {
    console.log('MarkdownParser: code -', content);
  }

  onToolCall(toolCall: any) {
    console.log('MarkdownParser: tool_call -', toolCall);
  }

  onToolResult(toolResult: any) {
    console.log('MarkdownParser: tool_result -', toolResult);
  }

  onReasoning(reasoning: string) {
    console.log('MarkdownParser: reasoning -', reasoning);
  }
}