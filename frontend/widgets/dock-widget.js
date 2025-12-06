import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import './toolbox-menu.js';
import './empty-widget.js';
import './dummy-widget.js';

export class DockWidget extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      background: var(--secondary-bg);
      border-top: 1px solid var(--border-color);
    }
    .chat-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px;
      flex-shrink: 0;
    }
    .rows-container {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--grid-gap);
    }
    .row {
      position: relative;
      flex-shrink: 0;
    }
    .hamburger {
      position: absolute;
      right: 10px;
      top: 10px;
      cursor: pointer;
      background: var(--menu-bg);
      border: 1px solid var(--border-color);
      padding: 5px;
      border-radius: 4px;
      z-index: 10;
    }
    .grid {
      height: 100%;
      padding: 10px;
      display: grid;
      gap: var(--grid-gap);
    }
    .rows-container::-webkit-scrollbar {
      width: 8px;
    }
    .rows-container::-webkit-scrollbar-track {
      background: var(--primary-bg);
    }
    .rows-container::-webkit-scrollbar-thumb {
      background: var(--accent-bg);
      border-radius: 4px;
    }
    .rows-container::-webkit-scrollbar-thumb:hover {
      background: var(--darker-accent);
    }
    input {
      flex: 1;
      padding: 10px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      margin-right: 10px;
      background: var(--input-bg);
      color: var(--text-color);
    }
    button {
      padding: 10px 20px;
      background-color: var(--dark-accent);
      color: var(--light-text);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover {
      background-color: var(--darker-accent);
    }
    button:disabled {
      background-color: var(--disabled-bg);
      cursor: not-allowed;
    }
  `;

  static properties = {
    loading: { type: Boolean },
    rows: { type: Array },
    visibleHamburgers: { type: Set }
  };

  constructor() {
    super();
    this.loading = false;
    this.rows = [
      { id: 1, columns: 12, widgets: [{ type: 'empty-widget', span: 12 }] },
      { id: 2, columns: 6, widgets: [{ type: 'dummy-widget', span: 3 }, { type: 'empty-widget', span: 3 }] },
      { id: 3, columns: 4, widgets: [{ type: 'dummy-widget', span: 2 }, { type: 'dummy-widget', span: 2 }] }
    ];
    this.visibleHamburgers = new Set();
  }

  connectedCallback() {
    super.connectedCallback();
    if (window.toolboxMenu) {
      window.toolboxMenu.addItem('Add Row', [], () => this.addRow());
    }
  }

  addRow() {
    const id = Math.max(0, ...this.rows.map(r => r.id)) + 1;
    this.rows = [...this.rows, { id, columns: 12, widgets: [{ type: 'empty-widget', span: 12 }] }];
    this.requestUpdate();
  }

  showHamburger(id) {
    this.visibleHamburgers.add(id);
    this.requestUpdate();
  }

  hideHamburger(id) {
    this.visibleHamburgers.delete(id);
    this.requestUpdate();
  }

  openContextMenu(id) {
    const action = prompt('Action: remove, set-columns, add-widget');
    if (action === 'remove') {
      this.rows = this.rows.filter(r => r.id !== id);
    } else if (action === 'set-columns') {
      const cols = parseInt(prompt('Number of columns (1-12):'));
      if (cols >= 1 && cols <= 12) {
        const row = this.rows.find(r => r.id === id);
        row.columns = cols;
        // Reset widgets if needed
        row.widgets = [{ type: 'empty-widget', span: cols }];
      }
    } else if (action === 'add-widget') {
      const type = prompt('Widget type: empty-widget, dummy-widget');
      const span = parseInt(prompt('Span (1-12):'));
      if (type && span >= 1 && span <= 12) {
        const row = this.rows.find(r => r.id === id);
        row.widgets.push({ type, span });
        // Adjust if total span > columns, but for simplicity, allow
      }
    }
    this.requestUpdate();
  }

  handleSubmit() {
    const input = this.shadowRoot.querySelector('#prompt');
    const prompt = input.value.trim();
    if (prompt) {
      this.dispatchEvent(new CustomEvent('generate', { detail: { prompt } }));
      input.value = '';
    }
  }

  renderWidget(type) {
    switch (type) {
      case 'empty-widget':
        return html`<empty-widget></empty-widget>`;
      case 'dummy-widget':
        return html`<dummy-widget></dummy-widget>`;
      default:
        return html``;
    }
  }

  handleKeyDown(e) {
    if (e.key === 'Enter') {
      this.handleSubmit();
    }
  }

  render() {
    return html`
      <div class="chat-bar">
        <toolbox-menu .floating=${false}></toolbox-menu>
        <input id="prompt" type="text" placeholder="Type your message..." @keydown=${this.handleKeyDown} ?disabled=${this.loading}>
        <button @click=${this.handleSubmit} ?disabled=${this.loading}>
          Send
        </button>
      </div>
      <div class="rows-container">
        ${this.rows.map(row => html`
          <div class="row" @mouseenter=${() => this.showHamburger(row.id)} @mouseleave=${() => this.hideHamburger(row.id)}>
            <div class="hamburger" ?hidden=${!this.visibleHamburgers.has(row.id)} @click=${() => this.openContextMenu(row.id)}>☰</div>
            <div class="grid" style="display: grid; grid-template-columns: repeat(${row.columns}, 1fr);">
              ${row.widgets.map(widget => html`<div style="grid-column: span ${widget.span};">${this.renderWidget(widget.type)}</div>`)}
            </div>
          </div>
        `)}
      </div>
    `;
  }
}

customElements.define('dock-widget', DockWidget);