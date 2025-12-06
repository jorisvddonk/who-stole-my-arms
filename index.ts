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
import { PromptManager } from "./lib/prompt-manager.js";
import { SystemPromptProvider } from "./lib/providers/system-prompt-provider.js";
import { ChatHistory } from "./lib/chat-history.js";
import { createMethodRouter } from "./lib/util/route-utils.js";

// Initialize database manager
const dbManager = new DatabaseManager();

// Create components
const koboldSettingsTool = new KoboldSettingsTool(toolboxCollector, (settings) => {
  api.updateSettings(settings);
});
const osMetricsTool = new OsMetricsTool(toolboxCollector);
const osMetricsDockWidget = new OsMetricsDockWidget();

// Initialize PromptManager and providers
const promptManager = new PromptManager(toolboxCollector);
const systemPromptProvider = new SystemPromptProvider();
promptManager.registerProvider('system', systemPromptProvider);

// Initialize ChatHistory
const chatHistory = new ChatHistory();

// Register global components
await dbManager.registerGlobalComponent(koboldSettingsTool);

// Session components are now stateless and initialize storage per request

// Create API after settings are loaded
const api = new KoboldAPI(koboldSettingsTool.getSettings().baseUrl, koboldSettingsTool.getSettings());

// Define route groups
const routeGroups = [
  osMetricsTool,
  koboldSettingsTool,
  osMetricsDockWidget,
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

             const body = await req.json();
             const userPrompt = body.prompt;
             if (!userPrompt) {
               return new Response(JSON.stringify({ error: 'Prompt required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
             }

             // Add user message to history
             await chatHistory.addMessage(chatStorage, 'user', userPrompt);

             // Get the chatMessage template prefix
             const prefix = await promptManager.getPromptFromTemplate(promptStorage, 'chatMessage');
             const fullPrompt = prefix ? prefix + '\n\n' + userPrompt : userPrompt;

             const text = await api.generate(fullPrompt);

             // Add generated message to history
             await chatHistory.addMessage(chatStorage, 'game-master', text);

             logGenerate(userPrompt, text.length);
             return new Response(JSON.stringify({ text }), { headers: { 'Content-Type': 'application/json' } });
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

             const body = await req.json();
             const userPrompt = body.prompt;
             if (!userPrompt) {
               return new Response(JSON.stringify({ error: 'Prompt required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
             }

             // Add user message to history
             await chatHistory.addMessage(chatStorage, 'user', userPrompt);

             // Get the chatMessage template prefix
             const prefix = await promptManager.getPromptFromTemplate(promptStorage, 'chatMessage');
             const fullPrompt = prefix ? prefix + '\n\n' + userPrompt : userPrompt;

             // For streaming, we'll use Server-Sent Events
             const stream = new ReadableStream({
               async start(controller) {
                 try {
                   let totalLength = 0;
                   let fullResponse = '';
                   for await (const chunk of api.generateStream(fullPrompt)) {
                     if (chunk.token) {
                       totalLength += chunk.token.length;
                       fullResponse += chunk.token;
                       const data = JSON.stringify({ token: chunk.token });
                       controller.enqueue(`data: ${data}\n\n`);
                     } else if (chunk.finishReason) {
                       const data = JSON.stringify({ finishReason: chunk.finishReason });
                       controller.enqueue(`data: ${data}\n\n`);
                       // Add generated message to history
                       await chatHistory.addMessage(chatStorage, 'game-master', fullResponse, new Date(), chunk.finishReason);
                       logGenerate(userPrompt, totalLength);
                       break;
                     }
                   }
                 } catch (error) {
                   logError(error.message);
                   // If there was partial response, store it as aborted
                   if (fullResponse) {
                     await chatHistory.addMessage(chatStorage, 'game-master', fullResponse, new Date(), 'abort');
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