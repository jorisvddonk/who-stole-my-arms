console.log('Chat app module loaded');

import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { unsafeHTML } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
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
    .message-container:hover .delete-button,
    .message-container:hover .continue-button {
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
      background: var(--hover-bg);
    }
    .continue-button {
      position: absolute;
      top: 5px;
      right: 30px;
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
    .continue-button:hover {
      background: var(--hover-bg);
    }
    .message.system {
      background: var(--system-msg-bg);
      color: var(--text-color);
      border: 1px solid var(--border-color);
    }
    .message.tool-call {
      background: var(--user-msg-bg);
      color: var(--text-color);
      border: 2px solid #4CAF50;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    .message.tool-result {
      background: var(--system-msg-bg);
      color: var(--text-color);
      border: 2px solid #2196F3;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
     .generating-indicator {
       font-size: 0.8em;
       color: var(--text-color);
       opacity: 0.7;
       margin-top: 4px;
       margin-left: 10px;
       font-style: italic;
     }
      .tool-item {
        border: 1px solid var(--border-color);
        padding: 4px;
        margin: 2px 0;
        background: var(--primary-bg);
        border-radius: 4px;
      }
      .reasoning-item {
        border: 1px solid #2196F3;
        padding: 4px;
        margin: 2px 0;
        background: var(--primary-bg);
        border-radius: 4px;
        font-style: italic;
        color: #2196F3;
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
    this.currentToolCall = null;
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

  async deleteMessage(event, messageId) {
    try {
      const endpoint = event.shiftKey
        ? `/sessions/${this.currentSession}/chat/messages/${messageId}/delete-after`
        : `/sessions/${this.currentSession}/chat/messages/${messageId}`;
      const res = await fetch(endpoint, {
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
    const userMessageId = crypto.randomUUID();
    this.messages = [...this.messages, { id: userMessageId, role: 'user', content: prompt }];
    this.loading = true;

     // Add a new system message that we'll update with content
     const systemMessageIndex = this.messages.length;
     this.messages = [...this.messages, { role: 'system', content: '' }];
                           this.requestUpdate();
                           // Scroll to bottom
                           if (sessionStorage.getItem('chatAutoScroll') !== 'false') {
                             setTimeout(() => {
                               const container = this.shadowRoot.querySelector('.chat-container');
                               container.scrollTop = container.scrollHeight;
                             }, 0);
                           }

     try {
      const endpoint = this.supportsStreaming ? `/sessions/${this.currentSession}/generateStream` : `/sessions/${this.currentSession}/generate`;
       const res = await fetch(endpoint, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ prompt, userMessageId })
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
        let fullContent = '';

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
                       fullContent += data.token;
                       this.messages[systemMessageIndex].content += data.token;
           this.requestUpdate();
           // Scroll to bottom
           if (sessionStorage.getItem('chatAutoScroll') !== 'false') {
             setTimeout(() => {
               const container = this.shadowRoot.querySelector('.chat-container');
               container.scrollTop = container.scrollHeight;
             }, 0);
           }
                     } else if (data.reasoning) {
                      // Append reasoning to content with marker, concatenating consecutive reasoning
                      if (this.messages[systemMessageIndex].content.endsWith('</reasoning>')) {
                        // Insert before the closing tag to concatenate
                        this.messages[systemMessageIndex].content = this.messages[systemMessageIndex].content.slice(0, -12) + data.reasoning + '</reasoning>';
                      } else {
                        this.messages[systemMessageIndex].content += `<reasoning>${data.reasoning}</reasoning>`;
                      }
                      this.requestUpdate();

                    // Scroll to bottom
                    setTimeout(() => {
                      const container = this.shadowRoot.querySelector('.chat-container');
                       container.scrollTop = container.scrollHeight;
                     }, 0);
                      } else if (data.tool_call) {
                        // Handle tool call message
                        console.log('🎯 Frontend received tool_call:', data.tool_call);
                        // this.messages[systemMessageIndex].content += `<|tool_call|>${JSON.stringify(data.tool_call)}<|tool_call_end|>`;
                        this.requestUpdate();
                        // Scroll to bottom
                        if (sessionStorage.getItem('chatAutoScroll') !== 'false') {
                          setTimeout(() => {
                            const container = this.shadowRoot.querySelector('.chat-container');
                            container.scrollTop = container.scrollHeight;
                          }, 0);
                        }
                       } else if (data.tool_result) {
                         // Handle tool result message
                         console.log('🎯 Frontend received tool_result:', data.tool_result);
                         // this.messages[systemMessageIndex].content += `<|tool_result|>${JSON.stringify(data.tool_result)}<|tool_result_end|>`;
                         this.requestUpdate();
                         // Scroll to bottom
                         if (sessionStorage.getItem('chatAutoScroll') !== 'false') {
                           setTimeout(() => {
                             const container = this.shadowRoot.querySelector('.chat-container');
                             container.scrollTop = container.scrollHeight;
                           }, 0);
                         }
                     } else if (data.finishReason) {
                      console.log('Generation finished:', data.finishReason);
                      break;
                   } else if (data.messageId) {
                     // Set the message id for continuation
                     this.messages[systemMessageIndex].id = data.messageId;
                     this.requestUpdate();
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
         this.loadChatHistory();
         } else {
          // Handle non-streaming response
           const data = await res.json();
           this.messages[systemMessageIndex] = { role: 'system', content: data.text || 'No response', id: data.messageId };
            this.requestUpdate();
           // Scroll to bottom
           if (sessionStorage.getItem('chatAutoScroll') !== 'false') {
             setTimeout(() => {
               const container = this.shadowRoot.querySelector('.chat-container');
               container.scrollTop = container.scrollHeight;
             }, 0);
           }
           this.loadChatHistory();
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

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getDisplayContent(content) {
    const toolCallTag = '<|tool_call|>';
    const toolCallEndTag = '<|tool_call_end|>';
    const toolResultTag = '<|tool_result|>';
    const toolResultEndTag = '<|tool_result_end|>';
    const reasoningTag = '<reasoning>';
    const reasoningEndTag = '</reasoning>';
    let html = '';
    let pos = 0;
    while (pos < content.length) {
      let callStart = content.indexOf(toolCallTag, pos);
      let resultStart = content.indexOf(toolResultTag, pos);
      let reasoningStart = content.indexOf(reasoningTag, pos);
      // Find the earliest tag
      let earliest = Math.min(
        callStart !== -1 ? callStart : Infinity,
        resultStart !== -1 ? resultStart : Infinity,
        reasoningStart !== -1 ? reasoningStart : Infinity
      );
      if (earliest === Infinity) {
        html += this.escapeHtml(content.slice(pos));
        break;
      }
      if (earliest === callStart) {
        // process tool_call
        html += this.escapeHtml(content.slice(pos, callStart));
        let callEnd = content.indexOf(toolCallEndTag, callStart);
        if (callEnd === -1) {
          html += this.escapeHtml(content.slice(callStart));
          break;
        }
        let json = content.slice(callStart + toolCallTag.length, callEnd);
        try {
          const toolCall = JSON.parse(json);
          console.log('Processing tool_call in getDisplayContent:', toolCall.name);
          html += `<div class="tool-item">🔧 Calling tool: ${this.escapeHtml(toolCall.name)}(${this.escapeHtml(JSON.stringify(toolCall.arguments))})</div>`;
        } catch (e) {
          html += this.escapeHtml(content.slice(callStart, callEnd + toolCallEndTag.length));
        }
        pos = callEnd + toolCallEndTag.length;
      } else if (earliest === resultStart) {
        // process tool_result
        html += this.escapeHtml(content.slice(pos, resultStart));
        let resultEnd = content.indexOf(toolResultEndTag, resultStart);
        if (resultEnd === -1) {
          html += this.escapeHtml(content.slice(resultStart));
          break;
        }
        let json = content.slice(resultStart + toolResultTag.length, resultEnd);
        try {
          const toolResult = JSON.parse(json);
          console.log('Processing tool_result in getDisplayContent:', toolResult.name);
          const resultContent = toolResult.error
            ? `❌ ${toolResult.name} error: ${toolResult.error}`
            : `✅ ${toolResult.name} result: ${JSON.stringify(toolResult.result)}`;
          html += `<div class="tool-item">${this.escapeHtml(resultContent)}</div>`;
        } catch (e) {
          html += this.escapeHtml(content.slice(resultStart, resultEnd + toolResultEndTag.length));
        }
        pos = resultEnd + toolResultEndTag.length;
      } else if (earliest === reasoningStart) {
        // process reasoning
        html += this.escapeHtml(content.slice(pos, reasoningStart));
        let reasoningEnd = content.indexOf(reasoningEndTag, reasoningStart);
        if (reasoningEnd === -1) {
          html += this.escapeHtml(content.slice(reasoningStart));
          break;
        }
        let reasoningText = content.slice(reasoningStart + reasoningTag.length, reasoningEnd);
        html += `<div class="reasoning-item">🧠 ${this.escapeHtml(reasoningText)}</div>`;
        pos = reasoningEnd + reasoningEndTag.length;
      }
    }
    return html;
  }

  async handleContinue(messageId) {
    this.loading = true;
    this.requestUpdate();

    try {
      const endpoint = this.supportsStreaming ? `/sessions/${this.currentSession}/continueStream` : `/sessions/${this.currentSession}/continue`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.warn('Failed to continue generation:', errorData.error);
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
                     // Find the message and append the token
                     const msgIndex = this.messages.findIndex(msg => msg.id === messageId);
                     if (msgIndex !== -1) {
                       this.messages[msgIndex].content += data.token;
     this.requestUpdate();
     // Scroll to bottom
     if (sessionStorage.getItem('chatAutoScroll') !== 'false') {
       setTimeout(() => {
         const container = this.shadowRoot.querySelector('.chat-container');
         container.scrollTop = container.scrollHeight;
       }, 0);
     }
                      }
                       } else if (data.tool_call) {
                        // Handle tool call message
                        console.log('🎯 Frontend received tool_call during continue:', data.tool_call);
                        const msgIndex = this.messages.findIndex(msg => msg.id === messageId);
                        if (msgIndex !== -1) {
                          this.messages[msgIndex].content += `<|tool_call|>${JSON.stringify(data.tool_call)}<|tool_call_end|>`;
                        this.requestUpdate();
                        // Scroll to bottom
                        if (sessionStorage.getItem('chatAutoScroll') !== 'false') {
                          setTimeout(() => {
                            const container = this.shadowRoot.querySelector('.chat-container');
                            container.scrollTop = container.scrollHeight;
                           }, 0);
                        }
                        }
                       } else if (data.tool_result) {
                         // Handle tool result message
                         console.log('🎯 Frontend received tool_result during continue:', data.tool_result);
                         const msgIndex = this.messages.findIndex(msg => msg.id === messageId);
                         if (msgIndex !== -1) {
                           this.messages[msgIndex].content += `<|tool_result|>${JSON.stringify(data.tool_result)}<|tool_result_end|>`;
                           this.requestUpdate();
                           // Scroll to bottom
                           if (sessionStorage.getItem('chatAutoScroll') !== 'false') {
                             setTimeout(() => {
                               const container = this.shadowRoot.querySelector('.chat-container');
                               container.scrollTop = container.scrollHeight;
                             }, 0);
                           }
                         }
                       } else if (data.finishReason) {
                     // Generation completed
                     console.log('Continue generation finished:', data.finishReason);
                     break;
                   } else if (data.error) {
                     console.warn('Continue generation error:', data.error);
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
        // Find the message and append the text
        const msgIndex = this.messages.findIndex(msg => msg.id === messageId);
        if (msgIndex !== -1) {
          this.messages[msgIndex].content += data.text;
                          this.requestUpdate();
                          // Scroll to bottom
                          if (sessionStorage.getItem('chatAutoScroll') !== 'false') {
                            setTimeout(() => {
                              const container = this.shadowRoot.querySelector('.chat-container');
                              container.scrollTop = container.scrollHeight;
                            }, 0);
                          }
        }
      }
    } catch (error) {
      console.warn('Failed to continue generation:', error);
    } finally {
      this.loading = false;
      this.requestUpdate();
    }
  }

  render() {
    return html`
      <top-bar></top-bar>
      <div class="chat-container">
        ${this.messages.map((msg, index) => {
          const isLastSystemMessage = msg.role === 'system' && index === this.messages.length - 1;
          const showContinueButton = msg.role === 'system' && index === this.messages.length - 1 && !this.loading;
          const isDeletable = msg.role === 'system' || msg.role === 'user';
          return html`
            <div class="message-container">
               <div class="message ${msg.role}">${unsafeHTML(this.stripLeadingNewlines(this.getDisplayContent(msg.content)))}${isDeletable && msg.id ? html`<button class="delete-button" @click=${(e) => this.deleteMessage(e, msg.id)}>×</button>` : ''}${showContinueButton ? html`<button class="continue-button" @click=${() => this.handleContinue(msg.id)}>▶</button>` : ''}</div>
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