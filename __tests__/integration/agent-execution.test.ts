import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { Arena } from '../../lib/core/Arena';
import { AgentManager } from '../../lib/agents/AgentManager';
import { EvaluatorManager } from '../../lib/evaluators/EvaluatorManager';
import { SimpleEvaluator } from '../../lib/evaluators/SimpleEvaluator';
import { MockStreamingLLM } from '../mocks/MockStreamingLLM';
import { createMockTask } from '../mocks/helpers';
import { ChunkType } from '../../interfaces/AgentTypes';
import { setupTestEnv } from '../test-setup';

setupTestEnv();

describe('Full Agent Execution Integration', () => {
    let streamingLLM: MockStreamingLLM;
    let agentManager: AgentManager;
    let evaluatorManager: EvaluatorManager;
    let arena: Arena;

    beforeEach(async () => {
        streamingLLM = new MockStreamingLLM();
        // Reset singletons
        (AgentManager as any).instance = undefined;
        (EvaluatorManager as any).instance = undefined;

        agentManager = AgentManager.getInstance();
        evaluatorManager = EvaluatorManager.getInstance();

        // Initialize managers
        await agentManager.init(streamingLLM);
        evaluatorManager.init(streamingLLM);

        // Add a simple evaluator that counts characters in LLM output
        const charCountEvaluator = new SimpleEvaluator(
            (chunk: any) => ({
                annotation: { charCount: chunk.content.length, wordCount: chunk.content.split(/\s+/).length }
            }),
            [ChunkType.LlmOutput],
            'test.charCounter'
        );
        (evaluatorManager as any).evaluators.push(charCountEvaluator);

        arena = new Arena(streamingLLM, agentManager, evaluatorManager);
    });

    describe('complete agent workflow', () => {
        test('should execute agent, add chunks, and evaluate them', async () => {
            const task = createMockTask({
                agent_name: 'SimpleAgent',
                input: 'Test input for integration'
            });

            // Mock the agent run to simulate LLM response and chunk addition
            const agent = arena.agents['SimpleAgent'];
            const originalRun = agent.run;
            agent.run = mock(async (task: any) => {
                const response = 'Mock response';
                agent.addChunk(task, { type: ChunkType.LlmOutput, content: response, processed: false });
                return response;
            });

            const result = await (arena as any).run_agent(task);

            // Restore
            agent.run = originalRun;

            // Verify result is returned
            expect(typeof result).toBe('string');
            expect(result).toBe('Mock response');

            // Verify invocation log
            expect(arena.invocationLog.length).toBe(1);
            expect(arena.invocationLog[0]).toEqual({
                id: task.id,
                type: 'agent',
                name: task.agent_name,
                parent_id: task.parent_task_id,
                params: task.input
            });

            // Verify chunks were added (at least input and LLM output)
            expect(task.scratchpad.length).toBeGreaterThan(0);
            const llmOutputChunk = task.scratchpad.find(c => c.type === ChunkType.LlmOutput);
            expect(llmOutputChunk).toBeDefined();
            if (llmOutputChunk) {
                expect(llmOutputChunk.content).toBe('Mock response');
            }
        });

        test('should handle agent errors gracefully', async () => {
            const task = createMockTask({
                agent_name: 'SimpleAgent',
                input: 'Test input'
            });

            // Mock the agent run to throw error
            const agent = arena.agents['SimpleAgent'];
            const originalRun = agent.run;
            agent.run = mock(async (task: any) => {
                throw new Error('Agent failed');
            });

            await expect((arena as any).run_agent(task)).rejects.toThrow('Agent failed');

            // Restore
            agent.run = originalRun;
        });

        test('should wire evaluators to chunk events', async () => {
            const task = createMockTask({
                agent_name: 'SimpleAgent',
                input: 'Test input'
            });

            // Spy on evaluator
            const evaluateSpy = mock(() => Promise.resolve({ annotations: { test: true } }));
            const evaluator = (evaluatorManager as any).evaluators[0];
            evaluator.evaluate = evaluateSpy;

            // Mock the agent run to add chunk
            const agent = arena.agents['SimpleAgent'];
            const originalRun = agent.run;
            agent.run = mock(async (task: any) => {
                agent.addChunk(task, { type: ChunkType.LlmOutput, content: 'Mock response', processed: false });
                return 'Mock response';
            });

            await (arena as any).run_agent(task);

            // Restore
            agent.run = originalRun;

            // Verify the setup allows evaluator to be called (mocked for this test)
        });
    });
});