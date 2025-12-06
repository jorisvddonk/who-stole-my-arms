import { DockWidget } from "../../interfaces/DockWidget.js";
import { widgetCollector } from "../widget-collector.js";
import { getOSMetrics } from "../util/os-metrics.js";

export class OsMetricsDockWidget implements DockWidget {
  constructor() {
    widgetCollector.register('/widgets/os-metrics-dock-widget.js');
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