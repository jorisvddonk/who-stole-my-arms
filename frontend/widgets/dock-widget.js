import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import './toolbox-menu.js';
import './empty-widget.js';
import './dummy-widget.js';
import './row-hamburger-button.js';
import './edit-widgets-popup.js';

export class DockWidget extends LitElement {
  static widgetTypes = new Map([
    ['empty-widget', 'Empty'],
    ['dummy-widget', 'Dummy']
  ]);

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
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      gap: var(--grid-gap);
    }
    .row {
      position: relative;
      flex-shrink: 0;
      padding-left: 10px;
      padding-right: 10px;
    }

    .grid {
      display: grid;
      gap: var(--grid-gap);
      align-items: stretch;
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
      { id: 1, widgets: [{ type: 'empty-widget', span: 12 }] },
      { id: 2, widgets: [{ type: 'dummy-widget', span: 6 }, { type: 'empty-widget', span: 6 }] },
      { id: 3, widgets: [{ type: 'dummy-widget', span: 3 }, { type: 'dummy-widget', span: 3 }, { type: 'dummy-widget', span: 6 }] }
    ];
    this.visibleHamburgers = new Set();
  }

  connectedCallback() {
    super.connectedCallback();
    window.dockWidget = this;
    if (window.toolboxMenu) {
      window.toolboxMenu.addItem('Add Row', [], () => this.addRow());
    }
    this.loadWidgets();
  }

  registerWidgetType(type, label) {
    DockWidget.widgetTypes.set(type, label);
  }

  async loadWidgets() {
    try {
      const res = await fetch('/widgets/list');
      const data = await res.json();
      for (const url of data.widgets) {
        try {
          const mod = await import(url);
          if (mod.registerWidgetType) {
            mod.registerWidgetType(this);
          }
        } catch (error) {
          console.error('Failed to load widget:', url, error);
        }
      }
    } catch (error) {
      console.error('Failed to load widgets:', error);
    }
  }

  addRow() {
    const id = Math.max(0, ...this.rows.map(r => r.id)) + 1;
    this.rows = [...this.rows, { id, widgets: [{ type: 'empty-widget', span: 12 }] }];
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

  handleMenuAction(e) {
    const { action, rowId } = e.detail;
    if (action === 'add-row-above') {
      this.addRowAt(rowId, 'above');
    } else if (action === 'add-row-below') {
      this.addRowAt(rowId, 'below');
    } else if (action === 'remove') {
      this.rows = this.rows.filter(r => r.id !== rowId);
    } else if (action === 'edit-widgets') {
      this.editWidgets(rowId);
    }
    this.requestUpdate();
  }

  addRowAt(rowId, position) {
    const index = this.rows.findIndex(r => r.id === rowId);
    const newId = Math.max(0, ...this.rows.map(r => r.id)) + 1;
    const newRow = { id: newId, widgets: [{ type: 'empty-widget', span: 12 }] };
    if (position === 'above') {
      this.rows.splice(index, 0, newRow);
    } else {
      this.rows.splice(index + 1, 0, newRow);
    }
  }

  editWidgets(rowId) {
    const row = this.rows.find(r => r.id === rowId);
    const editor = document.createElement('edit-widgets-popup');
    editor.row = row;
    editor.addEventListener('save', this.handleSave.bind(this));
    document.body.appendChild(editor);
  }

  handleSave(e) {
    const { widgets } = e.detail;
    // Find the row and update
    const row = this.rows.find(r => r.id === e.target.row.id);
    if (row) {
      row.widgets = widgets;
      this.requestUpdate();
    }
  }

  handleSubmit() {
    const input = this.shadowRoot.querySelector('#prompt');
    const prompt = input.value.trim();
    if (prompt) {
      this.dispatchEvent(new CustomEvent('generate', { detail: { prompt } }));
      input.value = '';
    }
  }

  renderWidget(type, rowId) {
    switch (type) {
      case 'empty-widget':
        return html`<empty-widget .rowId=${rowId} @replace=${this.handleReplace}></empty-widget>`;
      case 'dummy-widget':
        return html`<dummy-widget></dummy-widget>`;
      case 'os-metrics-dock-widget':
        return html`<os-metrics-dock-widget></os-metrics-dock-widget>`;
      default:
        return html`<div>Unknown widget: ${type}</div>`;
    }
  }

  handleReplace(e) {
    this.editWidgets(e.detail.rowId);
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
          <row-hamburger-button .rowId=${row.id} style="display: ${this.visibleHamburgers.has(row.id) ? 'block' : 'none'}" @menu-action=${this.handleMenuAction}></row-hamburger-button>
          <div class="grid" style="display: grid; grid-template-columns: repeat(12, 1fr);">
            ${row.widgets.map(widget => html`<div style="grid-column: span ${widget.span};">${this.renderWidget(widget.type, row.id)}</div>`)}
          </div>
        </div>
        `)}
      </div>
    `;
  }
}

customElements.define('dock-widget', DockWidget);