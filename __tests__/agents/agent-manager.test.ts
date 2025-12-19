import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { AgentManager } from '../../lib/agents/AgentManager';
import { LLMAgent } from '../../lib/core/LLMAgent';
import { MockStreamingLLM } from '../mocks/MockStreamingLLM';
import { setupTestEnv } from '../test-setup';

setupTestEnv();

// Mock agent for testing
class MockTestAgent extends LLMAgent {
    constructor(streamingLLM: any, arena: any) {
        super(streamingLLM, arena);
    }

    buildPrompt(task: any): string {
        return 'Mock prompt';
    }
}

describe('AgentManager', () => {
    let streamingLLM: MockStreamingLLM;
    let agentManager: AgentManager;

    beforeEach(() => {
        streamingLLM = new MockStreamingLLM();
        // Reset singleton instance
        (AgentManager as any).instance = undefined;
        agentManager = AgentManager.getInstance();
    });

    describe('getInstance', () => {
        test('should return singleton instance', () => {
            const instance1 = AgentManager.getInstance();
            const instance2 = AgentManager.getInstance();

            expect(instance1).toBe(instance2);
            expect(instance1).toBeInstanceOf(AgentManager);
        });
    });

    describe('init', () => {
        test('should initialize with hardcoded agents', async () => {
            await agentManager.init(streamingLLM);

            const agents = agentManager.getAgents();

            // Check that hardcoded agents are loaded
            expect(agents.TopLevelAgent).toBeDefined();
            expect(agents.ConversationalAgent).toBeDefined();
            expect(agents.SimpleAgent).toBeDefined();
            expect(agents.CombatAgent).toBeDefined();
            expect(agents.MathAgent).toBeDefined();
            expect(agents.ErrorAgent).toBeDefined();
            expect(agents.RPGGameMasterAgent).toBeDefined();
            expect(agents.ExampleAgent).toBeDefined();
            expect(agents.SentimentAgent).toBeDefined();

            // Verify all agents are LLMAgent instances
            for (const agent of Object.values(agents)) {
                expect(agent).toBeInstanceOf(LLMAgent);
            }
        });

        test('should not reinitialize if already initialized', async () => {
            await agentManager.init(streamingLLM);
            const firstAgents = { ...agentManager.getAgents() };

            // Mock the agents assignment to detect if it runs again
            const originalAgents = (agentManager as any).agents;
            let initCount = 0;
            Object.defineProperty(agentManager, 'agents', {
                set(value) {
                    initCount++;
                    (agentManager as any)._agents = value;
                },
                get() {
                    return (agentManager as any)._agents;
                }
            });

            await agentManager.init(streamingLLM);

            expect(initCount).toBe(0); // Should not have reassigned agents
        });
    });

    describe('getAgents', () => {
        test('should return copy of agents record', async () => {
            await agentManager.init(streamingLLM);
            const agents1 = agentManager.getAgents();
            const agents2 = agentManager.getAgents();

            expect(agents1).toEqual(agents2);
            expect(agents1).not.toBe(agents2); // Should be different objects
        });
    });

    describe('getAgentNames', () => {
        test('should return array of agent names', async () => {
            await agentManager.init(streamingLLM);
            const names = agentManager.getAgentNames();

            expect(Array.isArray(names)).toBe(true);
            expect(names.length).toBeGreaterThan(0);
            expect(names).toContain('TopLevelAgent');
            expect(names).toContain('ErrorAgent');
        });
    });

    describe('getAgent', () => {
        test('should return specific agent by name', async () => {
            await agentManager.init(streamingLLM);
            const agent = agentManager.getAgent('TopLevelAgent');

            expect(agent).toBeDefined();
            expect(agent).toBeInstanceOf(LLMAgent);
        });

        test('should return undefined for non-existent agent', async () => {
            await agentManager.init(streamingLLM);
            const agent = agentManager.getAgent('NonExistentAgent');

            expect(agent).toBeUndefined();
        });
    });

    describe('dynamic agent loading', () => {
        test('should handle dynamic agent loading when WSMA_AGENT_SEARCH_PATH is set', async () => {
            // This is complex to test without actual file system operations
            // For now, just verify the method exists and can be called
            const originalEnv = process.env.WSMA_AGENT_SEARCH_PATH;
            process.env.WSMA_AGENT_SEARCH_PATH = '/non/existent/path';

            // Reinitialize to test dynamic loading
            (AgentManager as any).instance = undefined;
            const freshManager = AgentManager.getInstance();

            await freshManager.init(streamingLLM);

            // Should still have the hardcoded agents
            expect(freshManager.getAgentNames().length).toBeGreaterThan(0);

            // Restore environment
            if (originalEnv) {
                process.env.WSMA_AGENT_SEARCH_PATH = originalEnv;
            } else {
                delete process.env.WSMA_AGENT_SEARCH_PATH;
            }
        });

        test('should skip dynamic loading when WSMA_AGENT_SEARCH_PATH is not set', async () => {
            const originalEnv = process.env.WSMA_AGENT_SEARCH_PATH;
            delete process.env.WSMA_AGENT_SEARCH_PATH;

            (AgentManager as any).instance = undefined;
            const freshManager = AgentManager.getInstance();

            await freshManager.init(streamingLLM);

            // Should have loaded hardcoded agents
            expect(freshManager.getAgentNames().length).toBeGreaterThan(0);

            // Restore environment
            if (originalEnv) {
                process.env.WSMA_AGENT_SEARCH_PATH = originalEnv;
            }
        });
    });
});