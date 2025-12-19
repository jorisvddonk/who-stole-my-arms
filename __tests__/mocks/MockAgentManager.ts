import { LLMAgent } from '../../lib/core/LLMAgent';
import { MockAgent } from './MockAgent';
import { MockStreamingLLM } from './MockStreamingLLM';

// Mock AgentManager class
export class MockAgentManager {
    private agents: Record<string, LLMAgent> = {};

    constructor() {
        this.agents = {
            'MockAgent': new MockAgent(new MockStreamingLLM(), null),
            'ErrorAgent': new MockAgent(new MockStreamingLLM(), null)
        };
    }

    getAgents(): Record<string, LLMAgent> {
        return { ...this.agents };
    }
}