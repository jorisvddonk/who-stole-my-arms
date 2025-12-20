import { describe, test, expect, beforeEach } from 'bun:test';
import { ChatHistory } from '../../lib/chat-history';
import { ArenaManager } from '../../lib/arena-manager';
import { DatabaseManager } from '../../lib/database-manager';
import { AgentManager } from '../../lib/agents/AgentManager';
import { EvaluatorManager } from '../../lib/evaluators/EvaluatorManager';
import { MockStreamingLLM } from '../mocks/MockStreamingLLM';
import { ChunkType } from '../../interfaces/AgentTypes';
import { setupTestEnv } from '../test-setup';

setupTestEnv();

describe('Chat History End-to-End', () => {
  let dbManager: DatabaseManager;
  let arenaManager: ArenaManager;
  let chatHistory: ChatHistory;
  let streamingLLM: MockStreamingLLM;

  beforeEach(async () => {
    // Reset singletons
    (AgentManager as any).instance = undefined;
    (EvaluatorManager as any).instance = undefined;

    dbManager = new DatabaseManager();

    streamingLLM = new MockStreamingLLM();
    const agentManager = AgentManager.getInstance();
    const evaluatorManager = EvaluatorManager.getInstance();

    await agentManager.init(streamingLLM);
    evaluatorManager.init(streamingLLM);

    arenaManager = ArenaManager.getInstance(dbManager, agentManager, evaluatorManager);
    chatHistory = new ChatHistory(dbManager, arenaManager);
  });




});