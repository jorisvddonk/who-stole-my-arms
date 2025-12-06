import { ToolboxTool } from "../../interfaces/ToolboxTool.js";
import { getOSMetrics } from "../util/os-metrics.js";

export class OsMetricsTool implements ToolboxTool {
  init(toolboxCollector: any): void {
    toolboxCollector.register('/widgets/os-metrics-widget.js');
  }

  getRoutes(): Record<string, any> {
    return {
      "/metrics": (req) => {
        const metrics = getOSMetrics();
        return new Response(JSON.stringify(metrics), { headers: { 'Content-Type': 'application/json' } });
      }
    };
  }
}