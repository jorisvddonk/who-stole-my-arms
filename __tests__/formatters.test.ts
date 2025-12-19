import { describe, test, expect } from 'bun:test';
import { FormatterRegistry } from '../lib/formatters';
import { setupTestEnv } from './test-setup';

setupTestEnv();

describe('FormatterRegistry', () => {
  describe('singleton pattern', () => {
    test('should return same instance', () => {
      const instance1 = FormatterRegistry.getInstance();
      const instance2 = FormatterRegistry.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('register and get', () => {
    test('should register and retrieve formatter', () => {
      const registry = FormatterRegistry.getInstance();
      const testFormatter = {
        historyMessage: (msg: any) => `Test: ${msg.content}`
      };

      registry.register('test-formatter', testFormatter);
      const retrieved = registry.get('test-formatter');

      expect(retrieved).toBe(testFormatter);
    });

    test('should return undefined for non-existent formatter', () => {
      const registry = FormatterRegistry.getInstance();

      const result = registry.get('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('getAvailableFormatters', () => {
    test('should return array of registered formatters with function strings', () => {
      const registry = FormatterRegistry.getInstance();
      const testFormatter = {
        historyMessage: (msg: any) => `Test: ${msg.content}`,
        postLastHistoryMessage: (msg: any) => 'Post',
        preFirstMessage: (msg: any) => 'Pre'
      };

      registry.register('test-formatter', testFormatter);
      const available = registry.getAvailableFormatters();

      const testEntry = available.find(f => f.name === 'test-formatter');
      expect(testEntry).toBeDefined();
      expect(testEntry!.functions.historyMessage).toContain('Test:');
      expect(testEntry!.functions.postLastHistoryMessage).toContain('Post');
      expect(testEntry!.functions.preFirstMessage).toContain('Pre');
    });
  });

  describe('registered formatters', () => {
    const testMessage = {
      id: '1',
      actor: 'user' as const,
      content: 'Hello world',
      finishedAt: new Date(),
      finishReason: null
    };

    const testGmMessage = {
      id: '2',
      actor: 'game-master' as const,
      content: 'Welcome!',
      finishedAt: new Date(),
      finishReason: null
    };

    describe('chatHistoryMessageFormatter_Basic', () => {
      test('should format user message', () => {
        const registry = FormatterRegistry.getInstance();
        const formatter = registry.get('chatHistoryMessageFormatter_Basic');

        const result = formatter!.historyMessage(testMessage);

        expect(result).toBe('User: Hello world');
      });

      test('should format game master message', () => {
        const registry = FormatterRegistry.getInstance();
        const formatter = registry.get('chatHistoryMessageFormatter_Basic');

        const result = formatter!.historyMessage(testGmMessage);

        expect(result).toBe('Game Master: Welcome!');
      });
    });

    describe('chatHistoryMessageFormatter_Alpaca', () => {
      test('should format user history message', () => {
        const registry = FormatterRegistry.getInstance();
        const formatter = registry.get('chatHistoryMessageFormatter_Alpaca');

        const result = formatter!.historyMessage(testMessage);

        expect(result).toBe('{{[INPUT]}}Hello world');
      });

      test('should format game master history message', () => {
        const registry = FormatterRegistry.getInstance();
        const formatter = registry.get('chatHistoryMessageFormatter_Alpaca');

        const result = formatter!.historyMessage(testGmMessage);

        expect(result).toBe('{{[OUTPUT]}}Welcome!');
      });

      test('should format post last history message for user', () => {
        const registry = FormatterRegistry.getInstance();
        const formatter = registry.get('chatHistoryMessageFormatter_Alpaca');

        const result = formatter!.postLastHistoryMessage!(testMessage);

        expect(result).toBe('{{[OUTPUT]}}');
      });

      test('should format post last history message for game master', () => {
        const registry = FormatterRegistry.getInstance();
        const formatter = registry.get('chatHistoryMessageFormatter_Alpaca');

        const result = formatter!.postLastHistoryMessage!(testGmMessage);

        expect(result).toBe('');
      });

      test('should format user prompt', () => {
        const registry = FormatterRegistry.getInstance();
        const formatter = registry.get('chatHistoryMessageFormatter_Alpaca');

        const result = formatter!.userPrompt!('Test prompt');

        expect(result).toBe('{{[INPUT]}}Test prompt{{[OUTPUT]}}');
      });
    });

    describe('chatHistoryMessageFormatter_Verbatim', () => {
      test('should format message content only', () => {
        const registry = FormatterRegistry.getInstance();
        const formatter = registry.get('chatHistoryMessageFormatter_Verbatim');

        const result = formatter!.historyMessage(testMessage);

        expect(result).toBe('Hello world');
      });
    });
  });
});