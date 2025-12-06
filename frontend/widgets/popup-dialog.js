import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class PopupDialog extends LitElement {
  static styles = css`
    dialog {
      border: none;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 20px var(--shadow-color);
      overflow-y: auto;
      background: var(--dialog-bg);
      color: var(--text-color);
      font-family: 'Times New Roman', serif;
    }
    dialog::backdrop {
      background: var(--backdrop-color);
    }
    .dialog-title {
      margin: 0 0 10px 0;
      color: var(--text-color);
      font-family: 'Times New Roman', serif;
    }
    .content {
      white-space: pre-wrap;
    }
    .content select {
      width: 120px;
    }
    .content input {
      width: 60px;
    }
    .content select {
      width: var(--select-width, auto);
    }
    .content input {
      width: var(--input-width, auto);
    }
    .content select, .content input {
      padding: 8px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--input-bg);
      color: var(--text-color);
      font-family: 'Times New Roman', serif;
    }
    .content select:focus, .content input:focus {
      outline: none;
      border-color: var(--accent-bg);
    }
    .content button {
      padding: 8px 12px;
      background: var(--dark-accent);
      color: var(--light-text);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: 'Times New Roman', serif;
    }
    .content button:hover {
      background: var(--darker-accent);
    }
    .content select:focus, .content input:focus {
      outline: none;
      border-color: var(--accent-bg);
    }
    .content button {
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
    .content button:hover {
      background: var(--darker-accent);
    }
    dialog::-webkit-scrollbar {
      width: 8px;
    }
    dialog::-webkit-scrollbar-track {
      background: var(--primary-bg);
    }
    dialog::-webkit-scrollbar-thumb {
      background: var(--accent-bg);
      border-radius: 4px;
    }
    dialog::-webkit-scrollbar-thumb:hover {
      background: var(--darker-accent);
    }
    .content .widgets-list {
      margin-bottom: 10px;
    }
    .content .widgets-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .content .widget-item {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 2px;
      background: var(--secondary-bg);
      border-radius: 4px;
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
  `;

  static properties = {
    open: { type: Boolean },
    content: { type: String },
    contentTemplate: { type: Function },
    maxWidth: { type: String },
    maxHeight: { type: String },
    title: { type: String }
  };

  constructor() {
    super();
    this.open = false;
    this.content = '';
    this.maxWidth = '500px';
    this.maxHeight = '80vh';
    this.title = '';
  }

  render() {
    return html`
      <dialog style="max-width: ${this.maxWidth}; max-height: ${this.maxHeight};">
        <button class="close-btn" @click=${() => this.open = false}>×</button>
        ${this.title ? html`<h3 class="dialog-title">${this.title}</h3>` : ''}
        <div class="content">${this.contentTemplate ? this.contentTemplate() : this.content}</div>
      </dialog>
    `;
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    const dialog = this.shadowRoot.querySelector('dialog');
    if (changedProperties.has('open')) {
      if (this.open) {
        dialog.showModal();
      } else {
        dialog.close();
      }
    }
  }
}

customElements.define('popup-dialog', PopupDialog);