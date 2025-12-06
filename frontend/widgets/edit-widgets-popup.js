import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class EditWidgetsPopup extends LitElement {
  static styles = css`
    :host {
      font-family: 'Times New Roman', serif;
      color: var(--text-color);
    }
    .widgets-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: 10px;
    }
    .widget-item {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 2px;
      background: var(--secondary-bg);
      border-radius: 4px;
    }
    .popup {
      background: var(--dialog-bg);
      border-radius: 8px;
      padding: 20px;
      max-width: 800px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px var(--shadow-color);
      position: relative;
    }
    .close-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 30px;
      height: 30px;
      background: var(--dark-accent);
      color: var(--light-text);
      border: none;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .close-btn:hover {
      background: var(--darker-accent);
    }
    .widgets-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: 10px;
    }
    .widget-item {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 2px;
      background: var(--secondary-bg);
      border-radius: 4px;
    }
    select {
      width: 120px;
      padding: 2px 4px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--input-bg);
      color: var(--text-color);
      font-family: 'Times New Roman', serif;
      height: 24px;
      font-size: 12px;
      box-sizing: border-box;
    }
    input {
      width: 60px;
      padding: 2px 4px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--input-bg);
      color: var(--text-color);
      font-family: 'Times New Roman', serif;
      height: 24px;
      font-size: 12px;
      box-sizing: border-box;
    }
    button {
      padding: 2px 6px;
      background: var(--dark-accent);
      color: var(--light-text);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: 'Times New Roman', serif;
      height: 24px;
      font-size: 12px;
    }
    button:hover {
      background: var(--darker-accent);
    }
    .total {
      margin: 10px 0;
      font-weight: bold;
      color: var(--text-color);
    }
    select, input {
      padding: 8px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--input-bg);
      color: var(--text-color);
      font-family: 'Times New Roman', serif;
    }
    select:focus, input:focus {
      outline: none;
      border-color: var(--accent-bg);
    }
    button {
      padding: 8px 12px;
      background: var(--dark-accent);
      color: var(--light-text);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: 'Times New Roman', serif;
    }
    button:hover {
      background: var(--darker-accent);
    }
    .total {
      margin: 10px 0;
      font-weight: bold;
      color: var(--text-color);
    }
  `;

  static properties = {
    row: { type: Object },
    open: { type: Boolean }
  };

  constructor() {
    super();
    this.row = null;
    this.open = true;
    this._widgets = [];
    console.log('constructor', this._widgets);
  }

  connectedCallback() {
    super.connectedCallback();
    console.log('connected', this.row, this._widgets);
    if (this.row) {
      this._widgets = [...this.row.widgets];
      console.log('set _widgets', this._widgets);
    }
  }

  updated(changedProperties) {
    console.log('updated', changedProperties, this.row, this._widgets);
    if (changedProperties.has('row') && this.row) {
      this._widgets = [...this.row.widgets];
      console.log('updated _widgets', this._widgets);
      this.requestUpdate();
    }
  }

  get contentTemplate() {
    return () => this.renderContent();
  }

  renderContent() {
    const total = this._widgets.reduce((sum, w) => sum + w.span, 0);
    return html`
      <div>
        <div class="widgets-list">
          ${this._widgets.map((widget, index) => html`
            <div class="widget-item">
              <select .value=${widget.type} @change=${(e) => this.updateType(index, e.target.value)}>
                <option value="empty-widget">Empty</option>
                <option value="dummy-widget">Dummy</option>
              </select>
              <input type="number" min="1" max="12" .value=${widget.span} @input=${(e) => this.updateSpan(index, e.target.value)}>
              <button @click=${() => this.removeWidget(index)}>Remove</button>
            </div>
          `)}
        </div>
        <button @click=${this.addWidget}>Add Widget</button>
        <div class="total">Total Span: ${total} / 12</div>
        <button @click=${this.save}>Save</button>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }

  addWidget = () => {
    console.log('addWidget this', this, this._widgets);
    this._widgets = [...this._widgets, { type: 'empty-widget', span: 1 }];
    console.log('addWidget after', this._widgets);
    this.requestUpdate();
  }

  removeWidget = (index) => {
    console.log('removeWidget', index, this._widgets);
    this._widgets = this._widgets.filter((_, i) => i !== index);
    console.log('removeWidget after', this._widgets);
    this.requestUpdate();
  }

  updateType = (index, type) => {
    console.log('updateType', index, type, this._widgets);
    this._widgets = this._widgets.map((w, i) => i === index ? { ...w, type } : w);
    console.log('updateType after', this._widgets);
    this.requestUpdate();
  }

  updateSpan = (index, span) => {
    console.log('updateSpan', index, span, this._widgets);
    this._widgets = this._widgets.map((w, i) => i === index ? { ...w, span: parseInt(span) || 1 } : w);
    console.log('updateSpan after', this._widgets);
    this.requestUpdate();
  }

  save = () => {
    console.log('save', this._widgets);
    const total = this._widgets.reduce((sum, w) => sum + w.span, 0);
    console.log('total', total);
    if (total > 12) {
      alert('Total span exceeds 12 columns.');
      return;
    }
    this.dispatchEvent(new CustomEvent('save', { detail: { widgets: this._widgets } }));
    this.open = false;
    setTimeout(() => this.remove(), 300); // Delay to allow close animation
  }

  render() {
    if (!this.row) return html``;
    return html`
      <popup-dialog .open=${this.open} .maxWidth=${'800px'} .maxHeight=${'90vh'} .title=${`Edit Widgets for Row ${this.row.id}`} .contentTemplate=${this.contentTemplate} style="--select-width: 120px; --input-width: 60px;"></popup-dialog>
    `;
  }
}

customElements.define('edit-widgets-popup', EditWidgetsPopup);