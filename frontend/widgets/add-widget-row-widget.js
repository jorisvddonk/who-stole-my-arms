import { sessionManager } from './session-manager.js';

export function register(toolboxMenu) {
  toolboxMenu.addItem('Add Widget Row', [], async () => {
    const sessionId = sessionManager.getCurrentSession();
    try {
      // Fetch current config
      const getResponse = await fetch(`/sessions/${sessionId}/dock/config`);
      if (!getResponse.ok) throw new Error('Failed to fetch config');
      const { rows } = await getResponse.json();

      // Add new row
      const id = Math.max(0, ...rows.map(r => r.id)) + 1;
      const newRows = [...rows, { id, widgets: [{ type: 'empty-widget', span: 12 }] }];

      // Save config
      const postResponse = await fetch(`/sessions/${sessionId}/dock/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: newRows })
      });
      if (postResponse.ok) {
        // Notify the dock to update
        if (window.dockWidget) {
          window.dockWidget.loadConfig();
        }
      } else {
        console.error('Failed to save config');
      }
    } catch (error) {
      console.error('Error adding widget row:', error);
    }
  });
}