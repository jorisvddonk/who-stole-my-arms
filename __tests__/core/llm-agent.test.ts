import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { LLMAgent } from '../../lib/core/LLMAgent';
import { ChunkType, Task } from '../../interfaces/AgentTypes';
import { MockStreamingLLM } from '../mocks/MockStreamingLLM';
import { createMockTask, createMockChunk } from '../mocks/helpers';
import { setupTestEnv } from '../test-setup';

setupTestEnv();

// Concrete implementation for testing the abstract LLMAgent class
class TestAgent extends LLMAgent {
    constructor(streamingLLM: any, arena: any) {
        super(streamingLLM, arena);
    }

    buildPrompt(task: Task): string {
        return `Test prompt for: ${task.input}`;
    }
}

describe('LLMAgent', () => {
    let agent: TestAgent;
    let streamingLLM: MockStreamingLLM;
    let mockArena: any;

    beforeEach(() => {
        streamingLLM = new MockStreamingLLM();
        mockArena = { wireAgentEventEmitter: mock(() => {}) };
        agent = new TestAgent(streamingLLM, mockArena);
    });

    describe('constructor', () => {
        test('should initialize with streaming LLM', () => {
            expect((agent as any).streamingLLM).toBe(streamingLLM);
        });

        test('should create event emitter', () => {
            expect(agent.eventEmitter).toBeDefined();
        });

        test('should set correct fqdn', () => {
            expect(agent.fqdn).toBe('agents.TestAgent');
        });

        test('should wire agent events if arena provided', () => {
            expect(mockArena.wireAgentEventEmitter).toHaveBeenCalledWith(agent);
        });
    });

    describe('registerTool', () => {
        test('should register tool', () => {
            const mockTool = { name: 'testTool' };

            agent.registerTool(mockTool as any);

            expect(agent.tools['testTool']).toBe(mockTool);
        });
    });

    describe('registerAgent', () => {
        test('should register sub-agent', () => {
            const mockSubAgent = { constructor: { name: 'SubAgent' } };

            agent.registerAgent(mockSubAgent as any);

            expect(agent.registeredAgents['SubAgent']).toBe(mockSubAgent);
        });
    });

    describe('setStreamingLLM', () => {
        test('should update streaming LLM', () => {
            const newStreamingLLM = new MockStreamingLLM();

            agent.setStreamingLLM(newStreamingLLM);

            expect((agent as any).streamingLLM).toBe(newStreamingLLM);
        });
    });

    describe('generateStreamingResponse', () => {
        test('should generate response from streaming LLM', async () => {
            const prompt = 'Test prompt';
            const result = await agent.generateStreamingResponse(prompt);

            expect(result).toBe('Mock response');
        });

        test('should emit token events', async () => {
            const emitSpy = mock(() => {});
            agent.eventEmitter.emit = emitSpy;

            await agent.generateStreamingResponse('test');

            expect(emitSpy).toHaveBeenCalledWith('token', 'Mock');
            expect(emitSpy).toHaveBeenCalledWith('token', ' response');
        });
    });

    describe('run', () => {
        test('should execute full agent workflow', async () => {
            const task = createMockTask();

            const result = await agent.run(task);

            expect(agent.currentTask).toBe(task);
            expect(typeof result).toBe('string');
        });

        test('should handle errors and emit error events', async () => {
            const task = createMockTask();
            const originalBuildPrompt = agent.buildPrompt;
            agent.buildPrompt = () => { throw new Error('Build prompt failed'); };

            const emitSpy = mock(() => {});
            agent.eventEmitter.emit = emitSpy;

            await expect(agent.run(task)).rejects.toThrow('Build prompt failed');

            expect(emitSpy).toHaveBeenCalledWith('error', expect.any(Error));

            agent.buildPrompt = originalBuildPrompt;
        });
    });

    describe('parseToolResults', () => {
        test('should parse valid tool results', () => {
            const scratchpad = `<|tool_result|>{"result": "success"}<|tool_result_end|>`;

            const results = LLMAgent.parseToolResults(scratchpad);

            expect(results).toEqual([{ result: 'success' }]);
        });

        test('should parse multiple tool results', () => {
            const scratchpad = `<|tool_result|>{"result": "first"}<|tool_result_end|><|tool_result|>{"result": "second"}<|tool_result_end|>`;

            const results = LLMAgent.parseToolResults(scratchpad);

            expect(results).toEqual([{ result: 'first' }, { result: 'second' }]);
        });

        test('should throw error for incomplete tool results', () => {
            const scratchpad = `<|tool_result|>{"result": "incomplete"}<|tool_result_end|><|tool_result|>{"result": "missing end"`;

            expect(() => LLMAgent.parseToolResults(scratchpad)).toThrow('tool result incomplete');
        });
    });

    describe('parseAgentResults', () => {
        test('should parse valid agent results', () => {
            const scratchpad = `<|agent_result|>{"response": "hello"}<|agent_result_end|>`;

            const results = LLMAgent.parseAgentResults(scratchpad);

            expect(results).toEqual([{ response: 'hello' }]);
        });

        test('should parse multiple agent results', () => {
            const scratchpad = `<|agent_result|>{"response": "first"}<|agent_result_end|><|agent_result|>{"response": "second"}<|agent_result_end|>`;

            const results = LLMAgent.parseAgentResults(scratchpad);

            expect(results).toEqual([{ response: 'first' }, { response: 'second' }]);
        });

        test('should throw error for incomplete agent results', () => {
            const scratchpad = `<|agent_result|>{"response": "incomplete"}<|agent_result_end|><|agent_result|>{"response": "missing end"`;

            expect(() => LLMAgent.parseAgentResults(scratchpad)).toThrow('agent result incomplete');
        });
    });

    describe('getScratchpadContent', () => {
        test('should extract input and LLM output content', () => {
            const task = createMockTask({
                scratchpad: [
                    createMockChunk({ type: ChunkType.Input, content: 'input1' }),
                    createMockChunk({ type: ChunkType.LlmOutput, content: 'output1' }),
                    createMockChunk({ type: ChunkType.ToolOutput, content: 'tool output' }),
                    createMockChunk({ type: ChunkType.Input, content: 'input2' })
                ]
            });

            const content = (agent as any).getScratchpadContent(task);

            expect(content).toBe('input1\noutput1\ninput2');
        });
    });

    describe('getFilteredContents', () => {
        test('should filter content by chunk type', () => {
            const task = createMockTask({
                scratchpad: [
                    createMockChunk({ type: ChunkType.Input, content: 'input1' }),
                    createMockChunk({ type: ChunkType.ToolOutput, content: 'tool1' }),
                    createMockChunk({ type: ChunkType.ToolOutput, content: 'tool2' })
                ]
            });

            const content = (agent as any).getFilteredContents(task, ChunkType.ToolOutput);

            expect(content).toBe('tool1\ntool2');
        });
    });

    describe('getInputText', () => {
        test('should get input from last input chunk', () => {
            const task = createMockTask({
                input: 'fallback input',
                scratchpad: [
                    createMockChunk({ type: ChunkType.Input, content: 'first input' }),
                    createMockChunk({ type: ChunkType.Input, content: 'last input' })
                ]
            });

            const inputText = (agent as any).getInputText(task);

            expect(inputText).toBe('last input');
        });

        test('should fallback to task input', () => {
            const task = createMockTask({
                input: 'fallback input',
                scratchpad: []
            });

            const inputText = (agent as any).getInputText(task);

            expect(inputText).toBe(JSON.stringify('fallback input'));
        });

        test('should handle object input with text property', () => {
            const task = createMockTask({
                input: { text: 'object input' },
                scratchpad: []
            });

            const inputText = (agent as any).getInputText(task);

            expect(inputText).toBe('object input');
        });
    });

    describe('getInputTextOrToolOutput', () => {
        test('should get last input or tool output chunk', () => {
            const task = createMockTask({
                scratchpad: [
                    createMockChunk({ type: ChunkType.Input, content: 'input1' }),
                    createMockChunk({ type: ChunkType.ToolOutput, content: 'tool output' })
                ]
            });

            const text = (agent as any).getInputTextOrToolOutput(task);

            expect(text).toBe('tool output');
        });
    });

    describe('addChunk', () => {
        test('should add chunk to task scratchpad', () => {
            const task = createMockTask();
            const chunk = createMockChunk({ content: 'test chunk' });

            agent.addChunk(task, chunk);

            expect(task.scratchpad).toContain(chunk);
        });

        test('should emit chunk events', () => {
            const task = createMockTask();
            const chunk = createMockChunk();
            const emitSpy = mock(() => {});
            agent.eventEmitter.emit = emitSpy;

            agent.addChunk(task, chunk);

            expect(emitSpy).toHaveBeenCalledWith('chunk', chunk);
            expect(emitSpy).toHaveBeenCalledWith(`chunk:${chunk.type}`, chunk);
        });

        test('should set messageId on LLM output chunks', () => {
            const task = createMockTask({
                input: { messageId: 'input-message-id' },
                scratchpad: []
            });
            const chunk = createMockChunk({
                type: ChunkType.LlmOutput,
                content: 'llm output'
            });

            agent.addChunk(task, chunk);

            expect(chunk.messageId).toBe('input-message-id');
        });
    });

    describe('writeTaskDataChunk', () => {
        test('should write data chunk to task', () => {
            const task = createMockTask();
            const data = { key: 'value' };

            agent.writeTaskDataChunk(task, data);

            expect(task.scratchpad.length).toBe(1);
            const chunk = task.scratchpad[0];
            expect(chunk.type).toBe(ChunkType.Data);
            expect(JSON.parse(chunk.content)).toEqual({
                fqdn: agent.fqdn,
                data
            });
        });

        test('should throw error if fqdn not set', () => {
            const task = createMockTask();
            (agent as any).fqdn = '';

            expect(() => agent.writeTaskDataChunk(task, {})).toThrow('Agent FQDN not set');
        });
    });

    describe('writeSessionDataChunk', () => {
        test('should write data chunk to arena session', () => {
            const mockArena = { dataChunks: [] };
            (agent as any).arena = mockArena;
            const data = { session: 'data' };

            agent.writeSessionDataChunk(data);

            expect(mockArena.dataChunks.length).toBe(1);
            const chunk = mockArena.dataChunks[0];
            expect(chunk.type).toBe(ChunkType.Data);
            expect(JSON.parse(chunk.content)).toEqual({
                fqdn: agent.fqdn,
                data
            });
        });

        test('should throw error if not associated with arena', () => {
            (agent as any).arena = null;

            expect(() => agent.writeSessionDataChunk({})).toThrow('Agent not associated with an arena');
        });
    });

    describe('getTaskDataChunks', () => {
        test('should retrieve task data chunks for agent', () => {
            const task = createMockTask({
                scratchpad: [
                    createMockChunk({
                        type: ChunkType.Data,
                        content: JSON.stringify({ fqdn: agent.fqdn, data: 'task data' })
                    }),
                    createMockChunk({
                        type: ChunkType.Data,
                        content: JSON.stringify({ fqdn: 'other.agent', data: 'other data' })
                    })
                ]
            });

            const data = agent.getTaskDataChunks(task);

            expect(data).toEqual(['task data']);
        });
    });

    describe('getSessionDataChunks', () => {
        test('should retrieve session data chunks for agent', () => {
            const mockArena = {
                dataChunks: [
                    createMockChunk({
                        type: ChunkType.Data,
                        content: JSON.stringify({ fqdn: agent.fqdn, data: 'session data' })
                    }),
                    createMockChunk({
                        type: ChunkType.Data,
                        content: JSON.stringify({ fqdn: 'other.agent', data: 'other data' })
                    })
                ]
            };
            (agent as any).arena = mockArena;

            const data = agent.getSessionDataChunks();

            expect(data).toEqual(['session data']);
        });
    });

    describe('getAllDataChunks', () => {
        test('should combine task and session data', () => {
            const mockArena = {
                dataChunks: [
                    createMockChunk({
                        type: ChunkType.Data,
                        content: JSON.stringify({ fqdn: agent.fqdn, data: 'session data' })
                    })
                ]
            };
            (agent as any).arena = mockArena;

            const task = createMockTask({
                scratchpad: [
                    createMockChunk({
                        type: ChunkType.Data,
                        content: JSON.stringify({ fqdn: agent.fqdn, data: 'task data' })
                    })
                ]
            });

            const data = agent.getAllDataChunks(task);

            expect(data).toEqual(['session data', 'task data']);
        });
    });

    describe('writeChunkAnnotation', () => {
        test('should annotate chunk with data', () => {
            const chunk = createMockChunk();
            const annotation = { score: 95 };

            agent.writeChunkAnnotation(chunk, annotation);

            expect(chunk.annotations).toEqual({
                [agent.fqdn]: annotation
            });
        });

        test('should create annotations object if not exists', () => {
            const chunk = createMockChunk();
            delete (chunk as any).annotations;

            agent.writeChunkAnnotation(chunk, 'annotation');

            expect(chunk.annotations).toEqual({
                [agent.fqdn]: 'annotation'
            });
        });
    });

    describe('getChunkAnnotation', () => {
        test('should get specific annotation by fqdn', () => {
            const chunk = createMockChunk();
            chunk.annotations = {
                [agent.fqdn]: 'agent annotation',
                'other.fqdn': 'other annotation'
            };

            const annotation = agent.getChunkAnnotation(chunk, agent.fqdn);

            expect(annotation).toBe('agent annotation');
        });

        test('should get all annotations if no fqdn specified', () => {
            const chunk = createMockChunk();
            const annotations = { key: 'value' };
            chunk.annotations = annotations;

            const result = agent.getChunkAnnotation(chunk);

            expect(result).toBe(annotations);
        });

        test('should return empty object for chunk without annotations', () => {
            const chunk = createMockChunk();

            const result = agent.getChunkAnnotation(chunk);

            expect(result).toEqual({});
        });
    });

    describe('getAllChunkAnnotations', () => {
        test('should get all annotations from chunk', () => {
            const chunk = createMockChunk();
            const annotations = { key: 'value', score: 100 };
            chunk.annotations = annotations;

            const result = agent.getAllChunkAnnotations(chunk);

            expect(result).toBe(annotations);
        });

        test('should return empty object for chunk without annotations', () => {
            const chunk = createMockChunk();

            const result = agent.getAllChunkAnnotations(chunk);

            expect(result).toEqual({});
        });
    });
});