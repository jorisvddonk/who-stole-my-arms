import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import './popup-dialog.js';
import { sessionManager } from './session-manager.js';

const dialog = document.createElement('popup-dialog');
document.body.appendChild(dialog);

export class InteractionHistoryWidget extends LitElement {
  static styles = css`
    .content {
      white-space: normal;
      color: var(--text-color);
      font-family: monospace;
      font-size: 12px;
      height: 90vh;
      overflow: hidden;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .section {
      margin-bottom: 20px;
    }
    .section h3 {
      margin: 0 0 10px 0;
      color: var(--text-color);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 5px;
    }
    .tree {
      margin-left: 20px;
    }
    .tree-item {
      margin: 2px 0;
      padding: 2px 4px;
      background: var(--dialog-bg-shift-1);
      border-radius: 3px;
    }
    .tree-item:hover {
      background: var(--dialog-bg-shift-2);
    }

    .task-list {
      list-style: none;
      padding: 0;
    }
    .task-item {
      margin: 5px 0;
      padding: 5px;
      background: var(--dialog-bg-shift-1);
      border-radius: 3px;
      cursor: pointer;
    }
    .task-item.expanded {
      background: var(--dialog-bg-shift-2);
    }
    .task-item:hover, .task-item.highlighted {
      background: var(--dialog-bg-shift-2);
    }
    .task-item.expanded:hover {
      background: var(--dialog-bg-shift-3);
    }
    .column {
      height: 100%;
      overflow-y: auto;
    }
    .column::-webkit-scrollbar {
      width: 8px;
    }
    .column::-webkit-scrollbar-track {
      background: var(--dialog-bg);
    }
    .column::-webkit-scrollbar-thumb {
      background: var(--accent-bg);
      border-radius: 4px;
    }
    .column::-webkit-scrollbar-thumb:hover {
      background: var(--darker-accent);
    }
    .task-details {
      margin-top: 10px;
      padding: 10px;
      background: var(--dialog-bg-shift-3);
      border-radius: 3px;
    }
    .task-item:hover .task-details {
      background: var(--dialog-bg-shift-4);
    }
    .queue-item {
      margin: 2px 0;
    }
    .error-count {
      color: var(--error-color, #f44336);
      font-weight: bold;
    }
    .refresh-btn, .clear-btn {
      margin-bottom: 10px;
      margin-right: 10px;
      padding: 5px 10px;
      background: var(--primary-color, #007bff);
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      grid-column: 1;
    }
    .refresh-btn:hover, .clear-btn:hover {
      background: var(--primary-hover, #0056b3);
    }
    .clear-btn {
      background: var(--error-color, #f44336);
    }
    .clear-btn:hover {
      background: var(--darker-error-color, #d32f2f);
    }
    .loading {
      text-align: center;
      padding: 20px;
    }
    .error {
      color: var(--error-color, #f44336);
    }
  `;

  static properties = {
    data: { type: Object },
    loading: { type: Boolean },
    error: { type: String },
    hoveredTaskId: { type: String },
    expandedTaskId: { type: String }
  };

  constructor() {
    super();
    this.data = null;
    this.loading = false;
    this.error = '';
    this.hoveredTaskId = '';
    this.expandedTaskId = '';
    this.fetchHistory();
  }

  getAgentColor(agentName) {
    // Simple hash-based color assignment
    const colors = ['#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#FF5722', '#795548', '#607D8B'];
    let hash = 0;
    for (let i = 0; i < agentName.length; i++) {
      hash = agentName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  getChunkTypeColor(type) {
    switch (type) {
      case 'input': return '#4CAF50'; // green
      case 'llmOutput': return '#2196F3'; // blue
      case 'toolOutput': return '#FF9800'; // orange
      case 'agentOutput': return '#00BCD4'; // cyan
      case 'error': return '#F44336'; // red
      default: console.log('Unknown chunk type:', type); return '#9E9E9E'; // gray
    }
  }

  async fetchHistory() {
    this.loading = true;
    this.error = '';
    try {
      const sessionId = sessionManager.getCurrentSession();
      const res = await fetch(`/sessions/${sessionId}/interaction-history`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      this.data = await res.json();
    } catch (error) {
      this.error = error.message;
      this.data = null;
    } finally {
      this.loading = false;
    }
  }

  async clearHistory() {
    try {
      const sessionId = sessionManager.getCurrentSession();
      const res = await fetch(`/sessions/${sessionId}/interaction-history/clear`, { method: 'POST' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      await this.fetchHistory(); // Refresh after clearing
    } catch (error) {
      this.error = error.message;
    }
  }

  renderTree(tree, depth = 0) {
    return html`
      <ul class="tree">
        ${tree.map(item => html`
          <li class="tree-item" @mouseenter=${() => this.hoveredTaskId = item.id} @mouseleave=${() => this.hoveredTaskId = ''} @click=${(e) => { if (!window.getSelection().toString()) this.toggleExpanded(item.id); }}>
            <span class="${item.type}">${item.type === 'agent' ? 'Agent' : 'Tool'}: <span style="color: ${item.type === 'agent' ? this.getAgentColor(item.name) : '#FF9800'}">${item.name}</span>${item.taskType ? ` [${item.taskType}]` : ''}</span>
            ${item.params ? html` <span>(params: ${JSON.stringify(item.params).slice(0, 50)}${JSON.stringify(item.params).length > 50 ? '...' : ''})</span>` : ''}
            <span>(id: ${item.id})</span>
            ${item.children && item.children.length > 0 ? this.renderTree(item.children, depth + 1) : ''}
          </li>
        `)}
      </ul>
    `;
  }

  renderTaskList(tasks) {
    return html`
      <ul class="task-list">
        ${Object.values(tasks).map(task => html`
          <li class="task-item ${this.hoveredTaskId === task.id ? 'highlighted' : ''} ${this.expandedTaskId === task.id ? 'expanded' : ''}" @click=${(e) => { if (!window.getSelection().toString()) this.toggleExpanded(task.id); }}>
            <strong>${task.id}</strong> - Agent: <span style="color: ${this.getAgentColor(task.agent_name)}">${task.agent_name}</span>${task.taskType ? ` [${task.taskType}]` : ''}, Parent: ${task.parent_task_id || 'none'}, Retries: ${task.retryCount}
            <br>Input: ${JSON.stringify(task.input).slice(0, 100)}${JSON.stringify(task.input).length > 100 ? '...' : ''}
            <br>Scratchpad: ${task.scratchpad.length} chunks
            ${this.expandedTaskId === task.id ? this.renderTaskDetails(task) : ''}
          </li>
        `)}
      </ul>
    `;
  }

  toggleExpanded(taskId) {
    this.expandedTaskId = this.expandedTaskId === taskId ? '' : taskId;
  }

  renderTaskDetails(task) {
    return html`
      <div class="task-details">
        <h4>Full Details</h4>
        <p><strong>Input:</strong> ${JSON.stringify(task.input, null, 2)}</p>
        <p><strong>Scratchpad:</strong></p>
        <ul>
          ${task.scratchpad.map((chunk, index) => html`
            <li>
              <strong>${index}:</strong> <span style="color: ${this.getChunkTypeColor(chunk.type)}">${chunk.type}</span> (${chunk.processed ? '✓' : '✗'}) - ${chunk.content}
              ${chunk.annotations ? html`<br><strong>Annotations:</strong> <pre>${JSON.stringify(chunk.annotations, null, 2)}</pre>` : ''}
            </li>
          `)}
        </ul>
      </div>
    `;
  }

  render() {
    if (this.loading) return html`<div class="loading">Loading interaction history...</div>`;
    if (this.error) return html`<div class="error">Error: ${this.error}</div>`;
    if (!this.data) return html`<div>No data available</div>`;

    return html`
      <div class="content">
        <div class="column">
          <button class="refresh-btn" @click=${this.fetchHistory}>Refresh</button>
          <button class="clear-btn" @click=${this.clearHistory}>Clear</button>
          <h3>Invocation Tree</h3>
          ${this.data.invocationTree && this.data.invocationTree.length > 0
            ? this.renderTree(this.data.invocationTree)
            : html`<em>No invocations</em>`
          }
        </div>

        <div class="column">
          <h3>Task List (${Object.keys(this.data.taskStore).length})</h3>
          ${Object.keys(this.data.taskStore).length > 0
            ? this.renderTaskList(this.data.taskStore)
            : html`<em>No tasks</em>`
          }

          <h3>Task Queue (${this.data.taskQueue.length})</h3>
          ${this.data.taskQueue.length > 0
            ? html`
              <ul>
                ${this.data.taskQueue.map(item => html`
                  <li class="queue-item">${item.id} (${item.agent})</li>
                `)}
              </ul>
            `
            : html`<em>Queue empty</em>`
          }

          <h3>Errors: <span class="error-count">${this.data.errorCount}</span></h3>
        </div>
      </div>
    `;
  }
}

customElements.define('interaction-history-widget', InteractionHistoryWidget);

export function register(toolboxMenu) {
  toolboxMenu.addItem('Interaction History', [], () => {
    dialog.minWidth = '90vw';
    dialog.minHeight = '90vh';
    dialog.contentTemplate = () => html`<interaction-history-widget></interaction-history-widget>`;
    dialog.open = true;
  });
}