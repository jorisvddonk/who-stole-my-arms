console.log('Chat app module loaded');

import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class ChatApp extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      font-family: 'Times New Roman', serif;
      background: var(--primary-bg);
      color: var(--text-color);
    }
    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      background: var(--primary-bg);
    }
    .resizer {
      height: 4px;
      background: var(--border-color);
      cursor: ns-resize;
      flex-shrink: 0;
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

  `;

  static properties = {
    messages: { type: Array },
    loading: { type: Boolean },
    dockHeight: { type: Number }
  };

  constructor() {
    super();
    this.messages = [];
    this.loading = false;
    this.dockHeight = 0;
    this.isResizing = false;
    this.startY = 0;
  }

  async handleGenerate(e) {
    const { prompt } = e.detail;
    this.messages = [...this.messages, { role: 'user', content: prompt }];
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

  startResize(e) {
    this.isResizing = true;
    this.startY = e.clientY;
    this.initialHeight = this.dockHeight || this.shadowRoot.querySelector('dock-widget').offsetHeight;
    document.addEventListener('mousemove', this.handleResize);
    document.addEventListener('mouseup', this.stopResize);
  }

  handleResize = (e) => {
    if (!this.isResizing) return;
    const deltaY = this.startY - e.clientY;
    this.dockHeight = Math.max(80, this.initialHeight + deltaY);
    this.requestUpdate();
  }

  stopResize = () => {
    this.isResizing = false;
    document.removeEventListener('mousemove', this.handleResize);
    document.removeEventListener('mouseup', this.stopResize);
  }

  render() {
    return html`
      <div class="chat-container">
        ${this.messages.map(msg => html`
          <div class="message ${msg.role}">${msg.content}</div>
        `)}
        ${this.loading ? html`<div class="message system">Generating...</div>` : ''}
      </div>
      <div class="resizer" @mousedown=${this.startResize}></div>
      <dock-widget .loading=${this.loading} @generate=${this.handleGenerate} style=${this.dockHeight ? `height: ${this.dockHeight}px;` : ''}></dock-widget>
    `;
  }
}

customElements.define('chat-app', ChatApp);