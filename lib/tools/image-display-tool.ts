import { ToolboxTool } from "../../interfaces/ToolboxTool.js";
import { promises as fs } from 'fs';

export class ImageDisplayTool implements ToolboxTool {
  constructor(_toolboxCollector: any) {
    // No frontend widget needed, as it's integrated into chat
  }

  getRoutes(): Record<string, any> {
    return {
      "/images/*": async (req: any) => {
        const url = new URL(req.url);
        const path = decodeURIComponent(url.pathname.slice('/images/'.length));
        try {
          const data = await fs.readFile(path);
          // Determine content type based on extension
          const ext = path.split('.').pop()?.toLowerCase();
          let contentType = 'application/octet-stream';
          if (ext === 'png') contentType = 'image/png';
          else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
          else if (ext === 'gif') contentType = 'image/gif';
          return new Response(data, { headers: { 'Content-Type': contentType } });
        } catch (error) {
          return new Response('Image not found', { status: 404 });
        }
      }
    };
  }
}