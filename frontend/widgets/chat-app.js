console.log('Chat app module loaded');

import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { sessionManager } from './session-manager.js';

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
      white-space: pre-wrap;
      position: relative;
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
    .message-container:hover .delete-button {
      opacity: 1;
    }
    .delete-button {
      position: absolute;
      top: 5px;
      right: 5px;
      background: var(--border-color);
      color: var(--text-color);
      border: none;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
      font-size: 12px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .delete-button:hover {
      background: var(--error-color, #ff4444);
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
    this.currentSession = sessionManager.getCurrentSession();
    this.sessionChangeHandler = this.handleSessionChange.bind(this);
    this.checkLLMSettings();
  }

  connectedCallback() {
    super.connectedCallback();
    sessionManager.addSessionChangeListener(this.sessionChangeHandler);
    this.loadChatHistory();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    sessionManager.removeSessionChangeListener(this.sessionChangeHandler);
  }

  handleSessionChange(sessionId) {
    this.currentSession = sessionId;
    this.messages = [];
    this.loadChatHistory();
  }

  async loadChatHistory() {
    try {
      const res = await fetch(`/sessions/${this.currentSession}/chat/messages`);
      if (res.ok) {
        const data = await res.json();
        this.messages = data.messages.map(msg => ({
          id: msg.id,
          role: msg.actor === 'user' ? 'user' : 'system',
          content: msg.content
        }));
        this.requestUpdate();
      }
    } catch (error) {
      console.warn('Failed to load chat history:', error);
    }
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

  async deleteMessage(messageId) {
    try {
      const res = await fetch(`/sessions/${this.currentSession}/chat/messages/${messageId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        this.loadChatHistory();
      } else {
        console.warn('Failed to delete message');
      }
    } catch (error) {
      console.warn('Failed to delete message:', error);
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
      const endpoint = this.supportsStreaming ? `/sessions/${this.currentSession}/generateStream` : `/sessions/${this.currentSession}/generate`;
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
                  } else if (data.finishReason) {
                    // Generation completed with finish reason
                    console.log('Generation finished:', data.finishReason);
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

  stripLeadingNewlines(content) {
    return content.replace(/^\n+/, '');
  }

  render() {
    return html`
      <top-bar></top-bar>
      <div class="chat-container">
        ${this.messages.map((msg, index) => {
          const isLastSystemMessage = msg.role === 'system' && index === this.messages.length - 1;
          return html`
            <div class="message-container">
              <div class="message ${msg.role}">${this.stripLeadingNewlines(msg.content)}<button class="delete-button" @click=${() => this.deleteMessage(msg.id)}>×</button></div>
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