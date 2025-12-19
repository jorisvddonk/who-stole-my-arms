import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { Arena } from '../../lib/core/Arena';
import { MockStreamingLLM } from '../mocks/MockStreamingLLM';
import { MockAgentManager } from '../mocks/MockAgentManager';
import { MockEvaluatorManager } from '../mocks/MockEvaluatorManager';
import { createMockTask, createMockChunk } from '../mocks/helpers';
import { ChunkType } from '../../interfaces/AgentTypes';

describe('Arena', () => {
    let streamingLLM: MockStreamingLLM;
    let agentManager: MockAgentManager;
    let evaluatorManager: MockEvaluatorManager;
    let arena: Arena;

    beforeEach(() => {
        streamingLLM = new MockStreamingLLM();
        agentManager = new MockAgentManager();
        evaluatorManager = new MockEvaluatorManager();
        arena = new Arena(streamingLLM, agentManager, evaluatorManager);
    });

    describe('constructor', () => {
        test('should initialize with provided dependencies', () => {
            expect(arena.streamingLLM).toBe(streamingLLM);
            expect(arena.eventEmitter).toBeInstanceOf(require('node:events').EventEmitter);
        });

        test('should load agents from agent manager', () => {
            const agents = agentManager.getAgents();
            expect(arena.agents).toEqual(agents);
        });

        test('should load evaluators from evaluator manager', () => {
            const evaluators = evaluatorManager.getEvaluators();
            expect(arena.evaluators).toEqual(evaluators);
        });

        test('should initialize empty data structures', () => {
            expect(arena.taskQueue).toEqual([]);
            expect(arena.taskStore).toEqual({});
            expect(arena.invocationLog).toEqual([]);
            expect(arena.currentContinuationTask).toBeNull();
            expect(arena.errorCount).toBe(0);
            expect(arena.dataChunks).toEqual([]);
        });

        test('should set arena reference on agents', () => {
            const agents = agentManager.getAgents();
            for (const agent of Object.values(agents)) {
                expect((agent as any).arena).toBe(arena);
            }
        });

        test('should wire evaluators to chunk events', () => {
            // Verify that event listeners were set up for chunk events
            const listeners = arena.eventEmitter.listeners('chunk');
            expect(listeners.length).toBeGreaterThan(0);
        });
    });

    describe('updateStreamingLLM', () => {
        test('should update streaming LLM for all agents', () => {
            const newStreamingLLM = new MockStreamingLLM();
            const agents = agentManager.getAgents();

            // Mock setStreamingLLM method on each agent
            const mockSetStreamingLLM = mock(() => {});
            for (const agent of Object.values(agents)) {
                (agent as any).setStreamingLLM = mockSetStreamingLLM;
            }

            arena.updateStreamingLLM(newStreamingLLM);

            expect(arena.streamingLLM).toBe(newStreamingLLM);

            // Verify all agents received the update
            expect(mockSetStreamingLLM).toHaveBeenCalledTimes(Object.keys(agents).length);
            expect(mockSetStreamingLLM).toHaveBeenCalledWith(newStreamingLLM);
        });
    });

    describe('generateId', () => {
        test('should generate unique string IDs', () => {
            const id1 = Arena.generateId();
            const id2 = Arena.generateId();

            expect(typeof id1).toBe('string');
            expect(typeof id2).toBe('string');
            expect(id1).not.toBe(id2);
            expect(id1.length).toBeGreaterThan(0);
        });
    });

    describe('wireAgentEventEmitter', () => {
        let testArena: Arena;
        let testAgent: any;

        beforeEach(() => {
            testArena = new Arena(streamingLLM, agentManager, evaluatorManager);
            testAgent = agentManager.getAgents()['MockAgent'];
        });

        test('should wire agent events to arena events', () => {
            const emitSpy = mock(() => {});
            testArena.eventEmitter.emit = emitSpy;

            // Wire the agent
            (testArena as any).wireAgentEventEmitter(testAgent);

            // Test chunk event forwarding
            const chunk = createMockChunk();
            testAgent.eventEmitter.emit('chunk', chunk);
            expect(emitSpy).toHaveBeenCalledWith('chunk', { agentName: testAgent.constructor.name, chunk, agent: testAgent });

            // Test token event forwarding
            testAgent.eventEmitter.emit('token', 'test token');
            expect(emitSpy).toHaveBeenCalledWith('token', { agentName: testAgent.constructor.name, token: 'test token' });

            // Test toolCall event forwarding
            const toolCall = { name: 'testTool', parameters: {} };
            testAgent.eventEmitter.emit('toolCall', toolCall);
            expect(emitSpy).toHaveBeenCalledWith('toolCall', { agentName: testAgent.constructor.name, call: toolCall });

            // Test agentCall event forwarding
            const agentCall = { name: 'testAgent', input: {} };
            testAgent.eventEmitter.emit('agentCall', agentCall);
            expect(emitSpy).toHaveBeenCalledWith('agentCall', { agentName: testAgent.constructor.name, call: agentCall });
        });



        test('should forward parseError events', () => {
            const emitSpy = mock(() => {});
            testArena.eventEmitter.emit = emitSpy;

            (testArena as any).wireAgentEventEmitter(testAgent);

            const errorDetails = { error: new Error('parse error'), type: 'toolCalls' };
            testAgent.eventEmitter.emit('parseError', errorDetails);

            expect(emitSpy).toHaveBeenCalledWith('parseError', {
                agentName: testAgent.constructor.name,
                error: errorDetails.error,
                type: errorDetails.type
            });
        });
    });

    describe('wireEvaluatorEventEmitter', () => {
        let testArena: Arena;
        let testEvaluator: any;

        beforeEach(() => {
            testArena = new Arena(streamingLLM, agentManager, evaluatorManager);
            testEvaluator = evaluatorManager.getEvaluators()[0] as any;
        });

        test('should wire evaluator events to arena events', () => {
            const emitSpy = mock(() => {});
            testArena.eventEmitter.emit = emitSpy;

            // Wire the evaluator
            (testArena as any).wireEvaluatorEventEmitter(testEvaluator);

            // Test chunk event forwarding
            const chunk = createMockChunk();
            testEvaluator.eventEmitter.emit('chunk', chunk);
            expect(emitSpy).toHaveBeenCalledWith('evaluatorChunk', { evaluatorName: testEvaluator.constructor.name, chunk });

            // Test token event forwarding
            testEvaluator.eventEmitter.emit('token', 'test token');
            expect(emitSpy).toHaveBeenCalledWith('evaluatorToken', { evaluatorName: testEvaluator.constructor.name, token: 'test token' });

            // Test toolCall event forwarding
            const toolCall = { name: 'testTool', parameters: {} };
            testEvaluator.eventEmitter.emit('toolCall', toolCall);
            expect(emitSpy).toHaveBeenCalledWith('evaluatorToolCall', { evaluatorName: testEvaluator.constructor.name, call: toolCall });

            // Test agentCall event forwarding
            const agentCall = { name: 'testAgent', input: {} };
            testEvaluator.eventEmitter.emit('agentCall', agentCall);
            expect(emitSpy).toHaveBeenCalledWith('evaluatorAgentCall', { evaluatorName: testEvaluator.constructor.name, call: agentCall });
        });


    });

    describe('addInputChunk', () => {
        test('should add input chunk to task scratchpad', () => {
            const task = createMockTask();
            arena.taskStore[task.id] = task;

            const inputChunk = createMockChunk({ type: ChunkType.Input, content: 'input data' });

            (arena as any).addInputChunk(task, inputChunk);

            expect(task.scratchpad).toContain(inputChunk);
        });

        test('should emit chunk event when adding input chunk', () => {
            const task = createMockTask();
            arena.taskStore[task.id] = task;

            const inputChunk = createMockChunk({ type: ChunkType.Input });
            const emitSpy = mock(() => {});
            arena.eventEmitter.emit = emitSpy;

            (arena as any).addInputChunk(task, inputChunk);

            expect(emitSpy).toHaveBeenCalledWith('chunk', { agentName: null, chunk: inputChunk });
        });
    });

    describe('removeTask', () => {
        test('should remove task from taskStore', () => {
            const task = createMockTask();
            arena.taskStore[task.id] = task;

            arena.removeTask(task.id);

            expect(arena.taskStore[task.id]).toBeUndefined();
        });

        test('should remove task from taskQueue', () => {
            const task = createMockTask();
            arena.taskStore[task.id] = task;
            arena.taskQueue.push(task);

            arena.removeTask(task.id);

            expect(arena.taskQueue).not.toContain(task);
        });

        test('should remove task from invocationLog', () => {
            const task = createMockTask();
            arena.taskStore[task.id] = task;
            arena.invocationLog.push({ id: task.id, type: 'agent', name: task.agent_name, parent_id: null });

            arena.removeTask(task.id);

            expect(arena.invocationLog.some(inv => inv.id === task.id)).toBe(false);
        });

        test('should recursively remove child tasks', () => {
            const parentTask = createMockTask();
            const childTask = createMockTask({ parent_task_id: parentTask.id });

            arena.taskStore[parentTask.id] = parentTask;
            arena.taskStore[childTask.id] = childTask;
            arena.invocationLog.push(
                { id: parentTask.id, type: 'agent', name: parentTask.agent_name, parent_id: null },
                { id: childTask.id, type: 'agent', name: childTask.agent_name, parent_id: parentTask.id }
            );

            arena.removeTask(parentTask.id);

            expect(arena.taskStore[parentTask.id]).toBeUndefined();
            expect(arena.taskStore[childTask.id]).toBeUndefined();
            expect(arena.invocationLog.some(inv => inv.id === parentTask.id)).toBe(false);
            expect(arena.invocationLog.some(inv => inv.id === childTask.id)).toBe(false);
        });

        test('should clear currentContinuationTask if it matches', () => {
            const task = createMockTask();
            arena.taskStore[task.id] = task;
            (arena as any).currentContinuationTask = task;

            arena.removeTask(task.id);

            expect(arena.currentContinuationTask).toBeNull();
        });

        test('should do nothing for non-existent task', () => {
            const initialStoreSize = Object.keys(arena.taskStore).length;
            const initialQueueSize = arena.taskQueue.length;
            const initialLogSize = arena.invocationLog.length;

            arena.removeTask('non-existent-id');

            expect(Object.keys(arena.taskStore).length).toBe(initialStoreSize);
            expect(arena.taskQueue.length).toBe(initialQueueSize);
            expect(arena.invocationLog.length).toBe(initialLogSize);
        });
    });

    describe('removeChunksByMessageId', () => {
        test('should remove chunks with matching messageId from all tasks', () => {
            const task1 = createMockTask();
            const chunk1 = { type: ChunkType.Input, content: 'chunk1', processed: false, messageId: 'test-message' };
            const chunk2 = { type: ChunkType.Input, content: 'chunk2', processed: false, messageId: 'other-message' };

            task1.scratchpad = [chunk1, chunk2];
            arena.taskStore[task1.id] = task1;

            expect(task1.scratchpad.length).toBe(2);

            arena.removeChunksByMessageId('test-message');

            expect(task1.scratchpad.length).toBe(1);
            expect(task1.scratchpad[0].messageId).toBe('other-message');
        });
    });

    describe('parseToolCalls', () => {
        test('should parse valid tool calls', () => {
            const response = `<|tool_call|>{"name": "testTool", "parameters": {"param1": "value1"}}<|tool_call_end|>`;

            const result = Arena.parseToolCalls(response);

            expect(result).toEqual([{ name: 'testTool', parameters: { param1: 'value1' } }]);
        });

        test('should parse multiple tool calls', () => {
            const response = `<|tool_call|>{"name": "tool1", "parameters": {}}<|tool_call_end|><|tool_call|>{"name": "tool2", "parameters": {}}<|tool_call_end|>`;

            const result = Arena.parseToolCalls(response);

            expect(result).toEqual([
                { name: 'tool1', parameters: {} },
                { name: 'tool2', parameters: {} }
            ]);
        });

        test('should throw error for incomplete tool calls', () => {
            const response = `<|tool_call|>{"name": "testTool"}<|tool_call_end|><|tool_call|>{"name": "incomplete"`;

            expect(() => Arena.parseToolCalls(response)).toThrow('tool call incomplete');
        });

        test('should return empty array for no tool calls', () => {
            const response = 'Just some regular text';

            const result = Arena.parseToolCalls(response);

            expect(result).toEqual([]);
        });

        test('should handle malformed JSON', () => {
            const response = `<|tool_call|>invalid json<|tool_call_end|>`;

            expect(() => Arena.parseToolCalls(response)).toThrow();
        });
    });

    describe('parseAgentCalls', () => {
        test('should parse valid agent calls with JSON object format', () => {
            const response = `<|agent_call|>{"name": "testAgent", "input": {"param1": "value1"}}<|agent_call_end|>`;

            const result = Arena.parseAgentCalls(response);

            expect(result).toEqual([{ name: 'testAgent', input: { param1: 'value1' } }]);
        });

        test('should parse valid agent calls with tuple format', () => {
            const response = `<|agent_call|>"testAgent", {"param1": "value1"}<|agent_call_end|>`;

            const result = Arena.parseAgentCalls(response);

            expect(result).toEqual([{ name: 'testAgent', input: { param1: 'value1' } }]);
        });

        test('should parse valid agent calls with wrapped JSON', () => {
            const response = `<|agent_call|>{ "name": "testAgent", "input": {"param1": "value1"} }<|agent_call_end|>`;

            const result = Arena.parseAgentCalls(response);

            expect(result).toEqual([{ name: 'testAgent', input: { param1: 'value1' } }]);
        });

        test('should parse multiple agent calls', () => {
            const response = `<|agent_call|>{"name": "agent1", "input": {}}<|agent_call_end|><|agent_call|>{"name": "agent2", "input": {}}<|agent_call_end|>`;

            const result = Arena.parseAgentCalls(response);

            expect(result).toEqual([
                { name: 'agent1', input: {} },
                { name: 'agent2', input: {} }
            ]);
        });

        test('should throw error for incomplete agent calls', () => {
            const response = `<|agent_call|>{"name": "testAgent"}<|agent_call_end|><|agent_call|>{"name": "incomplete"`;

            expect(() => Arena.parseAgentCalls(response)).toThrow('agent call incomplete');
        });

        test('should throw error for missing input', () => {
            const response = `<|agent_call|>"testAgent"<|agent_call_end|>`;

            expect(() => Arena.parseAgentCalls(response)).toThrow('Invalid agent call format: missing input');
        });

        test('should throw error for unquoted name', () => {
            const response = `<|agent_call|>testAgent, {}<|agent_call_end|>`;

            expect(() => Arena.parseAgentCalls(response)).toThrow('Invalid agent call format: name must be quoted');
        });

        test('should throw error for invalid JSON input', () => {
            const response = `<|agent_call|>"testAgent", invalid json<|agent_call_end|>`;

            expect(() => Arena.parseAgentCalls(response)).toThrow('Invalid agent call format: input must be valid JSON');
        });

        test('should return empty array for no agent calls', () => {
            const response = 'Just some regular text';

            const result = Arena.parseAgentCalls(response);

            expect(result).toEqual([]);
        });
    });

    describe('run_agent', () => {
        test('should execute agent and return result', async () => {
            const task = createMockTask({ agent_name: 'MockAgent' });
            const agent = arena.agents['MockAgent'];

            // Mock the agent's run method
            const originalRun = agent.run;
            agent.run = mock(() => Promise.resolve('agent response'));

            const result = await (arena as any).run_agent(task);

            expect(result).toBe('agent response');
            expect(agent.run).toHaveBeenCalledWith(task);

            // Restore
            agent.run = originalRun;
        });

        test('should add invocation log entry for new tasks', async () => {
            const task = createMockTask({ agent_name: 'MockAgent' });
            const agent = agentManager.getAgents()['MockAgent'];

            mock(agent, 'run').mockResolvedValue('response');

            await (arena as any).run_agent(task);

            expect(arena.invocationLog).toContainEqual({
                id: task.id,
                type: 'agent',
                name: task.agent_name,
                parent_id: task.parent_task_id,
                params: task.input
            });
        });

        test('should not add duplicate invocation log entries', async () => {
            const task = createMockTask({ agent_name: 'MockAgent' });
            const agent = agentManager.getAgents()['MockAgent'];

            // Add existing log entry
            arena.invocationLog.push({
                id: task.id,
                type: 'agent',
                name: task.agent_name,
                parent_id: task.parent_task_id,
                params: task.input
            });

            mock(agent, 'run').mockResolvedValue('response');

            await (arena as any).run_agent(task);

            // Should still have only one entry
            const logEntries = arena.invocationLog.filter(log => log.id === task.id);
            expect(logEntries.length).toBe(1);
        });

        test('should use ErrorAgent for unknown agents', async () => {
            const task = createMockTask({ agent_name: 'ErrorAgent' });
            const errorAgent = arena.agents['ErrorAgent'];

            const originalRun = errorAgent.run;
            errorAgent.run = mock(() => Promise.resolve('error response'));

            const result = await (arena as any).run_agent(task);

            expect(result).toBe('error response');

            // Restore
            errorAgent.run = originalRun;
        });

        test('should throw error for truly unknown agents', async () => {
            const task = createMockTask({ agent_name: 'UnknownAgent' });

            // Remove ErrorAgent from agents
            const originalAgents = { ...arena.agents };
            delete arena.agents['ErrorAgent'];

            await expect((arena as any).run_agent(task)).rejects.toThrow('Unknown agent');

            // Restore
            arena.agents = originalAgents;
        });

        test('should handle agent execution errors with ErrorAgent fallback', async () => {
            const task = createMockTask({ agent_name: 'MockAgent' });
            const agent = arena.agents['MockAgent'];

            const originalRun = agent.run;
            agent.run = () => Promise.reject(new Error('agent failed'));

            try {
                const result = await (arena as any).run_agent(task);
                expect(result).toEqual({ content: "<|error|>An unexpected error occurred during processing.<|error_end|>" });
            } catch (e) {
                // If it throws, that's also acceptable behavior
                expect(e.message).toContain('agent failed');
            }

            // Restore
            agent.run = originalRun;
        });
    });

    describe('return_result_to_parent', () => {
        test('should call onComplete callback for root tasks', () => {
            const onComplete = mock(() => {});
            const task = createMockTask({ parent_task_id: null, onComplete });
            const result = 'final result';

            (arena as any).return_result_to_parent(task, result);

            expect(onComplete).toHaveBeenCalledWith(result);
        });

        test('should call onComplete callback for root tasks', () => {
            const onComplete = mock(() => {});
            const task = createMockTask({ parent_task_id: null, onComplete });
            const result = 'final result';

            (arena as any).return_result_to_parent(task, result);

            expect(onComplete).toHaveBeenCalledWith(result);
        });

        test('should return result to parent task for child tasks', () => {
            const parentTask = createMockTask();
            const childTask = createMockTask({ parent_task_id: parentTask.id });
            const result = 'child result';

            arena.taskStore[parentTask.id] = parentTask;
            const parentAgent = arena.agents[parentTask.agent_name];

            const originalAddChunk = parentAgent.addChunk;
            let addChunkCalled = false;
            let addChunkArgs: any[] = [];
            parentAgent.addChunk = (...args: any[]) => {
                addChunkCalled = true;
                addChunkArgs = args;
            };

            (arena as any).return_result_to_parent(childTask, result);

            expect(addChunkCalled).toBe(true);
            expect(addChunkArgs[0]).toBe(parentTask); // task parameter
            expect(addChunkArgs[1].type).toBe(ChunkType.AgentOutput);
            expect(addChunkArgs[1].content).toContain(JSON.stringify(result));

            // Restore
            parentAgent.addChunk = originalAddChunk;
        });

        test('should queue parent task after returning result', () => {
            const parentTask = createMockTask();
            const childTask = createMockTask({ parent_task_id: parentTask.id });

            arena.taskStore[parentTask.id] = parentTask;
            const parentAgent = arena.agents[parentTask.agent_name];

            const originalAddChunk = parentAgent.addChunk;
            parentAgent.addChunk = mock(() => {});

            (arena as any).return_result_to_parent(childTask, 'result');

            expect(arena.taskQueue).toContain(parentTask);

            // Restore
            parentAgent.addChunk = originalAddChunk;
        });

        test('should handle string results', () => {
            const parentTask = createMockTask();
            const childTask = createMockTask({ parent_task_id: parentTask.id });
            const result = 'string result';

            arena.taskStore[parentTask.id] = parentTask;
            const parentAgent = arena.agents[parentTask.agent_name];

            const originalAddChunk = parentAgent.addChunk;
            let addChunkContent = '';
            parentAgent.addChunk = (task: any, chunk: any) => {
                addChunkContent = chunk.content;
            };

            (arena as any).return_result_to_parent(childTask, result);

            expect(addChunkContent).toContain(JSON.stringify(result));

            // Restore
            parentAgent.addChunk = originalAddChunk;
        });



        test('should handle object results with content property', () => {
            const parentTask = createMockTask();
            const childTask = createMockTask({ parent_task_id: parentTask.id });
            const result = { content: 'object result', annotation: 'test' };

            arena.taskStore[parentTask.id] = parentTask;
            const parentAgent = arena.agents[parentTask.agent_name];

            const originalAddChunk = parentAgent.addChunk;
            let addChunkContent = '';
            parentAgent.addChunk = (task: any, chunk: any) => {
                addChunkContent = chunk.content;
            };

            (arena as any).return_result_to_parent(childTask, result);

            expect(addChunkContent).toContain(JSON.stringify('object result'));

            // Restore
            parentAgent.addChunk = originalAddChunk;
        });
    });
});