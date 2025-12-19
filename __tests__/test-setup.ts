import { beforeAll, afterAll } from 'bun:test';

export function setupTestEnv() {
    // Prevent loading external agents and prompts during tests
    const originalAgentEnv = process.env.WSMA_AGENT_SEARCH_PATH;
    const originalPromptEnv = process.env.WSMA_SYSTEM_PROMPT_SEARCH_PATH;
    beforeAll(() => {
        delete process.env.WSMA_AGENT_SEARCH_PATH;
        delete process.env.WSMA_SYSTEM_PROMPT_SEARCH_PATH;
    });

    // Restore environment after tests
    afterAll(() => {
        if (originalAgentEnv !== undefined) {
            process.env.WSMA_AGENT_SEARCH_PATH = originalAgentEnv;
        }
        if (originalPromptEnv !== undefined) {
            process.env.WSMA_SYSTEM_PROMPT_SEARCH_PATH = originalPromptEnv;
        }
    });
}