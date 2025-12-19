import { Task, Chunk, ChunkType } from '../../interfaces/AgentTypes';

// Helper function to create a mock task
export function createMockTask(overrides: Partial<Task> = {}): Task {
    return {
        id: 'mock-task-id',
        agent_name: 'MockAgent',
        input: 'test input',
        parent_task_id: null,
        scratchpad: [],
        retryCount: 0,
        executionCount: 0,
        ...overrides
    };
}

// Helper function to create a mock chunk
export function createMockChunk(overrides: Partial<Chunk> = {}): Chunk {
    return {
        type: ChunkType.Input,
        content: 'test content',
        processed: false,
        ...overrides
    };
}