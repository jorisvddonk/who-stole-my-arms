import { ToolboxTool } from "../../interfaces/ToolboxTool.js";
import { promises as fs } from 'fs';
import { join } from 'path';

export class VoiceDisplayTool implements ToolboxTool {
  constructor(_toolboxCollector: any) {
    // No frontend widget needed, as it's integrated into chat
  }

  getRoutes(): Record<string, any> {
    return {
      "/voices/*": async (req: any) => {
        const url = new URL(req.url);
        const path = decodeURIComponent(url.pathname.slice('/voices/'.length));

        // Security: ensure path doesn't contain .. or start with /
        if (path.includes('..') || path.startsWith('/')) {
          return new Response('Invalid path', { status: 400 });
        }

        // Construct full path to generated/voices directory
        const fullPath = join(process.cwd(), 'generated', 'voices', path);

        try {
          const data = await fs.readFile(fullPath);
          // Return WAV file
          return new Response(data, {
            headers: {
              'Content-Type': 'audio/wav',
              'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
            }
          });
        } catch (error) {
          return new Response('Voice file not found', { status: 404 });
        }
      }
    };
  }
}