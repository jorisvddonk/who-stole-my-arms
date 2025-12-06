import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import './popup-dialog.js';

const dialog = document.createElement('popup-dialog');
document.body.appendChild(dialog);

export class OsMetricsWidget extends LitElement {
  static styles = css`
    .content {
      white-space: pre-wrap;
      color: var(--text-color);
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
    if (!this.data) return html`Loading...`;
    if (this.data.error) return html`Error: ${this.data.error}`;
    return html`
      <div class="content">
        Platform: ${this.data.platform}<br>
        Architecture: ${this.data.arch}<br>
        Uptime: ${Math.floor(this.data.uptime / 3600)}h ${Math.floor((this.data.uptime % 3600) / 60)}m ${this.data.uptime % 60}s<br>
        Load Average: ${this.data.loadAverage.map(l => l.toFixed(2)).join(', ')}<br>
        Total Memory: ${(this.data.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB<br>
        Free Memory: ${(this.data.freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB<br>
        CPU Cores: ${this.data.cpuCount}
      </div>
    `;
  }
}

customElements.define('os-metrics-widget', OsMetricsWidget);

export function register(toolboxMenu) {
  toolboxMenu.addItem('OS Metrics', [], () => {
    dialog.contentTemplate = () => html`<os-metrics-widget></os-metrics-widget>`;
    dialog.open = true;
  });
}