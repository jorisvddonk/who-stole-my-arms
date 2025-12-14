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
      min-height: 90vh;
      overflow-y: auto;
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
      margin: 5px 0;
    }
    .agent {
      color: var(--success-color, #4CAF50);
    }
    .tool {
      color: var(--warning-color, #FF9800);
    }
    .task-list {
      list-style: none;
      padding: 0;
    }
    .task-item {
      margin: 5px 0;
      padding: 5px;
      background: var(--bg-secondary, #333);
      border-radius: 3px;
      cursor: pointer;
    }
    .task-item:hover, .task-item.highlighted {
      background: var(--highlight-bg, #555);
    }
    .task-details {
      margin-top: 10px;
      padding: 10px;
      background: var(--details-bg, #222);
      border-radius: 3px;
    }
    .queue-item {
      margin: 2px 0;
    }
    .error-count {
      color: var(--error-color, #f44336);
      font-weight: bold;
    }
    .refresh-btn {
      margin-bottom: 10px;
      padding: 5px 10px;
      background: var(--primary-color, #007bff);
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      grid-column: 1;
    }
    .refresh-btn:hover {
      background: var(--primary-hover, #0056b3);
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

  renderTree(tree, depth = 0) {
    return html`
      <ul class="tree">
        ${tree.map(item => html`
          <li class="tree-item" @mouseenter=${() => this.hoveredTaskId = item.id} @mouseleave=${() => this.hoveredTaskId = ''} @click=${() => this.toggleExpanded(item.id)}>
            <span class="${item.type}">${item.type === 'agent' ? 'Agent' : 'Tool'}: ${item.name}</span>
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
          <li class="task-item ${this.hoveredTaskId === task.id ? 'highlighted' : ''}" @click=${() => this.toggleExpanded(task.id)}>
            <strong>${task.id}</strong> - Agent: ${task.agent_name}, Parent: ${task.parent_task_id || 'none'}, Retries: ${task.retryCount}
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
              <strong>${index}:</strong> ${chunk.type} (${chunk.processed ? '✓' : '✗'}) - ${chunk.content}
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
        <div>
          <button class="refresh-btn" @click=${this.fetchHistory}>Refresh</button>
          <h3>Invocation Tree</h3>
          ${this.data.invocationTree && this.data.invocationTree.length > 0
            ? this.renderTree(this.data.invocationTree)
            : html`<em>No invocations</em>`
          }
        </div>

        <div>
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