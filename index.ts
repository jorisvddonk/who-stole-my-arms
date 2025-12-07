import { readFile } from "fs/promises";
import { KoboldAPI } from "./lib/llm-api/KoboldAPI.js";
import { logRequest, logGenerate, logError } from "./lib/logging/logger.js";
import { applyLoggingMiddleware } from "./lib/middleware/logging.js";
import { applyStorageMiddleware } from "./lib/middleware/database.js";
import { toolboxCollector } from "./lib/toolbox-collector.js";
import { widgetCollector } from "./lib/widget-collector.js";
import { DatabaseManager, Storage } from "./lib/database-manager.js";
import { OsMetricsTool } from "./lib/tools/os-metrics-tool.js";
import { KoboldSettingsTool } from "./lib/tools/kobold-settings-tool.js";

import { OsMetricsDockWidget } from "./lib/widgets/os-metrics-dock-widget.js";
import { CharacterBioDockWidget } from "./lib/widgets/character-bio-dock-widget.js";
import { PromptManager } from "./lib/prompt-manager.js";
import { SystemPromptProvider } from "./lib/providers/system-prompt-provider.js";
import { ToolPromptProvider } from "./lib/providers/tool-prompt-provider.js";

import { ChatHistory } from "./lib/chat-history.js";
import { DockManager } from "./lib/dock-manager.js";
import { createMethodRouter } from "./lib/util/route-utils.js";
import { LLMToolManager } from "./lib/llm-tool-manager.js";
import { DieTool } from "./lib/tools/die-tool.js";
import { ToolCallingLLM } from "./lib/tool-calling-llm.js";

// Initialize database manager
const dbManager = new DatabaseManager();

// Create components
const koboldSettingsTool = new KoboldSettingsTool(toolboxCollector, (settings) => {
  api.updateSettings(settings);
});
const osMetricsTool = new OsMetricsTool(toolboxCollector);
const osMetricsDockWidget = new OsMetricsDockWidget();
const characterBioDockWidget = new CharacterBioDockWidget();
const dockManager = new DockManager(toolboxCollector);

// Initialize ChatHistory
const chatHistory = new ChatHistory(dbManager);

// Initialize PromptManager and providers
const promptManager = new PromptManager(toolboxCollector);
const systemPromptProvider = new SystemPromptProvider();
promptManager.registerProvider('system', systemPromptProvider);
promptManager.registerProvider('character-bio', characterBioDockWidget);
promptManager.registerProvider('chat', chatHistory);

// Register global components
await dbManager.registerGlobalComponent(koboldSettingsTool);

// Session components are now stateless and initialize storage per request

// Create API after settings are loaded
const baseApi = new KoboldAPI(koboldSettingsTool.getSettings().baseUrl, koboldSettingsTool.getSettings());

// Initialize LLM tool system
const toolManager = new LLMToolManager();
const dieTool = new DieTool();
toolManager.registerTool(dieTool);

// Initialize tool prompt provider
const toolPromptProvider = new ToolPromptProvider(toolManager);
promptManager.registerProvider('tools', toolPromptProvider);

// Wrap API with tool calling
const api = new ToolCallingLLM(baseApi, toolManager);

// Define route groups
const routeGroups = [
  osMetricsTool,
  koboldSettingsTool,
  osMetricsDockWidget,
  characterBioDockWidget,
  dockManager,
  promptManager,
  chatHistory,
  {
    routes: {
      "/sessions": createMethodRouter({
        GET: async (req) => {
          const sessions = await dbManager.listSessions();
          return new Response(JSON.stringify({ sessions }), { headers: { 'Content-Type': 'application/json' } });
        },
        POST: async (req) => {
          // For now, generate a simple session ID
          const sessionId = `session_${Date.now()}`;
          // Note: actual session creation happens when storage is requested
          return new Response(JSON.stringify({ sessionId }), { headers: { 'Content-Type': 'application/json' } });
        }
      }),
      "/sessions/:id": createMethodRouter({
        DELETE: async (req) => {
          const sessionId = (req as any).params.id;
          await dbManager.deleteSession(sessionId);
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }
      }),
      "/": async (req) => {
        try {
          const content = await readFile('./frontend/index.html');
          return new Response(content, { headers: { 'Content-Type': 'text/html' } });
        } catch {
          return new Response('Frontend not found', { status: 404 });
        }
      },
      "/toolbox/list": (req) => {
        console.log('Serving toolbox list');
        const tools = toolboxCollector.getTools();
        console.log('Tools:', tools);
        return new Response(JSON.stringify({ tools }), { headers: { 'Content-Type': 'application/json' } });
      },
      "/widgets/list": (req) => {
        console.log('Serving widgets list');
        const widgets = widgetCollector.getWidgets();
        console.log('Widgets:', widgets);
        return new Response(JSON.stringify({ widgets }), { headers: { 'Content-Type': 'application/json' } });
      },
      "/widgets/*": async (req) => {
        const url = new URL(req.url);
        try {
          const filePath = `./frontend${url.pathname}`;
          const content = await readFile(filePath);
          return new Response(content, { headers: { 'Content-Type': 'application/javascript' } });
        } catch {
          return new Response('File not found', { status: 404 });
        }
      },
        "/sessions/:sessionId/generate": createMethodRouter({
          POST: async (req) => {
            try {
              const sessionId = (req as any).params.sessionId;
              const db = await dbManager.getSessionDB(sessionId);
              const promptStorage = new Storage(db, promptManager.getFQDN(), sessionId);
              await promptManager.init(promptStorage);
              const chatStorage = new Storage(db, chatHistory.getFQDN(), sessionId);
              await chatHistory.init(chatStorage);
              const bioStorage = new Storage(db, characterBioDockWidget.getFQDN(), sessionId);
              await characterBioDockWidget.init(bioStorage);

              const body = await req.json();
              const userPrompt = body.prompt;
              if (!userPrompt) {
                return new Response(JSON.stringify({ error: 'Prompt required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
              }

               // Get the chatMessage template prefix
               const templateGroups = await promptManager.loadTemplate(promptStorage, 'chatMessage');
               let prefix = '';
               if (templateGroups) {
                 prefix = await promptManager.getPrompt(templateGroups, { sessionId });
               }
                const fullPrompt = prefix ? prefix + '\n\n' + userPrompt : userPrompt;

                const text = await api.generate(fullPrompt, sessionId);

                // Add user message to history
               await chatHistory.addMessage(chatStorage, 'user', userPrompt);

                // Add generated message to history
               const messageId = await chatHistory.addMessage(chatStorage, 'game-master', text);

              logGenerate(userPrompt, text.length);
              return new Response(JSON.stringify({ text, messageId }), { headers: { 'Content-Type': 'application/json' } });
           } catch (error) {
             logError(error.message);
             return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
           }
         }
       }),
        "/sessions/:sessionId/generateStream": createMethodRouter({
          POST: async (req) => {
            try {
              const sessionId = (req as any).params.sessionId;
              const db = await dbManager.getSessionDB(sessionId);
              const promptStorage = new Storage(db, promptManager.getFQDN(), sessionId);
              await promptManager.init(promptStorage);
              const chatStorage = new Storage(db, chatHistory.getFQDN(), sessionId);
              await chatHistory.init(chatStorage);
              const bioStorage = new Storage(db, characterBioDockWidget.getFQDN(), sessionId);
              await characterBioDockWidget.init(bioStorage);

              const body = await req.json();
              const userPrompt = body.prompt;
              if (!userPrompt) {
                return new Response(JSON.stringify({ error: 'Prompt required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
              }

              // Get the chatMessage template prefix
              const templateGroups = await promptManager.loadTemplate(promptStorage, 'chatMessage');
              let prefix = '';
              if (templateGroups) {
                prefix = await promptManager.getPrompt(templateGroups, { sessionId });
              }
              const fullPrompt = prefix ? prefix + '\n\n' + userPrompt : userPrompt;

             // For streaming, we'll use Server-Sent Events
             const stream = new ReadableStream({
               async start(controller) {
                 try {
                    let totalLength = 0;
                    let fullResponse = '';
                     for await (const chunk of api.generateStream(fullPrompt, sessionId)) {
                      if (chunk.token) {
                        totalLength += chunk.token.length;
                        fullResponse += chunk.token;
                        const data = JSON.stringify({ token: chunk.token });
                        controller.enqueue(`data: ${data}\n\n`);
                       } else if (chunk.tool_call) {
                         const data = JSON.stringify({ tool_call: chunk.tool_call });
                         controller.enqueue(`data: ${data}\n\n`);
                       } else if (chunk.tool_result) {
                         const data = JSON.stringify({ tool_result: chunk.tool_result });
                         controller.enqueue(`data: ${data}\n\n`);
                        } else if (chunk.finishReason) {
                         const data = JSON.stringify({ finishReason: chunk.finishReason });
                         controller.enqueue(`data: ${data}\n\n`);
                         // Add user message to history
                         await chatHistory.addMessage(chatStorage, 'user', userPrompt);
                         // Add generated message to history
                         const messageId = await chatHistory.addMessage(chatStorage, 'game-master', fullResponse, new Date(), chunk.finishReason);
                         const idData = JSON.stringify({ messageId });
                         controller.enqueue(`data: ${idData}\n\n`);
                         logGenerate(userPrompt, totalLength);
                         break;
                       }
                    }
                   } catch (error) {
                      logError(error.message);
                      // If there was partial response, store it as aborted
                      if (fullResponse) {
                        await chatHistory.addMessage(chatStorage, 'user', userPrompt);
                        const messageId = await chatHistory.addMessage(chatStorage, 'game-master', fullResponse, new Date(), 'abort');
                        const idData = JSON.stringify({ messageId });
                        controller.enqueue(`data: ${idData}\n\n`);
                      }
                      controller.enqueue(`data: ${JSON.stringify({ error: error.message })}\n\n`);
                     }
                  finally {
                   controller.close();
                 }
               }
             });

             return new Response(stream, {
               headers: {
                 'Content-Type': 'text/event-stream',
                 'Cache-Control': 'no-cache',
                 'Connection': 'keep-alive',
               }
             });
           } catch (error) {
             logError(error.message);
             return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
           }
         }
        }),
         "/sessions/:sessionId/continue": createMethodRouter({
           POST: async (req) => {
             try {
               const sessionId = (req as any).params.sessionId;
               const db = await dbManager.getSessionDB(sessionId);
               const chatStorage = new Storage(db, chatHistory.getFQDN(), sessionId);
               await chatHistory.init(chatStorage);
               const bioStorage = new Storage(db, characterBioDockWidget.getFQDN(), sessionId);
               await characterBioDockWidget.init(bioStorage);

              const body = await req.json();
              const { messageId } = body;
              if (!messageId) {
                return new Response(JSON.stringify({ error: 'messageId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
              }

              // Get existing message
              const messages = await chatHistory.getMessages(chatStorage);
              const message = messages.find(m => m.id === messageId);
              if (!message || message.actor !== 'game-master') {
                return new Response(JSON.stringify({ error: 'Message not found or not a system message' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
              }

              // Get the chatMessage template prefix
              const promptStorage = new Storage(db, promptManager.getFQDN(), sessionId);
              await promptManager.init(promptStorage);
              const templateGroups = await promptManager.loadTemplate(promptStorage, 'chatMessage');
              let prefix = '';
              if (templateGroups) {
                prefix = await promptManager.getPrompt(templateGroups, { sessionId });
              }

              // Get all messages up to this point for context
              const contextMessages = messages.filter(m => m.finishedAt <= message.finishedAt);
              const contextPrompt = contextMessages.map(m => `${m.actor === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
               const fullPrompt = prefix ? prefix + '\n\n' + contextPrompt : contextPrompt;

               const text = await api.generate(fullPrompt, sessionId);

               // Append to existing message
              await chatHistory.appendToMessage(chatStorage, messageId, text);

              logGenerate(`Continue on message ${messageId}`, text.length);
              return new Response(JSON.stringify({ text }), { headers: { 'Content-Type': 'application/json' } });
            } catch (error) {
              logError(error.message);
              return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
          }
        }),
         "/sessions/:sessionId/continueStream": createMethodRouter({
           POST: async (req) => {
             try {
               const sessionId = (req as any).params.sessionId;
               const db = await dbManager.getSessionDB(sessionId);
               const chatStorage = new Storage(db, chatHistory.getFQDN(), sessionId);
               await chatHistory.init(chatStorage);
               const bioStorage = new Storage(db, characterBioDockWidget.getFQDN(), sessionId);
               await characterBioDockWidget.init(bioStorage);

              const body = await req.json();
              const { messageId } = body;
              if (!messageId) {
                return new Response(JSON.stringify({ error: 'messageId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
              }

              // Get existing message
              const messages = await chatHistory.getMessages(chatStorage);
              const message = messages.find(m => m.id === messageId);
              if (!message || message.actor !== 'game-master') {
                return new Response(JSON.stringify({ error: 'Message not found or not a system message' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
              }

              // Get the chatMessage template prefix
              const promptStorage = new Storage(db, promptManager.getFQDN(), sessionId);
              await promptManager.init(promptStorage);
              const templateGroups = await promptManager.loadTemplate(promptStorage, 'chatMessage');
              let prefix = '';
              if (templateGroups) {
                prefix = await promptManager.getPrompt(templateGroups, { sessionId });
              }

              // Get all messages up to this point for context
              const contextMessages = messages.filter(m => m.finishedAt <= message.finishedAt);
              const contextPrompt = contextMessages.map(m => `${m.actor === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
              const fullPrompt = prefix ? prefix + '\n\n' + contextPrompt : contextPrompt;

              // For streaming, we'll use Server-Sent Events
              const stream = new ReadableStream({
                async start(controller) {
                  try {
                    let totalLength = 0;
                    let additionalResponse = '';
                     for await (const chunk of api.generateStream(fullPrompt, sessionId)) {
                       if (chunk.token) {
                         totalLength += chunk.token.length;
                         additionalResponse += chunk.token;
                         const data = JSON.stringify({ token: chunk.token });
                         controller.enqueue(`data: ${data}\n\n`);
                       } else if (chunk.tool_call) {
                         const data = JSON.stringify({ tool_call: chunk.tool_call });
                         controller.enqueue(`data: ${data}\n\n`);
                       } else if (chunk.tool_result) {
                         const data = JSON.stringify({ tool_result: chunk.tool_result });
                         controller.enqueue(`data: ${data}\n\n`);
                       } else if (chunk.finishReason) {
                         const data = JSON.stringify({ finishReason: chunk.finishReason });
                         controller.enqueue(`data: ${data}\n\n`);
                         // Append to existing message
                         await chatHistory.appendToMessage(chatStorage, messageId, additionalResponse, chunk.finishReason);
                         logGenerate(`Continue on message ${messageId}`, totalLength);
                         break;
                       }
                     }
                  } catch (error) {
                    logError(error.message);
                    // If there was partial response, append it
                    if (additionalResponse) {
                      await chatHistory.appendToMessage(chatStorage, messageId, additionalResponse, 'abort');
                    }
                    controller.enqueue(`data: ${JSON.stringify({ error: error.message })}\n\n`);
                  } finally {
                    controller.close();
                  }
                }
              });

              return new Response(stream, {
                headers: {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  'Connection': 'keep-alive',
                }
              });
            } catch (error) {
              logError(error.message);
              return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
          }
        }),

       "/llm/settings": (req) => {
        // Check if the API supports streaming by checking if it's an instance of StreamingLLMInvoke
        const supportsStreaming = api instanceof Object && 'generateStream' in api;
        return new Response(JSON.stringify({
          supportsStreaming,
          model: 'KoboldCPP'
        }), { headers: { 'Content-Type': 'application/json' } });
      },
      "/llm/info": async (req) => {
        try {
          const [version, model, maxContext, perf] = await Promise.all([
            api.getVersion().catch(() => ({ version: 'unknown' })),
            api.getModel().catch(() => 'unknown'),
            api.getMaxContextLength().catch(() => 0),
            api.getPerformanceStats().catch(() => ({}))
          ]);

          return new Response(JSON.stringify({
            version,
            model,
            maxContextLength: maxContext,
            performance: perf
          }), { headers: { 'Content-Type': 'application/json' } });
        } catch (error) {
          logError(error.message);
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      },
      "/llm/tokens": createMethodRouter({
        POST: async (req) => {
          try {
            const body = await req.json();
            const text = body.text;
            if (!text) {
              return new Response(JSON.stringify({ error: 'Text required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            const result = await api.countTokens(text);
            return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            logError(error.message);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      }),
       "/generate/abort": createMethodRouter({
         POST: async (req) => {
           try {
             const success = await api.abortGeneration();
             return new Response(JSON.stringify({ success }), { headers: { 'Content-Type': 'application/json' } });
           } catch (error) {
             logError(error.message);
             return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
           }
         }
       })
    }
  }
];

const server = Bun.serve({
  port: 3000,
  routes: applyStorageMiddleware(dbManager, routeGroups.map(item => {
    if (item.routes) {
      return { routes: applyLoggingMiddleware(item.routes), component: item.component };
    } else {
      return { routes: applyLoggingMiddleware(item.getRoutes()), component: item };
    }
  })),
  fetch(req) {
    return new Response('Not found', { status: 404 });
  }
});

console.log(`Server running at ${server.url}`);