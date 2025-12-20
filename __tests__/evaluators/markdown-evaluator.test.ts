import { describe, test, expect, beforeEach } from 'bun:test';
import { MarkdownEvaluator } from '../../lib/evaluators/MarkdownEvaluator';
import { Chunk, ChunkType } from '../../interfaces/AgentTypes';
import { setupTestEnv } from '../test-setup';

setupTestEnv();

describe('MarkdownEvaluator', () => {
    let evaluator: MarkdownEvaluator;

    beforeEach(() => {
        evaluator = new MarkdownEvaluator();
    });

    describe('properties', () => {
        test('should have correct fqdn', () => {
            expect(evaluator.fqdn).toBe('evaluators.MarkdownEvaluator');
        });

        test('should support LLM output chunks', () => {
            expect(evaluator.supportedChunkTypes).toEqual([ChunkType.LlmOutput]);
        });
    });

    describe('evaluate', () => {
        test('should parse plain text', async () => {
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'This is plain text',
                processed: false
            };

            const result = await evaluator.evaluate(chunk);

            expect(result.annotation).toEqual({
                parsedMarkdown: [
                    {
                        type: 'text',
                        content: 'This is plain text',
                        start: 0,
                        end: 18
                    }
                ]
            });
        });

        test('should parse text with markdown formatting', async () => {
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'This is **bold** and *italic* text with `code` and "quotes"',
                processed: false
            };

            const result = await evaluator.evaluate(chunk);

            expect(result.annotation.parsedMarkdown).toEqual([
                { type: 'text', content: 'This is ', start: 0, end: 8 },
                { type: 'bold', content: 'bold', start: 8, end: 16 },
                { type: 'text', content: ' and ', start: 16, end: 21 },
                { type: 'emphasis', content: 'italic', start: 21, end: 29 },
                { type: 'text', content: ' text with ', start: 29, end: 40 },
                { type: 'code', content: 'code', start: 40, end: 46 },
                { type: 'text', content: ' and ', start: 46, end: 51 },
                { type: 'quote', content: 'quotes', start: 51, end: 59 }
            ]);
        });

        test('should parse tool call', async () => {
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'Let me check the weather<|tool_call|>{"name": "weather", "args": {}}<|tool_call_end|>',
                processed: false
            };

            const result = await evaluator.evaluate(chunk);

            expect(result.annotation.parsedMarkdown).toEqual([
                { type: 'text', content: 'Let me check the weather', start: 0, end: 24 },
                { type: 'tool_call', content: '{"name": "weather", "args": {}}', start: 24, end: 85 }
            ]);
        });

        test('should parse tool result', async () => {
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: '<|tool_result|>{"temperature": 20}<|tool_result_end|>It\'s 20 degrees',
                processed: false
            };

            const result = await evaluator.evaluate(chunk);

            expect(result.annotation.parsedMarkdown).toEqual([
                { type: 'tool_result', content: '{"temperature": 20}', start: 0, end: 53 },
                { type: 'text', content: 'It\'s 20 degrees', start: 53, end: 68 }
            ]);
        });

        test('should parse reasoning tags', async () => {
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'I need to think<br><reasoning>This is my reasoning</reasoning>Therefore...',
                processed: false
            };

            const result = await evaluator.evaluate(chunk);

            expect(result.annotation.parsedMarkdown).toEqual([
                { type: 'text', content: 'I need to think<br>', start: 0, end: 19 },
                { type: 'reasoning', content: 'This is my reasoning', start: 19, end: 62 },
                { type: 'text', content: 'Therefore...', start: 62, end: 74 }
            ]);
        });

        test('should handle malformed tool call JSON', async () => {
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'Testing<|tool_call|>invalid json<|tool_call_end|>',
                processed: false
            };

            const result = await evaluator.evaluate(chunk);

            expect(result.annotation.parsedMarkdown).toEqual([
                { type: 'text', content: 'Testing', start: 0, end: 7 },
                { type: 'text', content: '<|tool_call|>invalid json<|tool_call_end|>', start: 7, end: 49 }
            ]);
        });

        test('should handle unclosed tool call', async () => {
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'Testing<|tool_call|>{"name": "test"}',
                processed: false
            };

            const result = await evaluator.evaluate(chunk);

            expect(result.annotation.parsedMarkdown).toEqual([
                { type: 'text', content: 'Testing', start: 0, end: 7 },
                { type: 'text', content: '<|tool_call|>{', start: 7, end: 21 },
                { type: 'quote', content: 'name', start: 21, end: 27 },
                { type: 'text', content: ': ', start: 27, end: 29 },
                { type: 'quote', content: 'test', start: 29, end: 35 },
                { type: 'text', content: '}', start: 35, end: 36 }
            ]);
        });

        test('should handle unclosed reasoning tag', async () => {
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'Testing<br><reasoning>Unclosed reasoning',
                processed: false
            };

            const result = await evaluator.evaluate(chunk);

            expect(result.annotation.parsedMarkdown).toEqual([
                { type: 'text', content: 'Testing<br>', start: 0, end: 11 },
                { type: 'text', content: '<reasoning>Unclosed reasoning', start: 11, end: 40 }
            ]);
        });

        test('should handle mixed content', async () => {
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'First **bold** then<|tool_call|>{"test": true}<|tool_call_end|>finally *italic*',
                processed: false
            };

            const result = await evaluator.evaluate(chunk);

            expect(result.annotation.parsedMarkdown).toEqual([
                { type: 'text', content: 'First ', start: 0, end: 6 },
                { type: 'bold', content: 'bold', start: 6, end: 14 },
                { type: 'text', content: ' then', start: 14, end: 19 },
                { type: 'tool_call', content: '{"test": true}', start: 19, end: 63 },
                { type: 'text', content: 'finally ', start: 63, end: 71 },
                { type: 'emphasis', content: 'italic', start: 71, end: 79 }
            ]);
        });

        test('should handle unclosed reasoning tag', async () => {
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'Testing<br><reasoning>Unclosed reasoning',
                processed: false
            };

            const result = await evaluator.evaluate(chunk);

            expect(result.annotation.parsedMarkdown).toEqual([
                { type: 'text', content: 'Testing<br>', start: 0, end: 11 },
                { type: 'text', content: '<reasoning>Unclosed reasoning', start: 11, end: 40 }
            ]);
        });

        test('should handle mixed content', async () => {
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'First **bold** then<|tool_call|>{"test": true}<|tool_call_end|>finally *italic*',
                processed: false
            };

            const result = await evaluator.evaluate(chunk);

            expect(result.annotation.parsedMarkdown).toEqual([
                { type: 'text', content: 'First ', start: 0, end: 6 },
                { type: 'bold', content: 'bold', start: 6, end: 14 },
                { type: 'text', content: ' then', start: 14, end: 19 },
                { type: 'tool_call', content: '{"test": true}', start: 19, end: 63 },
                { type: 'text', content: 'finally ', start: 63, end: 71 },
                { type: 'emphasis', content: 'italic', start: 71, end: 79 }
            ]);
        });

        test('should handle empty content', async () => {
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: '',
                processed: false
            };

            const result = await evaluator.evaluate(chunk);

            expect(result.annotation.parsedMarkdown).toEqual([]);
        });

        test('should handle content with only special tags', async () => {
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: '<|tool_call|>{"name": "test"}<|tool_call_end|>',
                processed: false
            };

            const result = await evaluator.evaluate(chunk);

            expect(result.annotation.parsedMarkdown).toEqual([
                { type: 'tool_call', content: '{"name": "test"}', start: 0, end: 46 }
            ]);
        });
    });

    describe('parseMarkdownText', () => {
        test('should parse multiple markdown elements', () => {
            const result = (evaluator as any).parseMarkdownText('**bold** and *italic* with `code`', 10);

            expect(result).toEqual([
                { type: 'bold', content: 'bold', start: 10, end: 18 },
                { type: 'text', content: ' and ', start: 18, end: 23 },
                { type: 'emphasis', content: 'italic', start: 23, end: 31 },
                { type: 'text', content: ' with ', start: 31, end: 37 },
                { type: 'code', content: 'code', start: 37, end: 43 }
            ]);
        });

        test('should handle overlapping patterns correctly', () => {
            const result = (evaluator as any).parseMarkdownText('**bold** *italic*', 0);

            expect(result).toEqual([
                { type: 'bold', content: 'bold', start: 0, end: 8 },
                { type: 'text', content: ' ', start: 8, end: 9 },
                { type: 'emphasis', content: 'italic', start: 9, end: 17 }
            ]);
        });

        test('should handle underscore emphasis', () => {
            const result = (evaluator as any).parseMarkdownText('word _emphasis_ word', 0);

            expect(result).toEqual([
                { type: 'text', content: 'word ', start: 0, end: 5 },
                { type: 'emphasis', content: 'emphasis', start: 5, end: 15 },
                { type: 'text', content: ' word', start: 15, end: 20 }
            ]);
        });

        test('should handle quotes', () => {
            const result = (evaluator as any).parseMarkdownText('"quoted text" here', 5);

            expect(result).toEqual([
                { type: 'quote', content: 'quoted text', start: 5, end: 18 },
                { type: 'text', content: ' here', start: 18, end: 23 }
            ]);
        });
    });
});