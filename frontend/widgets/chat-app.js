console.log('Chat app module loaded');

import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class ChatApp extends LitElement {
  static styles = css`
    :host {
      display: grid;
      grid-template-rows: 1fr auto;
      height: 100vh;
      font-family: 'Times New Roman', serif;
      background: var(--primary-bg);
      color: var(--text-color);
    }
    .chat-container {
      grid-row: 1;
      overflow-y: auto;
      padding: 20px;
      background: var(--primary-bg);
    }
    .message {
      margin-bottom: 10px;
      padding: 10px;
      border-radius: 10px;
      max-width: 70%;
      font-family: 'Times New Roman', serif;
    }
    .message.user {
      background: var(--user-msg-bg);
      color: var(--light-text);
      align-self: flex-end;
      margin-left: auto;
    }
    .message.system {
      background: var(--system-msg-bg);
      color: var(--text-color);
      border: 1px solid var(--border-color);
    }
    .input-container {
      grid-row: 2;
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      padding: 20px;
      background: var(--secondary-bg);
      border-top: 1px solid var(--border-color);
      gap: 10px;
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
    messages: { type: Array },
    loading: { type: Boolean }
  };

  constructor() {
    super();
    this.messages = [];
    this.loading = false;
  }

  async generate(e) {
    e.preventDefault();
    const input = this.shadowRoot.querySelector('#prompt');
    const prompt = input.value.trim();
    if (!prompt) return;

    this.messages = [...this.messages, { role: 'user', content: prompt }];
    input.value = '';
    this.loading = true;

    try {
      const res = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      if (res.ok) {
        this.messages = [...this.messages, { role: 'system', content: data.text || 'No response' }];
      } else {
        this.messages = [...this.messages, { role: 'system', content: `Error: ${data.error}` }];
      }
    } catch (error) {
      this.messages = [...this.messages, { role: 'system', content: `Error: ${error.message}` }];
    } finally {
      this.loading = false;
    }
    this.requestUpdate();
    // Scroll to bottom
    setTimeout(() => {
      const container = this.shadowRoot.querySelector('.chat-container');
      container.scrollTop = container.scrollHeight;
    }, 0);
  }

  render() {
    return html`
      <div class="chat-container">
        ${this.messages.map(msg => html`
          <div class="message ${msg.role}">${msg.content}</div>
        `)}
        ${this.loading ? html`<div class="message system">Generating...</div>` : ''}
      </div>
      <form class="input-container" @submit=${this.generate}>
        <toolbox-menu .floating=${false}></toolbox-menu>
        <input id="prompt" type="text" placeholder="Type your message..." required ?disabled=${this.loading}>
        <button type="submit" ?disabled=${this.loading}>
          Send
        </button>
      </form>
    `;
  }
}

customElements.define('chat-app', ChatApp);