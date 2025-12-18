import { Storage } from "./database-manager.js";
import { HasStorage } from "../interfaces/Storage.js";
import { PromptProvider, NamedGroup, Item } from "./prompt-manager.js";
import { logError } from './logging/logger.js';
import { createMethodRouter } from './util/route-utils.js';
import { DatabaseManager } from "./database-manager.js";
import { FormatterRegistry } from "./formatters.js";
import { FormatterSettingsTool } from "./tools/formatter-settings-tool.js";
import { Chunk, ChunkType } from "../interfaces/AgentTypes.js";
import { Arena } from "./core/Arena.js";

export interface ChatMessage {
  id: string;
  actor: 'user' | 'game-master';
  content: string;
  finishedAt: Date;
  finishReason: string | null;
}

export class ChatHistory implements PromptProvider {
  constructor(private dbManager: DatabaseManager, private arenaManager?: any) {}

  getFQDN(): string {
    return 'tools.chat.history';
  }

  getAvailablePromptGroups(): { name: string; description: string }[] {
    return [
      { name: 'chatHistory', description: 'Recent chat messages for context' },
      { name: 'chat', description: 'Full chat context including history and current user prompt' },
      { name: 'currentUserPrompt', description: 'The current user prompt being processed' }
    ];
  }

  async getNamedPromptGroup(groupName: string, context?: any): Promise<NamedGroup | null> {
    if (groupName === 'currentUserPrompt') {
      if (!context?.currentPrompt) {
        return null;
      }

      // Get formatter settings from session storage
      const selectedFormatterName = await FormatterSettingsTool.getSelectedFormatter(this.dbManager, context.sessionId);
      const registry = FormatterRegistry.getInstance();
      const formatter = registry.get(selectedFormatterName);

      let formattedPrompt = formatter?.userPrompt ? formatter.userPrompt(context.currentPrompt) : context.currentPrompt;
      let pre = formatter?.preUserPrompt ? formatter.preUserPrompt(context.currentPrompt) : '';
      let post = formatter?.postUserPrompt ? formatter.postUserPrompt(context.currentPrompt) : '';
      let prompt = pre + formattedPrompt + post;

      return {
        type: 'group',
        name: 'currentUserPrompt',
        items: [{
          type: 'prompt' as const,
          name: 'Current User',
          prompt,
          tags: []
        }]
      };
    }

    if (groupName === 'chat') {
      if (!context?.sessionId) {
        return null;
      }
      return {
        type: 'group',
        name: 'chat',
        items: [
          { type: 'groupRef', name: 'chat/chatHistory' },
          { type: 'groupRef', name: 'chat/currentUserPrompt' }
        ]
      };
    }

    if (groupName !== 'chatHistory' || !context?.sessionId) {
      return null;
    }
    try {
      const messages = await this.getMessages(this.arenaManager, context.sessionId);

      // Get formatter settings from session storage
      const selectedFormatterName = await FormatterSettingsTool.getSelectedFormatter(this.dbManager, context.sessionId);

      const registry = FormatterRegistry.getInstance();
      const formatter = registry.get(selectedFormatterName);
      const items: Item[] = [];
      if (formatter?.preFirstMessage && messages.length > 0) {
        items.push({
          type: 'prompt' as const,
          name: 'Pre',
          prompt: formatter.preFirstMessage(messages[0]),
          tags: []
        });
      }
      items.push(...messages.map(msg => ({
        type: 'prompt' as const,
        name: msg.actor,
        prompt: formatter ? formatter.historyMessage(msg) : msg.content,
        tags: []
      })));
      if (formatter?.postLastHistoryMessage && messages.length > 0) {
        items.push({
          type: 'prompt' as const,
          name: 'Post',
          prompt: formatter.postLastHistoryMessage(messages[messages.length - 1]),
          tags: []
        });
      }
      return {
        type: 'group',
        name: 'chatHistory',
        items
      };
    } catch (error) {
      logError(`Failed to get chat history prompt group: ${(error as Error).message}`);
      return null;
    }
  }



  async addMessage(arenaManager: any, sessionId: string, actor: 'user' | 'game-master', content: string, finishedAt: Date = new Date(), finishReason: string | null = null, id?: string): Promise<string> {
    try {
      const arena = await arenaManager.getArena(sessionId, null);
      const messageId = id || Math.random().toString(36).substring(2, 11);
      if (actor === 'user') {
        // Create a task for user input
        const task = {
          id: Arena.generateId(),
          agent_name: 'default', // dummy
          input: { text: content, messageId },
          parent_task_id: null,
          scratchpad: [],
          retryCount: 0,
          executionCount: 0
        };
        arena.taskStore[task.id] = task;
      } else if (actor === 'game-master') {
        // Add a chunk
        const chunk = {
          type: ChunkType.LlmOutput,
          content,
          processed: true,
          messageId
        };
        arena.dataChunks.push(chunk);
      }
      await arenaManager.saveArenaState(sessionId, arena);
      return messageId;
    } catch (error) {
      logError(`Failed to add message: ${(error as Error).message}`);
      throw error;
    }
  }

  async getMessages(arenaManager: any, sessionId: string): Promise<ChatMessage[]> {
    try {
      const arena = await arenaManager.getArena(sessionId, null);
      const messages: ChatMessage[] = [];
      const now = new Date();

      // Collect messages from top-level tasks only (parent_task_id === null)
      for (const taskId in arena.taskStore) {
        const task = arena.taskStore[taskId];
        if (task.parent_task_id !== null) continue;  // skip subagent tasks
        const hasInputChunks = task.scratchpad.some(chunk => chunk.type === 'input');
        // Add task.input only if no input chunks in scratchpad and it has messageId
        if (!hasInputChunks && task.input && task.input.messageId) {
          messages.push({
            id: task.input.messageId,
            actor: 'user',
            content: typeof task.input === 'string' ? task.input : task.input.text || JSON.stringify(task.input),
            finishedAt: now,
            finishReason: null
          });
        }
        // Add inputs and outputs from scratchpad
        for (const chunk of task.scratchpad) {
          if (chunk.messageId) {
            if (chunk.type === 'input') {
              messages.push({
                id: chunk.messageId,
                actor: 'user',
                content: chunk.content,
                finishedAt: now,
                finishReason: null
              });
            } else if (chunk.type === 'llmOutput') {
              messages.push({
                id: chunk.messageId,
                actor: 'game-master',
                content: chunk.content,
                finishedAt: now,
                finishReason: null
              });
            }
          }
        }
      }

      // Messages are collected in chronological order, no need to sort
      return messages;
    } catch (error) {
      logError(`Failed to get messages: ${(error as Error).message}`);
      return [];
    }
  }

  async deleteMessage(storage: Storage, messageId: string): Promise<boolean> {
    try {
      await storage.execute(`DELETE FROM ${storage.getTableName()} WHERE id = ?`, [messageId]);
      return true;
    } catch (error) {
      logError(`Failed to delete message: ${(error as Error).message}`);
      return false;
    }
  }

  async deleteMessagesFrom(arenaManager: any, sessionId: string, messageId: string): Promise<boolean> {
    try {
      const arena = await arenaManager.getArena(sessionId, null);
      const allMessages = await this.getMessages(arenaManager, sessionId);
      const index = allMessages.findIndex(msg => msg.id === messageId);
      if (index === -1) return false;
      const messagesToDelete = allMessages.slice(index);
      for (const msg of messagesToDelete) {
        if (msg.actor === 'user') {
          for (const taskId in arena.taskStore) {
            const task = arena.taskStore[taskId];
            if (task.input?.messageId === msg.id) {
              arena.removeTask(taskId);
              break;
            }
          }
        } else if (msg.actor === 'game-master') {
          arena.removeChunksByMessageId(msg.id);
        }
      }
      await arenaManager.saveArenaState(sessionId, arena);
      return true;
    } catch (error) {
      logError(`Failed to delete messages after: ${(error as Error).message}`);
      return false;
    }
  }

  async appendToMessage(arenaManager: any, sessionId: string, messageId: string, additionalContent: string, finishReason: string | null = null): Promise<boolean> {
    try {
      const arena = await arenaManager.getArena(sessionId, null);
      // Check user messages
      for (const taskId in arena.taskStore) {
        const task = arena.taskStore[taskId];
        if (task.input && task.input.messageId === messageId) {
          if (typeof task.input === 'string') {
            task.input += additionalContent;
          } else {
            task.input.text += additionalContent;
          }
          await arenaManager.saveArenaState(sessionId, arena);
          return true;
        }
      }
      // Check game-master messages
      for (const taskId in arena.taskStore) {
        const task = arena.taskStore[taskId];
        for (const chunk of task.scratchpad) {
          if (chunk.messageId === messageId) {
            chunk.content += additionalContent;
            await arenaManager.saveArenaState(sessionId, arena);
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      logError(`Failed to append to message: ${(error as Error).message}`);
      return false;
    }
  }

  async editMessage(arenaManager: any, sessionId: string, messageId: string, newContent: string): Promise<boolean> {
    try {
      const arena = await arenaManager.getArena(sessionId, null);
      // Find if user message
      for (const taskId in arena.taskStore) {
        const task = arena.taskStore[taskId];
        if (task.input && task.input.messageId === messageId) {
          if (typeof task.input === 'string') {
            task.input = newContent;
          } else {
            task.input.text = newContent;
          }
          await arenaManager.saveArenaState(sessionId, arena);
          return true;
        }
      }
      // Find if game-master message
      for (const taskId in arena.taskStore) {
        const task = arena.taskStore[taskId];
        for (const chunk of task.scratchpad) {
          if (chunk.messageId === messageId) {
            chunk.content = newContent;
            await arenaManager.saveArenaState(sessionId, arena);
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      logError(`Failed to edit message: ${(error as Error).message}`);
      return false;
    }
  }

  getRoutes(): Record<string, any> {
    return {
        "/sessions/:sessionid/chat/messages": createMethodRouter({
        GET: async (req) => {
          const sessionId = (req as any).params.sessionid;
          const messages = await this.getMessages(this.arenaManager, sessionId);
          return new Response(JSON.stringify({ messages }), { headers: { 'Content-Type': 'application/json' } });
        },
        POST: async (req) => {
           try {
             const sessionId = (req as any).params.sessionid;
             const body = await req.json();
             const { actor, content, finishedAt, finishReason } = body;
             if (!actor || !content || !['user', 'game-master'].includes(actor)) {
               return new Response(JSON.stringify({ error: 'actor and content required, actor must be user or game-master' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
             }
             await this.addMessage(this.arenaManager, sessionId, actor, content, finishedAt ? new Date(finishedAt) : new Date(), finishReason);
             return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
           } catch (error) {
             logError((error as Error).message);
             return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
           }
         }
      }),
        "/sessions/:sessionid/chat/messages/:messageid": createMethodRouter({
            PUT: async (req) => {
              try {
                const sessionId = (req as any).params.sessionid;
                const messageId = (req as any).params.messageid;
                const body = await req.json();
                const { content } = body;
                if (content === undefined) {
                  return new Response(JSON.stringify({ error: 'content required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                const success = await this.editMessage(this.arenaManager, sessionId, messageId, content);
                if (success) {
                  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
                } else {
                  return new Response(JSON.stringify({ error: 'Message not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
                }
              } catch (error) {
                logError((error as Error).message);
                return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
              }
            },
            DELETE: async (req) => {
              try {
                const messageId = (req as any).params.messageid;
                const sessionId = (req as any).params.sessionid;
                if (this.arenaManager) {
                  const arena = await this.arenaManager.getArena(sessionId, null);
                  let found = false;
                  // Check if user message
                  for (const taskId in arena.taskStore) {
                    const task = arena.taskStore[taskId];
                    if (task.input?.messageId === messageId) {
                      arena.removeTask(taskId);
                      found = true;
                      break;
                    }
                  }
                  if (!found) {
                    // Check if game-master message
                    for (const chunk of arena.dataChunks) {
                      if (chunk.messageId === messageId) {
                        arena.removeChunksByMessageId(messageId);
                        found = true;
                        break;
                      }
                    }
                  }
                  if (found) {
                    await this.arenaManager.saveArenaState(sessionId, arena);
                    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
                  }
                }
                return new Response(JSON.stringify({ error: 'Message not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
              } catch (error) {
                logError((error as Error).message);
                return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
              }
            }
         }),
         "/sessions/:sessionid/chat/messages/:messageid/delete-after": createMethodRouter({
           DELETE: async (req) => {
             try {
               const messageId = (req as any).params.messageid;
               const sessionId = (req as any).params.sessionid;
               const success = await this.deleteMessagesFrom(this.arenaManager, sessionId, messageId);
               if (success) {
                 return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
               } else {
                 return new Response(JSON.stringify({ error: 'Failed to delete messages' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
               }
             } catch (error) {
               logError((error as Error).message);
               return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
             }
           }
         }),
         "/sessions/:sessionid/chat/messages/:messageid/continue": createMethodRouter({
           POST: async (req) => {
             try {
               const sessionId = (req as any).params.sessionid;
               const messageId = (req as any).params.messageid;
               const body = await req.json();
               const { additionalContent, finishReason } = body;
               if (additionalContent === undefined) {
                 return new Response(JSON.stringify({ error: 'additionalContent required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
               }
               const success = await this.appendToMessage(this.arenaManager, sessionId, messageId, additionalContent, finishReason);
               if (success) {
                 return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
               } else {
                 return new Response(JSON.stringify({ error: 'Message not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
               }
             } catch (error) {
               logError((error as Error).message);
               return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
             }
           }
         }),
        "/sessions/:sessionid/chat/messages/:messageid/annotations": createMethodRouter({
          GET: async (req) => {
            try {
              const sessionId = (req as any).params.sessionid;
              const messageId = (req as any).params.messageid;
              if (this.arenaManager) {
                const arena = await this.arenaManager.getArena(sessionId, null);
                const chunks: Chunk[] = [];
                for (const taskId in arena.taskStore) {
                  const task = arena.taskStore[taskId];
                  chunks.push(...task.scratchpad.filter((chunk: Chunk) => chunk.messageId === messageId));
                }
                const annotations = chunks.flatMap((chunk: Chunk) => chunk.annotations || {});
                return new Response(JSON.stringify({ annotations }), { headers: { 'Content-Type': 'application/json' } });
              } else {
                return new Response(JSON.stringify({ annotations: [] }), { headers: { 'Content-Type': 'application/json' } });
              }
            } catch (error) {
              logError((error as Error).message);
              return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
          }
        })
    };
  }
}