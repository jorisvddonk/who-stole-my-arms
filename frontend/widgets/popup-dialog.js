import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class PopupDialog extends LitElement {
  static styles = css`
    dialog {
      border: none;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      background: #bcaaa4;
      color: #3e2723;
      font-family: 'Times New Roman', serif;
    }
    dialog::backdrop {
      background: rgba(0,0,0,0.5);
    }
    .content {
      white-space: pre-wrap;
    }
    button {
      margin-top: 10px;
      padding: 8px 16px;
      background: #5d4037;
      color: #f4f1e8;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover {
      background: #3e2723;
    }
  `;

  static properties = {
    open: { type: Boolean },
    content: { type: String },
    contentTemplate: { type: Function }
  };

  constructor() {
    super();
    this.open = false;
    this.content = '';
  }

  render() {
    return html`
      <dialog>
        <div class="content">${this.contentTemplate ? this.contentTemplate() : this.content}</div>
        <button @click=${() => this.open = false}>Close</button>
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