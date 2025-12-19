import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { Tool } from '../../lib/core/Tool';
import { ChunkType, Task } from '../../interfaces/AgentTypes';
import { createMockTask, createMockChunk } from '../mocks/helpers';

// Concrete implementation for testing the abstract Tool class
class TestTool extends Tool {
    public readonly name = 'TestTool';
    public readonly description = 'A test tool for unit testing';
    public readonly parameters = {
        type: 'object' as const,
        properties: {
            input: {
                type: 'string',
                description: 'Input parameter'
            }
        },
        required: ['input']
    };

    async run(parameters: any, context?: { arena: any, task: Task }): Promise<any> {
        return {
            result: `Processed: ${parameters.input}`,
            annotation: { processed: true }
        };
    }
}

describe('Tool', () => {
    let tool: TestTool;

    beforeEach(() => {
        tool = new TestTool();
    });

    describe('constructor', () => {
        test('should set correct fqdn', () => {
            expect(tool.fqdn).toBe('tools.TestTool');
        });
    });

    describe('properties', () => {
        test('should have correct name', () => {
            expect(tool.name).toBe('TestTool');
        });

        test('should have correct description', () => {
            expect(tool.description).toBe('A test tool for unit testing');
        });

        test('should have correct parameters schema', () => {
            expect(tool.parameters).toEqual({
                type: 'object',
                properties: {
                    input: {
                        type: 'string',
                        description: 'Input parameter'
                    }
                },
                required: ['input']
            });
        });
    });

    describe('run', () => {
        test('should execute tool with parameters', async () => {
            const parameters = { input: 'test data' };

            const result = await tool.run(parameters);

            expect(result).toEqual({
                result: 'Processed: test data',
                annotation: { processed: true }
            });
        });

        test('should handle context parameter', async () => {
            const parameters = { input: 'test data' };
            const context = {
                arena: { dataChunks: [] },
                task: createMockTask()
            };

            const result = await tool.run(parameters, context);

            expect(result.result).toBe('Processed: test data');
        });
    });

    describe('writeTaskDataChunk', () => {
        test('should write data chunk to task', () => {
            const task = createMockTask();
            const data = { result: 'success' };

            tool.writeTaskDataChunk(task, data);

            expect(task.scratchpad.length).toBe(1);
            const chunk = task.scratchpad[0];
            expect(chunk.type).toBe(ChunkType.Data);
            expect(JSON.parse(chunk.content)).toEqual({
                fqdn: tool.fqdn,
                data
            });
        });

        test('should use custom fqdn', () => {
            const task = createMockTask();
            const data = { custom: true };

            tool.writeTaskDataChunk(task, data, 'custom.fqdn');

            const chunk = task.scratchpad[0];
            expect(JSON.parse(chunk.content)).toEqual({
                fqdn: 'custom.fqdn',
                data
            });
        });

        test('should throw error if fqdn not set', () => {
            const task = createMockTask();
            (tool as any).fqdn = '';

            expect(() => tool.writeTaskDataChunk(task, {})).toThrow('Tool FQDN not set');
        });
    });

    describe('writeSessionDataChunk', () => {
        test('should write data chunk to arena session', () => {
            const context = { arena: { dataChunks: [] } };
            const data = { session: 'data' };

            tool.writeSessionDataChunk(data, context);

            expect(context.arena.dataChunks.length).toBe(1);
            const chunk = context.arena.dataChunks[0];
            expect(chunk.type).toBe(ChunkType.Data);
            expect(JSON.parse(chunk.content)).toEqual({
                fqdn: tool.fqdn,
                data
            });
        });

        test('should use custom fqdn', () => {
            const context = { arena: { dataChunks: [] } };
            const data = { custom: true };

            tool.writeSessionDataChunk(data, context, 'custom.fqdn');

            const chunk = context.arena.dataChunks[0];
            expect(JSON.parse(chunk.content)).toEqual({
                fqdn: 'custom.fqdn',
                data
            });
        });
    });

    describe('getTaskDataChunks', () => {
        test('should retrieve task data chunks for tool', () => {
            const task = createMockTask({
                scratchpad: [
                    createMockChunk({
                        type: ChunkType.Data,
                        content: JSON.stringify({ fqdn: tool.fqdn, data: 'tool data' })
                    }),
                    createMockChunk({
                        type: ChunkType.Data,
                        content: JSON.stringify({ fqdn: 'other.tool', data: 'other data' })
                    })
                ]
            });

            const data = tool.getTaskDataChunks(task);

            expect(data).toEqual(['tool data']);
        });

        test('should filter by custom fqdn', () => {
            const task = createMockTask({
                scratchpad: [
                    createMockChunk({
                        type: ChunkType.Data,
                        content: JSON.stringify({ fqdn: 'custom.fqdn', data: 'custom data' })
                    })
                ]
            });

            const data = tool.getTaskDataChunks(task, 'custom.fqdn');

            expect(data).toEqual(['custom data']);
        });
    });

    describe('getSessionDataChunks', () => {
        test('should retrieve session data chunks for tool', () => {
            const context = {
                arena: {
                    dataChunks: [
                        createMockChunk({
                            type: ChunkType.Data,
                            content: JSON.stringify({ fqdn: tool.fqdn, data: 'session data' })
                        }),
                        createMockChunk({
                            type: ChunkType.Data,
                            content: JSON.stringify({ fqdn: 'other.tool', data: 'other data' })
                        })
                    ]
                }
            };

            const data = tool.getSessionDataChunks(context);

            expect(data).toEqual(['session data']);
        });

        test('should filter by custom fqdn', () => {
            const context = {
                arena: {
                    dataChunks: [
                        createMockChunk({
                            type: ChunkType.Data,
                            content: JSON.stringify({ fqdn: 'custom.fqdn', data: 'custom data' })
                        })
                    ]
                }
            };

            const data = tool.getSessionDataChunks(context, 'custom.fqdn');

            expect(data).toEqual(['custom data']);
        });
    });

    describe('getAllDataChunks', () => {
        test('should combine task and session data', () => {
            const task = createMockTask({
                scratchpad: [
                    createMockChunk({
                        type: ChunkType.Data,
                        content: JSON.stringify({ fqdn: tool.fqdn, data: 'task data' })
                    })
                ]
            });

            const context = {
                arena: {
                    dataChunks: [
                        createMockChunk({
                            type: ChunkType.Data,
                            content: JSON.stringify({ fqdn: tool.fqdn, data: 'session data' })
                        })
                    ]
                }
            };

            const data = tool.getAllDataChunks(task, context);

            expect(data).toEqual(['session data', 'task data']);
        });
    });

    describe('writeChunkAnnotation', () => {
        test('should annotate chunk with data', () => {
            const chunk = createMockChunk();
            const annotation = { confidence: 0.95 };

            tool.writeChunkAnnotation(chunk, annotation);

            expect(chunk.annotations).toEqual({
                [tool.fqdn]: annotation
            });
        });

        test('should create annotations object if not exists', () => {
            const chunk = createMockChunk();
            delete (chunk as any).annotations;

            tool.writeChunkAnnotation(chunk, 'annotation data');

            expect(chunk.annotations).toEqual({
                [tool.fqdn]: 'annotation data'
            });
        });

        test('should use custom fqdn', () => {
            const chunk = createMockChunk();
            const annotation = { custom: true };

            tool.writeChunkAnnotation(chunk, annotation, 'custom.fqdn');

            expect(chunk.annotations).toEqual({
                'custom.fqdn': annotation
            });
        });
    });

    describe('getChunkAnnotation', () => {
        test('should get specific annotation by fqdn', () => {
            const chunk = createMockChunk();
            chunk.annotations = {
                [tool.fqdn]: 'tool annotation',
                'other.fqdn': 'other annotation'
            };

            const annotation = tool.getChunkAnnotation(chunk, tool.fqdn);

            expect(annotation).toBe('tool annotation');
        });

        test('should get all annotations if no fqdn specified', () => {
            const chunk = createMockChunk();
            const annotations = { key: 'value', score: 85 };
            chunk.annotations = annotations;

            const result = tool.getChunkAnnotation(chunk);

            expect(result).toBe(annotations);
        });

        test('should return empty object for chunk without annotations', () => {
            const chunk = createMockChunk();

            const result = tool.getChunkAnnotation(chunk);

            expect(result).toEqual({});
        });
    });

    describe('getAllChunkAnnotations', () => {
        test('should get all annotations from chunk', () => {
            const chunk = createMockChunk();
            const annotations = { confidence: 0.95, category: 'test' };
            chunk.annotations = annotations;

            const result = tool.getAllChunkAnnotations(chunk);

            expect(result).toBe(annotations);
        });

        test('should return empty object for chunk without annotations', () => {
            const chunk = createMockChunk();

            const result = tool.getAllChunkAnnotations(chunk);

            expect(result).toEqual({});
        });
    });
});