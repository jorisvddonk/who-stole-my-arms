import { Storage } from "../interfaces/Storage.js";
import { HasStorage } from "../interfaces/Storage.js";
import { logError } from './logging/logger.js';
import { createMethodRouter } from './util/route-utils.js';

export interface ChatMessage {
  id: number;
  actor: 'user' | 'game-master';
  content: string;
  finishedAt: Date;
  finishReason: string | null;
}

export class ChatHistory implements HasStorage {
  getFQDN(): string {
    return 'tools.chat.history';
  }

  async init(storage: Storage): Promise<void> {
    const sessionId = storage.getSessionId();
    console.log(`\x1b[32mInitializing chat history database${sessionId ? ` for session \x1b[34m${sessionId}\x1b[32m` : ''}...\x1b[0m`);
    await storage.execute(`CREATE TABLE IF NOT EXISTS ${storage.getTableName()} (id INTEGER PRIMARY KEY, actor TEXT NOT NULL, content TEXT NOT NULL, finishedAt DATETIME NOT NULL, finishReason TEXT)`);
    const currentVersion = await storage.getComponentVersion();
    if (currentVersion === null) {
      await storage.setComponentVersion(1);
    }
  }

  async addMessage(storage: Storage, actor: 'user' | 'game-master', content: string, finishedAt: Date = new Date(), finishReason: string | null = null): Promise<void> {
    try {
      await storage.insert({
        actor,
        content,
        finishedAt: finishedAt.toISOString(),
        finishReason
      });
    } catch (error) {
      logError(`Failed to add message: ${error.message}`);
    }
  }

  async getMessages(storage: Storage): Promise<ChatMessage[]> {
    try {
      const rows = await storage.findAll();
      return rows.map(row => ({
        id: row.id,
        actor: row.actor as 'user' | 'game-master',
        content: row.content,
        finishedAt: new Date(row.finishedAt),
        finishReason: row.finishReason || null
      })).sort((a, b) => a.finishedAt.getTime() - b.finishedAt.getTime());
    } catch (error) {
      logError(`Failed to get messages: ${error.message}`);
      return [];
    }
  }

  getRoutes(): Record<string, any> {
    return {
      "/sessions/:sessionid/chat/messages": createMethodRouter({
        GET: async (req) => {
          const storage = (req as any).context.get('storage');
          const messages = await this.getMessages(storage);
          return new Response(JSON.stringify({ messages }), { headers: { 'Content-Type': 'application/json' } });
        },
        POST: async (req) => {
          try {
            const storage = (req as any).context.get('storage');
            const body = await req.json();
            const { actor, content, finishedAt, finishReason } = body;
            if (!actor || !content || !['user', 'game-master'].includes(actor)) {
              return new Response(JSON.stringify({ error: 'actor and content required, actor must be user or game-master' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            const date = finishedAt ? new Date(finishedAt) : new Date();
            await this.addMessage(storage, actor, content, date, finishReason);
            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            logError(error.message);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      })
    };
  }
}