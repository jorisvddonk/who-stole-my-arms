import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import './popup-dialog.js';
import { sessionManager } from './session-manager.js';

const dialog = document.createElement('popup-dialog');
document.body.appendChild(dialog);

export class DefaultAgentWidget extends LitElement {
  static styles = css`
    .content {
      color: var(--text-color);
      padding: 20px;
    }
    select, button {
      margin: 10px 0;
      padding: 8px;
      background: var(--bg-color);
      color: var(--text-color);
      border: 1px solid var(--border-color);
    }
    button {
      cursor: pointer;
    }
    button:hover {
      background: var(--hover-bg-color);
    }
  `;

  static properties = {
    agents: { type: Array },
    currentAgent: { type: String },
    selectedAgent: { type: String }
  };

  constructor() {
    super();
    this.agents = [];
    this.currentAgent = '';
    this.selectedAgent = '';
    this.loadData();
  }

  async loadData() {
    try {
      const sessionId = sessionManager.getCurrentSession();
      const [agentsRes, currentRes] = await Promise.all([
        fetch('/agents/list'),
        fetch(`/sessions/${sessionId}/default-agent`)
      ]);
      this.agents = await agentsRes.json().then(data => data.agents);
      this.currentAgent = await currentRes.json().then(data => data.defaultAgent);
      this.selectedAgent = this.currentAgent;
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }

  async setDefaultAgent() {
    try {
      const sessionId = sessionManager.getCurrentSession();
      const res = await fetch(`/sessions/${sessionId}/default-agent`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName: this.selectedAgent })
      });
      if (res.ok) {
        this.currentAgent = this.selectedAgent;
        alert('Default agent updated successfully');
      } else {
        alert('Failed to update default agent');
      }
    } catch (error) {
      console.error('Failed to set default agent:', error);
      alert('Error updating default agent');
    }
  }

  render() {
    return html`
      <div class="content">
        <h3>Set Default Agent for Session</h3>
        <p>Current default agent: ${this.currentAgent}</p>
        <select .value=${this.selectedAgent} @change=${(e) => this.selectedAgent = e.target.value}>
          ${this.agents.map(agent => html`<option value=${agent}>${agent}</option>`)}
        </select>
        <br>
        <button @click=${this.setDefaultAgent}>Set Default Agent</button>
      </div>
    `;
  }
}

customElements.define('default-agent-widget', DefaultAgentWidget);

export function register(toolboxMenu) {
  toolboxMenu.addItem('Default Agent', [], () => {
    dialog.contentTemplate = () => html`<default-agent-widget></default-agent-widget>`;
    dialog.open = true;
  });
}