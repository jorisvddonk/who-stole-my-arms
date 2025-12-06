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
    .message-container {
      margin-bottom: 10px;
    }
    .message.system {
      background: var(--system-msg-bg);
      color: var(--text-color);
      border: 1px solid var(--border-color);
    }
    .generating-indicator {
      font-size: 0.8em;
      color: var(--text-color);
      opacity: 0.7;
      margin-top: 4px;
      margin-left: 10px;
      font-style: italic;
    }

  `;

  static properties = {
    messages: { type: Array },
    loading: { type: Boolean },
    dockHeight: { type: Number },
    supportsStreaming: { type: Boolean }
  };

  constructor() {
    super();
    this.messages = [];
    this.loading = false;
    this.dockHeight = 0;
    this.isResizing = false;
    this.startY = 0;
    this.supportsStreaming = false;
    this.checkLLMSettings();
  }

  async checkLLMSettings() {
    try {
      const res = await fetch('/llm/settings');
      if (res.ok) {
        const settings = await res.json();
        this.supportsStreaming = settings.supportsStreaming;
      }
    } catch (error) {
      console.warn('Failed to check LLM settings:', error);
      this.supportsStreaming = false;
    }
  }

  async handleGenerate(e) {
    const { prompt } = e.detail;
    this.messages = [...this.messages, { role: 'user', content: prompt }];
    this.loading = true;

    // Add a new system message that we'll update with content
    const systemMessageIndex = this.messages.length;
    this.messages = [...this.messages, { role: 'system', content: '' }];
    this.requestUpdate();

    try {
      const endpoint = this.supportsStreaming ? '/generateStream' : '/generate';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!res.ok) {
        const errorData = await res.json();
        this.messages[systemMessageIndex] = { role: 'system', content: `Error: ${errorData.error}` };
        this.requestUpdate();
        return;
      }

      if (this.supportsStreaming) {
        // Handle streaming response
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages
          while (buffer.includes('\n\n')) {
            const messageEnd = buffer.indexOf('\n\n');
            const message = buffer.slice(0, messageEnd);
            buffer = buffer.slice(messageEnd + 2);

            for (const line of message.split('\n')) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.token) {
                    this.messages[systemMessageIndex].content += data.token;
                    this.requestUpdate();
                    // Scroll to bottom
                    setTimeout(() => {
                      const container = this.shadowRoot.querySelector('.chat-container');
                      container.scrollTop = container.scrollHeight;
                    }, 0);
                  } else if (data.done) {
                    // Generation completed
                    break;
                  } else if (data.error) {
                    this.messages[systemMessageIndex] = { role: 'system', content: `Error: ${data.error}` };
                    this.requestUpdate();
                    return;
                  }
                } catch (e) {
                  // Skip malformed JSON
                  continue;
                }
              }
            }
          }
        }
      } else {
        // Handle non-streaming response
        const data = await res.json();
        this.messages[systemMessageIndex] = { role: 'system', content: data.text || 'No response' };
        this.requestUpdate();
        // Scroll to bottom
        setTimeout(() => {
          const container = this.shadowRoot.querySelector('.chat-container');
          container.scrollTop = container.scrollHeight;
        }, 0);
      }
    } catch (error) {
      this.messages[systemMessageIndex] = { role: 'system', content: `Error: ${error.message}` };
      this.requestUpdate();
    } finally {
      this.loading = false;
      this.requestUpdate();
    }
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
        ${this.messages.map((msg, index) => {
          const isLastSystemMessage = msg.role === 'system' && index === this.messages.length - 1;
          return html`
            <div class="message-container">
              <div class="message ${msg.role}">${msg.content}</div>
              ${this.loading && isLastSystemMessage ? html`<div class="generating-indicator">Generating...</div>` : ''}
            </div>
          `;
        })}
      </div>
      <div class="resizer" @mousedown=${this.startResize}></div>
      <dock-widget .loading=${this.loading} @generate=${this.handleGenerate} style=${this.dockHeight ? `height: ${this.dockHeight}px;` : ''}></dock-widget>
    `;
  }
}

customElements.define('chat-app', ChatApp);