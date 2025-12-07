import { ToolboxTool } from '../../interfaces/ToolboxTool.js';
import { toolboxCollector } from '../toolbox-collector.js';

export class AutoScrollSettingsTool implements ToolboxTool {
  constructor() {
    // Register the frontend widget URL with toolboxCollector
    toolboxCollector.register('/widgets/auto-scroll-settings-widget.js');
  }

  getRoutes() {
    return {};
  }
}