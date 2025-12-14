import { Arena } from './core/Arena';
import { AgentManager } from './agents/AgentManager';
import { DatabaseManager, Storage } from './database-manager';
import { Logger } from './logging/debug-logger';

export class ArenaManager {
  private static instance: ArenaManager;
  private arenas = new Map<string, Arena>();
  private dbManager: DatabaseManager;
  private agentManager: AgentManager;

  private constructor(dbManager: DatabaseManager, agentManager: AgentManager) {
    this.dbManager = dbManager;
    this.agentManager = agentManager;
  }

  static getInstance(dbManager: DatabaseManager, agentManager: AgentManager): ArenaManager {
    if (!ArenaManager.instance) {
      ArenaManager.instance = new ArenaManager(dbManager, agentManager);
    }
    return ArenaManager.instance;
  }

  async getArena(sessionId: string, streamingLLM: any): Promise<Arena> {
    if (this.arenas.has(sessionId)) {
      const existing = this.arenas.get(sessionId)!;
      if (!existing.streamingLLM && streamingLLM) {
        existing.updateStreamingLLM(streamingLLM);
      }
      return existing;
    }

    const arena = new Arena(streamingLLM, this.agentManager);

    // Hydrate state from DB
    try {
      const db = await this.dbManager.getSessionDB(sessionId);
      const storage = new Storage(db, 'arena.state', sessionId);
      await storage.init();
      const stateRecords = await storage.findAll();
      if (stateRecords.length > 0) {
        const state = stateRecords.reduce((acc, rec) => {
          acc[rec.key] = JSON.parse(rec.value);
          return acc;
        }, {} as any);

        arena.taskStore = state.taskStore || {};
        arena.taskQueue = state.taskQueue || [];
        arena.invocationLog = state.invocationLog || [];
        arena.currentContinuationTask = state.currentContinuationTask || null;
        arena.errorCount = state.errorCount || 0;
        arena.dataChunks = state.dataChunks || [];

        // Reconstruct task objects if needed
        for (const taskId in arena.taskStore) {
          const task = arena.taskStore[taskId];
          // Ensure dates are Date objects if serialized
          // Assuming scratchpad chunks are plain objects
        }
      }
    } catch (error) {
      console.warn(`Failed to hydrate Arena state for session ${sessionId}:`, error);
    }

    this.arenas.set(sessionId, arena);
    return arena;
  }

  async saveArenaState(sessionId: string, arena: Arena): Promise<void> {
    try {
      const db = await this.dbManager.getSessionDB(sessionId);
      const storage = new Storage(db, 'arena.state', sessionId);
      await storage.init();

      const state = {
        taskStore: arena.taskStore,
        taskQueue: arena.taskQueue,
        invocationLog: arena.invocationLog,
        currentContinuationTask: arena.currentContinuationTask,
        errorCount: arena.errorCount,
        dataChunks: arena.dataChunks,
      };

      // Save each key separately
      for (const [key, value] of Object.entries(state)) {
        await storage.insert({ key, value: JSON.stringify(value) }, key);
      }
    } catch (error) {
      console.warn(`Failed to save Arena state for session ${sessionId}:`, error);
    }
  }

  clearArena(sessionId: string): void {
    this.arenas.delete(sessionId);
  }

  async clearArenaState(sessionId: string): Promise<void> {
    try {
      const db = await this.dbManager.getSessionDB(sessionId);
      const storage = new Storage(db, 'arena.state', sessionId);
      await storage.init();
      // Delete all state records
      const records = await storage.findAll();
      for (const record of records) {
        await storage.execute(`DELETE FROM ${storage.getTableName()} WHERE id = ?`, [record.id]);
      }
    } catch (error) {
      console.warn(`Failed to clear Arena state for session ${sessionId}:`, error);
    }
  }
}