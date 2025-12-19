import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { ArenaManager } from '../../lib/arena-manager';
import { Arena } from '../../lib/core/Arena';
import { AgentManager } from '../../lib/agents/AgentManager';
import { EvaluatorManager } from '../../lib/evaluators/EvaluatorManager';
import { DatabaseManager, Storage } from '../../lib/database-manager';
import { MockStreamingLLM } from '../mocks/MockStreamingLLM';
import { MockAgentManager } from '../mocks/MockAgentManager';
import { MockEvaluatorManager } from '../mocks/MockEvaluatorManager';

// Mock storage for testing
class MockStorage implements Storage {
    private data: Record<string, any> = {};

    async init(): Promise<void> {}
    getTableName(): string { return 'test_table'; }
    getDB(): any { return {}; }
    getSessionId(): string | undefined { return 'test-session'; }
    execute(sql: string, params?: any[]): any {}
    query(sql: string, params?: any[]): any[] { return []; }
    async getComponentVersion(): Promise<number | null> { return null; }
    async setComponentVersion(version: number): Promise<void> {}
    async insert(data: any, id?: string): Promise<string> { const key = id || 'test'; this.data[key] = data; return key; }
    async update(id: string, data: any): Promise<void> { this.data[id] = data; }
    async delete(id: string): Promise<void> { delete this.data[id]; }
    async findAll(): Promise<any[]> { return Object.values(this.data); }
    async findById(id: string): Promise<any> { return this.data[id]; }
}

describe('ArenaManager', () => {
    let streamingLLM: MockStreamingLLM;
    let agentManager: MockAgentManager;
    let evaluatorManager: MockEvaluatorManager;
    let dbManager: DatabaseManager;
    let arenaManager: ArenaManager;

    beforeEach(() => {
        streamingLLM = new MockStreamingLLM();
        agentManager = new MockAgentManager();
        evaluatorManager = new MockEvaluatorManager();

        // Mock DatabaseManager
        dbManager = {
            getSessionDB: mock(async () => ({
                run: mock(() => {}),
                query: mock(() => ({ all: mock(() => []) }))
            }))
        } as any;

        // Reset singleton instance
        (ArenaManager as any).instance = undefined;
        arenaManager = ArenaManager.getInstance(dbManager, agentManager, evaluatorManager);
    });

    describe('getInstance', () => {
        test('should return singleton instance', () => {
            const instance1 = ArenaManager.getInstance(dbManager, agentManager, evaluatorManager);
            const instance2 = ArenaManager.getInstance(dbManager, agentManager, evaluatorManager);

            expect(instance1).toBe(instance2);
            expect(instance1).toBeInstanceOf(ArenaManager);
        });
    });

    describe('getArena', () => {
        test('should create new arena for new session', async () => {
            const sessionId = 'test-session';
            const arena = await arenaManager.getArena(sessionId, streamingLLM);

            expect(arena).toBeInstanceOf(Arena);
            expect(arena.streamingLLM).toBe(streamingLLM);
        });

        test('should return existing arena for existing session', async () => {
            const sessionId = 'test-session';

            const arena1 = await arenaManager.getArena(sessionId, streamingLLM);
            const arena2 = await arenaManager.getArena(sessionId, streamingLLM);

            expect(arena1).toBe(arena2);
        });

        test('should update streaming LLM if not set on existing arena', async () => {
            const sessionId = 'test-session';

            // Create arena without streaming LLM
            const arena1 = await arenaManager.getArena(sessionId, null);
            expect(arena1.streamingLLM).toBeNull();

            // Get arena again with streaming LLM
            const arena2 = await arenaManager.getArena(sessionId, streamingLLM);
            expect(arena2.streamingLLM).toBe(streamingLLM);
        });

        test('should hydrate arena state from database', async () => {
            const sessionId = 'test-session';

            // Mock storage with state data
            const mockStorage = new MockStorage();
            await mockStorage.insert({
                taskStore: { 'task1': { id: 'task1', agent_name: 'TestAgent' } },
                taskQueue: [],
                invocationLog: [],
                currentContinuationTask: null,
                errorCount: 5,
                dataChunks: []
            });

            // Mock dbManager to return database with storage
            const mockDB = {
                run: mock(() => {}),
                query: mock(() => ({ all: mock(() => [
                    { id: 'taskStore', key: 'taskStore', value: JSON.stringify({ 'task1': { id: 'task1', agent_name: 'TestAgent' } }) },
                    { id: 'taskQueue', key: 'taskQueue', value: JSON.stringify([]) },
                    { id: 'invocationLog', key: 'invocationLog', value: JSON.stringify([]) },
                    { id: 'currentContinuationTask', key: 'currentContinuationTask', value: JSON.stringify(null) },
                    { id: 'errorCount', key: 'errorCount', value: JSON.stringify(5) },
                    { id: 'dataChunks', key: 'dataChunks', value: JSON.stringify([]) }
                ]) }))
            };
            dbManager.getSessionDB = mock(async () => mockDB);

            // Mock Storage constructor to return our mock storage
            const originalStorage = (global as any).Storage;
            (global as any).Storage = class extends MockStorage {};

            const arena = await arenaManager.getArena(sessionId, streamingLLM);

            expect(arena.errorCount).toBe(5);

            // Restore original Storage
            if (originalStorage) {
                (global as any).Storage = originalStorage;
            }
        });
    });

    describe('saveArenaState', () => {
        test('should save arena state to database', async () => {
            const sessionId = 'test-session';
            const arena = await arenaManager.getArena(sessionId, streamingLLM);

            // Set some state on the arena
            arena.errorCount = 3;
            arena.taskStore = { 'task1': { id: 'task1', agent_name: 'TestAgent' } };

            await arenaManager.saveArenaState(sessionId, arena);

            // Verify database operations were called
            expect(dbManager.getSessionDB).toHaveBeenCalledWith(sessionId);
        });

        test('should handle save errors gracefully', async () => {
            const sessionId = 'test-session';
            const arena = await arenaManager.getArena(sessionId, streamingLLM);

            // Mock dbManager to throw error
            dbManager.getSessionDB = mock(async () => {
                throw new Error('Database error');
            });

            // Should not throw
            await expect(arenaManager.saveArenaState(sessionId, arena)).resolves.toBeUndefined();
        });
    });

    describe('clearArena', () => {
        test('should remove arena from cache', async () => {
            const sessionId = 'test-session';

            // Create arena
            await arenaManager.getArena(sessionId, streamingLLM);

            // Verify it exists
            expect((arenaManager as any).arenas.has(sessionId)).toBe(true);

            // Clear arena
            arenaManager.clearArena(sessionId);

            // Verify it was removed
            expect((arenaManager as any).arenas.has(sessionId)).toBe(false);
        });
    });

    describe('clearArenaState', () => {
        test('should clear arena state from database', async () => {
            const sessionId = 'test-session';

            await arenaManager.clearArenaState(sessionId);

            // Verify database operations were called
            expect(dbManager.getSessionDB).toHaveBeenCalledWith(sessionId);
        });

        test('should handle clear errors gracefully', async () => {
            const sessionId = 'test-session';

            // Mock dbManager to throw error
            dbManager.getSessionDB = mock(async () => {
                throw new Error('Database error');
            });

            // Should not throw
            await expect(arenaManager.clearArenaState(sessionId)).resolves.toBeUndefined();
        });
    });
});