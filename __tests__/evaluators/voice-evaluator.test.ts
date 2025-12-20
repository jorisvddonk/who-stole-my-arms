import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { VoiceEvaluator } from '../../lib/evaluators/VoiceEvaluator';
import { Chunk, ChunkType } from '../../interfaces/AgentTypes';
import { voiceEmitter } from '../../lib/voice-emitter';
import { setupTestEnv } from '../test-setup';

setupTestEnv();

describe('VoiceEvaluator', () => {
    let mockFetch: any;
    let mockEmit: any;
    let mockReadFileSync: any;

    beforeEach(() => {
        // Mock fetch for HTTP requests
        mockFetch = mock(() => Promise.resolve({
            ok: true,
            blob: () => Promise.resolve(new Blob(['audio data'], { type: 'audio/wav' }))
        }));
        global.fetch = mockFetch;

        // Mock voiceEmitter
        mockEmit = mock(() => undefined);
        voiceEmitter.emit = mockEmit;

        // Mock file system
        mockReadFileSync = mock(() => { throw new Error('ENOENT'); });
        mock.module('fs', () => ({
            readFileSync: mockReadFileSync
        }));
    });

    afterEach(() => {
        mock.restore();
    });

    describe('constructor', () => {
        test('should have correct fqdn and supported chunk types', () => {
            const evaluator = new VoiceEvaluator();
            expect(evaluator.fqdn).toBe('evaluators.VoiceEvaluator');
            expect(evaluator.supportedChunkTypes).toEqual([ChunkType.LlmOutput]);
        });

        test('should load default settings when file not found', () => {
            const evaluator = new VoiceEvaluator();
            expect(evaluator).toBeInstanceOf(VoiceEvaluator);
            // Constructor should not throw
        });

        test('should load settings from file when exists', () => {
            const customSettings = {
                voices: {
                    text: 'Custom.wav',
                    quote: 'Quote.wav'
                },
                generation: {
                    temperature: 0.9,
                    exaggeration: 0.7
                }
            };
            mockReadFileSync.mockReturnValue(JSON.stringify(customSettings));

            const evaluator = new VoiceEvaluator();

            // Test that settings are loaded by evaluating a chunk
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'test content',
                processed: false,
                annotations: {
                    'evaluators.MarkdownEvaluator': {
                        parsedMarkdown: [
                            { type: 'text', content: 'hello', start: 0, end: 5 }
                        ]
                    }
                }
            };

            evaluator.evaluate(chunk);
        });

        test('should merge provided voice config with defaults', () => {
            const voiceConfig = {
                voices: {
                    bold: 'Bold.wav'
                },
                generation: {
                    temperature: 0.6
                }
            };

            const evaluator = new VoiceEvaluator(voiceConfig);

            // Test by evaluating chunk with bold text
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'test',
                processed: false,
                annotations: {
                    'evaluators.MarkdownEvaluator': {
                        parsedMarkdown: [
                            { type: 'bold', content: 'bold text', start: 0, end: 9 }
                        ]
                    }
                }
            };

            evaluator.evaluate(chunk);

            // Should make HTTP request with bold voice file
            expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/tts', expect.objectContaining({
                body: JSON.stringify({
                    text: 'bold text',
                    voice_mode: 'clone',
                    reference_audio_filename: 'Bold.wav',
                    output_format: 'wav',
                    temperature: 0.6,
                    exaggeration: 0.5,
                    cfg_weight: 1.0,
                    speed_factor: 1.0
                })
            }));
        });

        test('should handle invalid JSON in settings file', () => {
            mockReadFileSync.mockReturnValue('invalid json');

            expect(() => new VoiceEvaluator()).not.toThrow();
        });
    });

    describe('evaluate', () => {
        test('should return empty result when no markdown annotation', async () => {
            const evaluator = new VoiceEvaluator();
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'plain text',
                processed: false
            };

            const result = await evaluator.evaluate(chunk);
            expect(result).toEqual({});
            expect(mockFetch).not.toHaveBeenCalled();
        });

        test('should process parsed markdown items', async () => {
            const evaluator = new VoiceEvaluator();
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'test content',
                processed: false,
                annotations: {
                    'evaluators.MarkdownEvaluator': {
                        parsedMarkdown: [
                            { type: 'text', content: 'hello world', start: 0, end: 11 },
                            { type: 'quote', content: 'quoted text', start: 12, end: 25 }
                        ]
                    }
                }
            };

            const result = await evaluator.evaluate(chunk);
            expect(result).toEqual({ annotation: { voiceGenerated: true } });

            // Wait for async processing
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(mockEmit).toHaveBeenCalledTimes(2);
        });

        test('should skip items without configured voice files', async () => {
            const evaluator = new VoiceEvaluator();
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'test',
                processed: false,
                annotations: {
                    'evaluators.MarkdownEvaluator': {
                        parsedMarkdown: [
                            { type: 'text', content: 'hello', start: 0, end: 5 },
                            { type: 'bold', content: 'bold text', start: 6, end: 15 }, // No voice configured
                            { type: 'quote', content: 'quote', start: 16, end: 22 }
                        ]
                    }
                }
            };

            await evaluator.evaluate(chunk);

            // Wait for async processing
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(mockFetch).toHaveBeenCalledTimes(2); // Only text and quote
            expect(mockEmit).toHaveBeenCalledTimes(2);
        });

        test('should handle empty parsed markdown', async () => {
            const evaluator = new VoiceEvaluator();
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'test',
                processed: false,
                annotations: {
                    'evaluators.MarkdownEvaluator': {
                        parsedMarkdown: []
                    }
                }
            };

            const result = await evaluator.evaluate(chunk);
            expect(result).toEqual({ annotation: { voiceGenerated: true } });
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('voice generation', () => {
        test('should make correct HTTP request with default settings', async () => {
            const evaluator = new VoiceEvaluator();
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'test',
                processed: false,
                annotations: {
                    'evaluators.MarkdownEvaluator': {
                        parsedMarkdown: [
                            { type: 'text', content: 'hello world', start: 0, end: 11 }
                        ]
                    }
                }
            };

            await evaluator.evaluate(chunk);
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: 'hello world',
                    voice_mode: 'clone',
                    reference_audio_filename: 'Robert.wav',
                    output_format: 'wav',
                    temperature: 0.8,
                    exaggeration: 0.5,
                    cfg_weight: 1.0,
                    speed_factor: 1.0
                })
            });
        });

        test('should generate correct base64 audio data URL', async () => {
            const evaluator = new VoiceEvaluator();
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'test',
                processed: false,
                annotations: {
                    'evaluators.MarkdownEvaluator': {
                        parsedMarkdown: [
                            { type: 'text', content: 'test', start: 0, end: 4 }
                        ]
                    }
                }
            };

            await evaluator.evaluate(chunk);
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(mockEmit).toHaveBeenCalledWith('voice', {
                audioDataUrl: expect.stringContaining('data:audio/wav;base64,'),
                text: 'test'
            });
        });

        test('should use different voices for different types', async () => {
            const voiceConfig = {
                voices: {
                    text: 'TextVoice.wav',
                    quote: 'QuoteVoice.wav'
                }
            };
            const evaluator = new VoiceEvaluator(voiceConfig);
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'test',
                processed: false,
                annotations: {
                    'evaluators.MarkdownEvaluator': {
                        parsedMarkdown: [
                            { type: 'text', content: 'text content', start: 0, end: 12 },
                            { type: 'quote', content: 'quote content', start: 13, end: 27 }
                        ]
                    }
                }
            };

            await evaluator.evaluate(chunk);
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(mockFetch).toHaveBeenCalledTimes(2);
            const calls = mockFetch.mock.calls;
            expect(calls[0][1].body).toContain('TextVoice.wav');
            expect(calls[1][1].body).toContain('QuoteVoice.wav');
        });
    });

    describe('queue processing', () => {
        test('should process voices sequentially', async () => {
            const evaluator = new VoiceEvaluator();
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'test',
                processed: false,
                annotations: {
                    'evaluators.MarkdownEvaluator': {
                        parsedMarkdown: [
                            { type: 'text', content: 'first', start: 0, end: 5 },
                            { type: 'text', content: 'second', start: 6, end: 12 },
                            { type: 'text', content: 'third', start: 13, end: 18 }
                        ]
                    }
                }
            };

            await evaluator.evaluate(chunk);
            await new Promise(resolve => setTimeout(resolve, 200));

            expect(mockFetch).toHaveBeenCalledTimes(3);
            expect(mockEmit).toHaveBeenCalledTimes(3);
        });

        test('should handle voice generation errors gracefully', async () => {
            mockFetch.mockImplementation(() => Promise.reject(new Error('Network error')));

            const evaluator = new VoiceEvaluator();
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'test',
                processed: false,
                annotations: {
                    'evaluators.MarkdownEvaluator': {
                        parsedMarkdown: [
                            { type: 'text', content: 'test content', start: 0, end: 12 }
                        ]
                    }
                }
            };

            // Should not throw
            await expect(evaluator.evaluate(chunk)).resolves.toEqual({ annotation: { voiceGenerated: true } });
            await new Promise(resolve => setTimeout(resolve, 100));

            // Should not emit voice event on error
            expect(mockEmit).not.toHaveBeenCalled();
        });

        test('should handle HTTP error responses gracefully', async () => {
            mockFetch.mockReturnValue(Promise.resolve({
                ok: false,
                statusText: 'Server error'
            }));

            const evaluator = new VoiceEvaluator();
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'test',
                processed: false,
                annotations: {
                    'evaluators.MarkdownEvaluator': {
                        parsedMarkdown: [
                            { type: 'text', content: 'test content', start: 0, end: 12 }
                        ]
                    }
                }
            };

            await evaluator.evaluate(chunk);
            await new Promise(resolve => setTimeout(resolve, 100));

            // Should not emit voice event on HTTP error
            expect(mockEmit).not.toHaveBeenCalled();
        });
    });

    describe('voice settings', () => {
        test('should include all generation settings in request', async () => {
            const voiceConfig = {
                voices: { text: 'Test.wav' },
                generation: {
                    temperature: 0.5,
                    exaggeration: 0.3,
                    cfg_weight: 0.8,
                    speed_factor: 1.2
                }
            };
            const evaluator = new VoiceEvaluator(voiceConfig);
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'test',
                processed: false,
                annotations: {
                    'evaluators.MarkdownEvaluator': {
                        parsedMarkdown: [
                            { type: 'text', content: 'test', start: 0, end: 4 }
                        ]
                    }
                }
            };

            await evaluator.evaluate(chunk);
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/tts', expect.objectContaining({
                body: JSON.stringify({
                    text: 'test',
                    voice_mode: 'clone',
                    reference_audio_filename: 'Test.wav',
                    output_format: 'wav',
                    temperature: 0.5,
                    exaggeration: 0.3,
                    cfg_weight: 0.8,
                    speed_factor: 1.2
                })
            }));
        });

        test('should include default generation settings when not overridden', async () => {
            const voiceConfig = {
                voices: { text: 'Test.wav' }
                // No generation settings provided
            };
            const evaluator = new VoiceEvaluator(voiceConfig);
            const chunk: Chunk = {
                type: ChunkType.LlmOutput,
                content: 'test',
                processed: false,
                annotations: {
                    'evaluators.MarkdownEvaluator': {
                        parsedMarkdown: [
                            { type: 'text', content: 'test', start: 0, end: 4 }
                        ]
                    }
                }
            };

            await evaluator.evaluate(chunk);
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/tts', expect.objectContaining({
                body: JSON.stringify({
                    text: 'test',
                    voice_mode: 'clone',
                    reference_audio_filename: 'Test.wav',
                    output_format: 'wav',
                    temperature: 0.8,
                    exaggeration: 0.5,
                    cfg_weight: 1.0,
                    speed_factor: 1.0
                })
            }));
        });
    });
});