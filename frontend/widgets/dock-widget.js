import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import './toolbox-menu.js';

export class DockWidget extends LitElement {
  static styles = css`
    :host {
      display: grid;
      grid-template: auto 1fr / repeat(12, 1fr);
      background: var(--secondary-bg);
      border-top: 1px solid var(--border-color);
    }
    .chat-bar {
      grid-row: 1;
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px;
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
    loading: { type: Boolean }
  };

  constructor() {
    super();
    this.loading = false;
  }

  handleSubmit() {
    const input = this.shadowRoot.querySelector('#prompt');
    const prompt = input.value.trim();
    if (prompt) {
      this.dispatchEvent(new CustomEvent('generate', { detail: { prompt } }));
      input.value = '';
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
    `;
  }
}

customElements.define('dock-widget', DockWidget);