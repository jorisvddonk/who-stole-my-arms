import { EventEmitter } from 'node:events';
import { LLMAgent } from '../../lib/core/LLMAgent';
import { Task } from '../../interfaces/AgentTypes';

// Mock agent class
export class MockAgent extends LLMAgent {
    public fqdn = 'mock-agent';
    public supportsContinuation = false;
    public registeredAgents: Record<string, LLMAgent> = {};
    public tools: Record<string, any> = {};
    public evaluators: string[] = [];

    constructor(streamingLLM: any, arena: any) {
        super(streamingLLM, arena);
    }

    async run(task: Task): Promise<string> {
        return 'Mock agent response';
    }
}