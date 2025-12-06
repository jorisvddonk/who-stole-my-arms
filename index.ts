import { readFile } from "fs/promises";
import { KoboldAPI } from "./lib/llm-api/KoboldAPI.js";
import { logGenerate, logError } from "./lib/logging/logger.js";
import { applyLoggingMiddleware } from "./lib/middleware/logging.js";
import { toolboxCollector } from "./lib/toolbox-collector.js";
import { widgetCollector } from "./lib/widget-collector.js";
import { OsMetricsTool } from "./lib/tools/os-metrics-tool.js";
import { OsMetricsDockWidget } from "./lib/widgets/os-metrics-dock-widget.js";

const api = new KoboldAPI();
const osMetricsTool = new OsMetricsTool(toolboxCollector);
const osMetricsDockWidget = new OsMetricsDockWidget();

// Define routes without logging (logging will be applied via middleware)
const routes = {
  ...osMetricsTool.getRoutes(),
  ...osMetricsDockWidget.getRoutes(),
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
  "/generate": {
    POST: async (req) => {
      try {
        const body = await req.json();
        const prompt = body.prompt;
        if (!prompt) {
          return new Response(JSON.stringify({ error: 'Prompt required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const text = await api.generate(prompt);
        logGenerate(prompt, text.length);
        return new Response(JSON.stringify({ text }), { headers: { 'Content-Type': 'application/json' } });
      } catch (error) {
        logError(error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }
  },
  "/generateStream": {
    POST: async (req) => {
      try {
        const body = await req.json();
        const prompt = body.prompt;
        if (!prompt) {
          return new Response(JSON.stringify({ error: 'Prompt required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // For streaming, we'll use Server-Sent Events
        const stream = new ReadableStream({
          async start(controller) {
            try {
              let totalLength = 0;
              for await (const token of api.generateStream(prompt)) {
                totalLength += token.length;
                const data = JSON.stringify({ token });
                controller.enqueue(`data: ${data}\n\n`);
              }
              // Send completion signal
              controller.enqueue(`data: ${JSON.stringify({ done: true })}\n\n`);
              logGenerate(prompt, totalLength);
            } catch (error) {
              logError(error.message);
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
  },
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
  "/llm/tokens": {
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
  },
  "/generate/abort": {
    POST: async (req) => {
      try {
        const success = await api.abortGeneration();
        return new Response(JSON.stringify({ success }), { headers: { 'Content-Type': 'application/json' } });
      } catch (error) {
        logError(error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }
  }
};

const server = Bun.serve({
  port: 3000,
  routes: applyLoggingMiddleware(routes),
  fetch(req) {
    logRequest(req);
    return new Response('Not found', { status: 404 });
  }
});

console.log(`Server running at ${server.url}`);