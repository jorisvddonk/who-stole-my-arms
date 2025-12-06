import { Storage } from "./database-manager.js";
import { HasStorage } from "../interfaces/Storage.js";
import { PromptProvider, NamedGroup, Item } from "./prompt-manager.js";
import { logError } from './logging/logger.js';
import { createMethodRouter } from './util/route-utils.js';
import { DatabaseManager } from "./database-manager.js";

export interface ChatMessage {
  id: number;
  actor: 'user' | 'game-master';
  content: string;
  finishedAt: Date;
  finishReason: string | null;
}

export class ChatHistory implements HasStorage, PromptProvider {
  constructor(private dbManager: DatabaseManager) {}

  getFQDN(): string {
    return 'tools.chat.history';
  }

  getAvailablePromptGroups(): { name: string; description: string }[] {
    return [{ name: 'chatHistory', description: 'Recent chat messages for context' }];
  }

  async getNamedPromptGroup(groupName: string, context?: any): Promise<NamedGroup | null> {
    if (groupName !== 'chatHistory' || !context?.sessionId) {
      return null;
    }
    try {
      const db = await this.dbManager.getSessionDB(context.sessionId);
      const storage = new Storage(db, this.getFQDN(), context.sessionId);
      const messages = await this.getMessages(storage);
      const items: Item[] = messages.map(msg => ({
        type: 'prompt' as const,
        name: msg.actor,
        prompt: msg.content,
        tags: []
      }));
      return {
        type: 'group',
        name: 'chatHistory',
        items
      };
    } catch (error) {
      logError(`Failed to get chat history prompt group: ${error.message}`);
      return null;
    }
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

  async deleteMessage(storage: Storage, messageId: number): Promise<boolean> {
    try {
      await storage.execute(`DELETE FROM ${storage.getTableName()} WHERE id = ?`, [messageId]);
      return true;
    } catch (error) {
      logError(`Failed to delete message: ${error.message}`);
      return false;
    }
  }

  async appendToMessage(storage: Storage, messageId: number, additionalContent: string, finishReason: string | null = null): Promise<boolean> {
    try {
      const existingMessage = await storage.findById(messageId);
      if (!existingMessage) {
        return false;
      }
      const updatedContent = existingMessage.content + additionalContent;
      const updatedFinishReason = finishReason || existingMessage.finishReason;
      await storage.execute(`UPDATE ${storage.getTableName()} SET content = ?, finishReason = ? WHERE id = ?`, [updatedContent, updatedFinishReason, messageId]);
      return true;
    } catch (error) {
      logError(`Failed to append to message: ${error.message}`);
      return false;
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
      }),
      "/sessions/:sessionid/chat/messages/:messageid": createMethodRouter({
        DELETE: async (req) => {
          try {
            const storage = (req as any).context.get('storage');
            const messageId = parseInt(req.params.messageid);
            if (isNaN(messageId)) {
              return new Response(JSON.stringify({ error: 'Invalid message ID' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            const success = await this.deleteMessage(storage, messageId);
            if (success) {
              return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
            } else {
              return new Response(JSON.stringify({ error: 'Message not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
            }
          } catch (error) {
            logError(error.message);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      }),
      "/sessions/:sessionid/chat/messages/:messageid/continue": createMethodRouter({
        POST: async (req) => {
          try {
            const storage = (req as any).context.get('storage');
            const messageId = parseInt(req.params.messageid);
            if (isNaN(messageId)) {
              return new Response(JSON.stringify({ error: 'Invalid message ID' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            const body = await req.json();
            const { additionalContent, finishReason } = body;
            if (additionalContent === undefined) {
              return new Response(JSON.stringify({ error: 'additionalContent required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            const success = await this.appendToMessage(storage, messageId, additionalContent, finishReason);
            if (success) {
              return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
            } else {
              return new Response(JSON.stringify({ error: 'Message not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
            }
          } catch (error) {
            logError(error.message);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      })
    };
  }
}