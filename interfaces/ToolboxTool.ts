/**
 * Interface for toolbox tools that provide API endpoints.
 * Tools appear in the frontend toolbox menu and can be opened as popup dialogs.
 */
export interface ToolboxTool {
  /** Returns API routes for this tool */
  getRoutes(): Record<string, any>;
}