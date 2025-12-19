import { describe, test, expect, beforeEach } from 'bun:test';
import { MarkdownParser, MarkdownEventHandler } from '../lib/markdown-parser';
import { setupTestEnv } from './test-setup';

setupTestEnv();

class TestHandler implements MarkdownEventHandler {
  texts: string[] = [];
  quotes: string[] = [];
  bolds: string[] = [];
  emphases: string[] = [];
  codes: string[] = [];
  toolCalls: any[] = [];
  toolResults: any[] = [];
  reasonings: string[] = [];

  onText(text: string) {
    this.texts.push(text);
  }

  onQuote(content: string) {
    this.quotes.push(content);
  }

  onBold(content: string) {
    this.bolds.push(content);
  }

  onEmphasis(content: string) {
    this.emphases.push(content);
  }

  onCode(content: string) {
    this.codes.push(content);
  }

  onToolCall(toolCall: any) {
    this.toolCalls.push(toolCall);
  }

  onToolResult(toolResult: any) {
    this.toolResults.push(toolResult);
  }

  onReasoning(reasoning: string) {
    this.reasonings.push(reasoning);
  }
}

describe('MarkdownParser', () => {
  let parser: MarkdownParser;
  let handler: TestHandler;

  beforeEach(() => {
    parser = new MarkdownParser();
    handler = new TestHandler();
    parser.registerHandler(handler);
  });

  describe('plain text', () => {
    test('should emit text event for plain text', () => {
      parser.parse('hello world');
      expect(handler.texts).toEqual(['hello world']);
    });
  });

  describe('markdown formatting', () => {
    test('should parse bold text', () => {
      parser.parse('**bold** text');
      expect(handler.bolds).toEqual(['bold']);
      expect(handler.texts).toEqual([' text']);
    });

    test('should parse emphasis with asterisks', () => {
      parser.parse('*emphasis* text');
      expect(handler.emphases).toEqual(['emphasis']);
      expect(handler.texts).toEqual([' text']);
    });

    test('should parse emphasis with underscores', () => {
      parser.parse('_emphasis_ text');
      expect(handler.emphases).toEqual(['emphasis']);
      expect(handler.texts).toEqual([' text']);
    });

    test('should parse code', () => {
      parser.parse('`code` text');
      expect(handler.codes).toEqual(['code']);
      expect(handler.texts).toEqual([' text']);
    });

    test('should parse quote', () => {
      parser.parse('"quote" text');
      expect(handler.quotes).toEqual(['quote']);
      expect(handler.texts).toEqual([' text']);
    });
  });

  describe('tool calls', () => {
    test('should parse valid tool call', () => {
      const json = '{"name":"test","args":{}}';
      parser.parse(`text <|tool_call|>${json}<|tool_call_end|> more`);
      expect(handler.texts).toEqual(['text ', ' more']);
      expect(handler.toolCalls).toEqual([JSON.parse(json)]);
    });

    test('should handle invalid tool call JSON', () => {
      parser.parse('text <|tool_call|>invalid<|tool_call_end|> more');
      expect(handler.texts).toEqual(['text ', '<|tool_call|>invalid<|tool_call_end|>', ' more']);
      expect(handler.toolCalls).toEqual([]);
    });

    test('should handle unclosed tool call', () => {
      parser.parse('text <|tool_call|>open');
      expect(handler.texts).toEqual(['text ', '<|tool_call|>open']);
      expect(handler.toolCalls).toEqual([]);
    });
  });

  describe('tool results', () => {
    test('should parse valid tool result', () => {
      const json = '{"result":"ok"}';
      parser.parse(`before <|tool_result|>${json}<|tool_result_end|> after`);
      expect(handler.texts).toEqual(['before ', ' after']);
      expect(handler.toolResults).toEqual([JSON.parse(json)]);
    });

    test('should handle invalid tool result JSON', () => {
      parser.parse('before <|tool_result|>bad<|tool_result_end|> after');
      expect(handler.texts).toEqual(['before ', '<|tool_result|>bad<|tool_result_end|>', ' after']);
      expect(handler.toolResults).toEqual([]);
    });
  });

  describe('reasoning', () => {
    test('should parse reasoning block', () => {
      parser.parse('start <reasoning>thinking</reasoning> end');
      expect(handler.texts).toEqual(['start ', ' end']);
      expect(handler.reasonings).toEqual(['thinking']);
    });

    test('should handle unclosed reasoning', () => {
      parser.parse('start <reasoning>open');
      expect(handler.texts).toEqual(['start ', '<reasoning>open']);
      expect(handler.reasonings).toEqual([]);
    });
  });

  describe('mixed content', () => {
    test('should handle multiple elements', () => {
      parser.parse('**bold** *emphasis* `code`');
      expect(handler.bolds).toEqual(['bold']);
      expect(handler.emphases).toEqual(['emphasis']);
      expect(handler.codes).toEqual(['code']);
    });
  });
});