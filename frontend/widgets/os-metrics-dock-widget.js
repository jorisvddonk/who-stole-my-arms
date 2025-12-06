import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class OsMetricsDockWidget extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: var(--primary-bg);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 10px;
      color: var(--text-color);
      font-family: 'Times New Roman', serif;
      min-height: 100%;
      box-sizing: border-box;
    }
    .metric {
      margin-bottom: 5px;
      font-size: 12px;
    }
    .label {
      font-weight: bold;
    }
    .value {
      margin-left: 5px;
    }
  `;

  static properties = {
    data: { type: Object }
  };

  constructor() {
    super();
    this.data = null;
    this.fetchMetrics();
  }

  async fetchMetrics() {
    try {
      const res = await fetch('/metrics');
      this.data = await res.json();
    } catch (error) {
      this.data = { error: error.message };
    }
  }

    render() {
    if (!this.data) return html`<div style="height: 100%; display: flex; align-items: center; justify-content: center;">Loading...</div>`;
    if (this.data.error) return html`<div style="height: 100%; display: flex; align-items: center; justify-content: center;">Error: ${this.data.error}</div>`;

    return html`
      <div style="height: 100%; display: flex; flex-direction: column; justify-content: space-around;">
        <div class="metric">
          <span class="label">Platform:</span>
          <span class="value">${this.data.platform}</span>
        </div>
        <div class="metric">
          <span class="label">Arch:</span>
          <span class="value">${this.data.arch}</span>
        </div>
        <div class="metric">
          <span class="label">Uptime:</span>
          <span class="value">${Math.floor(this.data.uptime / 3600)}h ${Math.floor((this.data.uptime % 3600) / 60)}m</span>
        </div>
        <div class="metric">
          <span class="label">Load:</span>
          <span class="value">${this.data.loadAverage.map(l => l.toFixed(2)).join(', ')}</span>
        </div>
        <div class="metric">
          <span class="label">Memory:</span>
          <span class="value">${(this.data.freeMemory / 1024 / 1024 / 1024).toFixed(1)}/${(this.data.totalMemory / 1024 / 1024 / 1024).toFixed(1)} GB</span>
        </div>
        <div class="metric">
          <span class="label">CPU Cores:</span>
          <span class="value">${this.data.cpuCount}</span>
        </div>
      </div>
    `;
  }
}

customElements.define('os-metrics-dock-widget', OsMetricsDockWidget);

// Register this widget type with the dock system
export function registerWidgetType(dockWidgetManager) {
  dockWidgetManager.registerWidgetType('os-metrics-dock-widget', 'OS Metrics');
}