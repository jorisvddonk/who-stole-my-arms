import { serve } from "bun";
import { readFile } from "fs/promises";
import { KoboldAPI } from "./lib/llm-api/KoboldAPI.js";
import { logRequest, logGenerate, logError } from "./lib/logging/logger.js";
import { getOSMetrics } from "./lib/util/os-metrics.js";
import { toolboxCollector } from "./lib/toolbox-collector.js";

const api = new KoboldAPI();

// Register OS metrics frontend
toolboxCollector.register('/widgets/os-metrics-widget.js');

serve({
  port: 3000,
  async fetch(req) {
    logRequest(req);
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/') {
      try {
        const content = await readFile('./frontend/index.html');
        return new Response(content, { headers: { 'Content-Type': 'text/html' } });
      } catch {
        return new Response('Frontend not found', { status: 404 });
      }
    }
    if (req.method === 'GET' && url.pathname === '/metrics') {
      const metrics = getOSMetrics();
      return new Response(JSON.stringify(metrics), { headers: { 'Content-Type': 'application/json' } });
    }
    if (req.method === 'GET' && url.pathname === '/toolbox/list') {
      console.log('Serving toolbox list');
      const tools = toolboxCollector.getTools();
      console.log('Tools:', tools);
      return new Response(JSON.stringify({ tools }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/widgets/')) {
      try {
        const filePath = `./frontend${url.pathname}`;
        const content = await readFile(filePath);
        return new Response(content, { headers: { 'Content-Type': 'application/javascript' } });
      } catch {
        return new Response('File not found', { status: 404 });
      }
    }
    if (req.method === 'POST' && url.pathname === '/generate') {
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
    return new Response('Not found', { status: 404 });
  }
});