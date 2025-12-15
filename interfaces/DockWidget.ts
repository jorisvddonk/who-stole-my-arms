/**
 * Interface for dock widgets that provide API endpoints.
 * Widgets appear in the dock's grid layout for persistent display.
 */
export interface DockWidget {
  /** Returns API routes for this widget */
  getRoutes(): Record<string, any>;
}