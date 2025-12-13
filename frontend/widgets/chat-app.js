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
       color: var(--text-color);
       align-self: flex-end;
       margin-left: auto;
     }
    .message-container {
      margin-bottom: 10px;
    }
     .message-container:hover .delete-button,
     .message-container:hover .continue-button,
     .message-container:hover .edit-button,
     .message-container:hover .regenerate-button {
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
       right: 80px;
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
     .regenerate-button {
       position: absolute;
       top: 5px;
       right: 55px;
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
     .regenerate-button:hover {
       background: var(--hover-bg);
     }
     .edit-button {
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
     .edit-button:hover {
       background: var(--hover-bg);
     }
     .message.editing {
       padding: 0;
     }
     .edit-input {
       width: 100%;
       min-height: 60px;
       padding: 10px;
       border: 1px solid var(--border-color);
       border-radius: 10px;
       background: var(--primary-bg);
       color: var(--text-color);
       font-family: 'Times New Roman', serif;
       font-size: 14px;
       resize: vertical;
     }
     .edit-actions {
       margin-top: 5px;
       display: flex;
       gap: 5px;
       justify-content: flex-end;
     }
     .edit-save, .edit-cancel {
       padding: 5px 10px;
       border: none;
       border-radius: 5px;
       cursor: pointer;
       font-size: 12px;
     }
     .edit-save {
       background: var(--user-msg-bg);
       color: var(--text-color);
     }
     .edit-cancel {
       background: var(--border-color);
       color: var(--text-color);
     }
     .message.system {
       background: var(--system-msg-bg);
       color: var(--text-color);
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
      .agent-item {
        border: 1px solid var(--border-color);
        padding: 4px;
        margin: 2px 0;
        background: var(--secondary-bg);
        border-radius: 4px;
      }
      .agent-item {
        border: 1px solid var(--border-color);
        padding: 4px;
        margin: 2px 0;
        background: var(--secondary-bg);
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
        .error-item {
          border: 1px solid #f44336;
          padding: 4px;
          margin: 2px 0;
          background: #ffebee;
          border-radius: 4px;
          color: #c62828;
        }
       .quote {
         font-style: italic;
         color: var(--quote-color);
       }
       .emphasis {
         font-style: italic;
         color: var(--emphasized-text-color);
       }
       code, .code {
         font-family: 'Courier New', monospace;
         color: var(--emphasized-text-color);
         background: var(--input-bg);
         padding: 2px 4px;
         border-radius: 3px;
       }

  `;

  static properties = {
     messages: { type: Array },
     loading: { type: Boolean },
     dockHeight: { type: Number },
     supportsStreaming: { type: Boolean },
     voiceEventSource: { type: Object },
     voiceQueue: { type: Array },
     isPlayingVoice: { type: Boolean },
     editingMessageId: { type: String },
     editContent: { type: String }
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
     this.voiceEventSource = null;
     this.voiceQueue = [];
     this.isPlayingVoice = false;
     this.editingMessageId = null;
     this.editContent = '';
     this.checkLLMSettings();
  }

  connectedCallback() {
    super.connectedCallback();
    sessionManager.addSessionChangeListener(this.sessionChangeHandler);
    this.loadChatHistory();
    // Connect to voice events
    this.voiceEventSource = new EventSource('/voice/events');
    this.voiceEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.audioDataUrl) {
          this.voiceQueue.push(data.audioDataUrl);
          this.playNextVoice();
        }
      } catch (e) {
        console.warn('Failed to parse voice event:', e);
      }
    };
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    sessionManager.removeSessionChangeListener(this.sessionChangeHandler);
    if (this.voiceEventSource) {
      this.voiceEventSource.close();
      this.voiceEventSource = null;
    }
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

   startEdit(messageId, currentContent) {
     this.editingMessageId = messageId;
     this.editContent = currentContent;
     this.requestUpdate();
   }

   cancelEdit() {
     this.editingMessageId = null;
     this.editContent = '';
     this.requestUpdate();
   }

   async saveEdit() {
     if (!this.editingMessageId) return;

     try {
       const res = await fetch(`/sessions/${this.currentSession}/chat/messages/${this.editingMessageId}`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ content: this.editContent })
       });
       if (res.ok) {
         this.editingMessageId = null;
         this.editContent = '';
         this.loadChatHistory();
       } else {
         console.warn('Failed to edit message');
       }
     } catch (error) {
       console.warn('Failed to edit message:', error);
     }
   }

   async regenerateMessage(systemMessageId) {
     // Find the system message and its index
     const systemMessageIndex = this.messages.findIndex(msg => msg.id === systemMessageId);
     if (systemMessageIndex === -1 || this.messages[systemMessageIndex].role !== 'system') {
       console.warn('System message not found');
       return;
     }

     // Find the preceding user message
     let userMessage = null;
     for (let i = systemMessageIndex - 1; i >= 0; i--) {
       if (this.messages[i].role === 'user') {
         userMessage = this.messages[i];
         break;
       }
     }

     if (!userMessage) {
       console.warn('No preceding user message found');
       return;
     }

     // Delete the system message from database
     try {
       const res = await fetch(`/sessions/${this.currentSession}/chat/messages/${systemMessageId}`, {
         method: 'DELETE'
       });
       if (!res.ok) {
         console.warn('Failed to delete system message');
         return;
       }
     } catch (error) {
       console.warn('Failed to delete system message:', error);
       return;
     }

     // Remove the system message from UI
     this.messages.splice(systemMessageIndex, 1);
     this.requestUpdate();

     // Generate new response using the user message
     await this.generateFromUserMessage(userMessage.content, userMessage.id);
   }

   async generateFromUserMessage(prompt, userMessageId) {
     this.loading = true;

     // Generate a new userMessageId for the backend, but don't add to UI since user message already exists
     const newUserMessageId = crypto.randomUUID();

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
         body: JSON.stringify({ prompt, userMessageId: newUserMessageId })
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
                     if (sessionStorage.getItem('chatAutoScroll') !== 'false') {
                       setTimeout(() => {
                         const container = this.shadowRoot.querySelector('.chat-container');
                         container.scrollTop = container.scrollHeight;
                       }, 0);
                     }
                   } else if (data.reasoning) {
                     if (this.messages[systemMessageIndex].content.endsWith('</reasoning>')) {
                       this.messages[systemMessageIndex].content = this.messages[systemMessageIndex].content.slice(0, -12) + data.reasoning + '</reasoning>';
                     } else {
                       this.messages[systemMessageIndex].content += `<reasoning>${data.reasoning}</reasoning>`;
                     }
                     this.requestUpdate();
                     setTimeout(() => {
                       const container = this.shadowRoot.querySelector('.chat-container');
                       container.scrollTop = container.scrollHeight;
                     }, 0);
                    } else if (data.tool_call) {
                      this.requestUpdate();
                      if (sessionStorage.getItem('chatAutoScroll') !== 'false') {
                        setTimeout(() => {
                          const container = this.shadowRoot.querySelector('.chat-container');
                          container.scrollTop = container.scrollHeight;
                        }, 0);
                      }
                    } else if (data.agent_call) {
                      this.requestUpdate();
                      if (sessionStorage.getItem('chatAutoScroll') !== 'false') {
                        setTimeout(() => {
                          const container = this.shadowRoot.querySelector('.chat-container');
                          container.scrollTop = container.scrollHeight;
                        }, 0);
                      }
                    } else if (data.tool_result) {
                     this.requestUpdate();
                     if (sessionStorage.getItem('chatAutoScroll') !== 'false') {
                       setTimeout(() => {
                         const container = this.shadowRoot.querySelector('.chat-container');
                         container.scrollTop = container.scrollHeight;
                       }, 0);
                     }
                   } else if (data.finishReason) {
                     break;
                   } else if (data.messageId) {
                     this.messages[systemMessageIndex].id = data.messageId;
                     this.requestUpdate();
                    } else if (data.error) {
                      this.messages[systemMessageIndex] = { role: 'system', content: `<|error|>${data.error}<|error_end|>` };
                      this.requestUpdate();
                      return;
                   }
                 } catch (e) {
                   continue;
                 }
               }
             }
           }
         }
         // Don't call loadChatHistory for regeneration to avoid duplicating user messages
       } else {
         // Handle non-streaming response
         const data = await res.json();
         this.messages[systemMessageIndex] = { role: 'system', content: data.text || 'No response', id: data.messageId };
         this.requestUpdate();
         if (sessionStorage.getItem('chatAutoScroll') !== 'false') {
           setTimeout(() => {
             const container = this.shadowRoot.querySelector('.chat-container');
             container.scrollTop = container.scrollHeight;
           }, 0);
         }
         // Don't call loadChatHistory for regeneration to avoid duplicating user messages
       }
     } catch (error) {
       this.messages[systemMessageIndex] = { role: 'system', content: `Error: ${error.message}` };
       this.requestUpdate();
     } finally {
       this.loading = false;
       this.requestUpdate();
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
                     //this.messages[systemMessageIndex] = { role: 'system', content: `<|error|>${data.error}<|error_end|>` };
                     console.log(data.error);
                     //this.requestUpdate();
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

  parseMarkdown(text) {
    // text has HTML entities escaped except for quotes, asterisks, underscores, backticks
    return text
      .replace(/"([^"]*)"/g, '<span class="quote">"$1"</span>')
      .replace(/\*\*([^*]*)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]*)\*/g, '<span class="emphasis">$1</span>')
      .replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<span class="emphasis">$1</span>')
      .replace(/`([^`]*)`/g, '<code>$1</code>');
  }

  getDisplayContent(content) {
    const toolCallTag = '<|tool_call|>';
    const toolCallEndTag = '<|tool_call_end|>';
    const toolResultTag = '<|tool_result|>';
    const toolResultEndTag = '<|tool_result_end|>';
    const agentCallTag = '<|agent_call|>';
    const agentCallEndTag = '<|agent_call_end|>';
    const agentResultTag = '<|agent_result|>';
    const agentResultEndTag = '<|agent_result_end|>';
    const reasoningTag = '<reasoning>';
    const reasoningEndTag = '</reasoning>';
    const errorTag = '<|error|>';
    const errorEndTag = '<|error_end|>';
    let html = '';
    let pos = 0;
    while (pos < content.length) {
      let callStart = content.indexOf(toolCallTag, pos);
      let resultStart = content.indexOf(toolResultTag, pos);
      let agentCallStart = content.indexOf(agentCallTag, pos);
      let agentResultStart = content.indexOf(agentResultTag, pos);
      let reasoningStart = content.indexOf(reasoningTag, pos);
      let errorStart = content.indexOf(errorTag, pos);
      // Find the earliest tag
      let earliest = Math.min(
        callStart !== -1 ? callStart : Infinity,
        resultStart !== -1 ? resultStart : Infinity,
        agentCallStart !== -1 ? agentCallStart : Infinity,
        agentResultStart !== -1 ? agentResultStart : Infinity,
        reasoningStart !== -1 ? reasoningStart : Infinity,
        errorStart !== -1 ? errorStart : Infinity
      );
      if (earliest === Infinity) {
        let plainText = content.slice(pos);
        plainText = this.escapeHtml(plainText);
        plainText = this.parseMarkdown(plainText);
        html += plainText;
        break;
      }
      if (earliest === callStart) {
        // process tool_call
        let plainText = content.slice(pos, callStart);
        plainText = this.escapeHtml(plainText);
        plainText = this.parseMarkdown(plainText);
        html += plainText;
        let callEnd = content.indexOf(toolCallEndTag, callStart);
        if (callEnd === -1) {
          plainText = content.slice(callStart);
          plainText = this.escapeHtml(plainText);
          plainText = this.parseMarkdown(plainText);
          html += plainText;
          break;
        }
        let json = content.slice(callStart + toolCallTag.length, callEnd);
        try {
          const toolCall = JSON.parse(json);
          console.log('Processing tool_call in getDisplayContent:', toolCall.name);
          html += `<div class="tool-item">🔧 Calling tool: ${this.escapeHtml(toolCall.name)}(${this.escapeHtml(JSON.stringify(toolCall.arguments))})</div>`;
        } catch (e) {
          plainText = content.slice(callStart, callEnd + toolCallEndTag.length);
          plainText = this.escapeHtml(plainText);
          plainText = this.parseMarkdown(plainText);
          html += plainText;
        }
         pos = callEnd + toolCallEndTag.length;
       } else if (earliest === agentCallStart) {
         // process agent_call
         let plainText = content.slice(pos, agentCallStart);
         plainText = this.escapeHtml(plainText);
         plainText = this.parseMarkdown(plainText);
         html += plainText;
         let agentCallEnd = content.indexOf(agentCallEndTag, agentCallStart);
         if (agentCallEnd === -1) {
           plainText = content.slice(agentCallStart);
           plainText = this.escapeHtml(plainText);
           plainText = this.parseMarkdown(plainText);
           html += plainText;
           break;
         }
         let json = content.slice(agentCallStart + agentCallTag.length, agentCallEnd);
         try {
           const agentCall = JSON.parse(json);
           console.log('Processing agent_call in getDisplayContent:', agentCall.name);
           html += `<div class="agent-item">🤖 Calling agent: ${this.escapeHtml(agentCall.name)}(${this.escapeHtml(JSON.stringify(agentCall.input))})</div>`;
         } catch (e) {
           plainText = content.slice(agentCallStart, agentCallEnd + agentCallEndTag.length);
           plainText = this.escapeHtml(plainText);
           plainText = this.parseMarkdown(plainText);
           html += plainText;
         }
         pos = agentCallEnd + agentCallEndTag.length;
       } else if (earliest === agentResultStart) {
         // process agent_result
         let plainText = content.slice(pos, agentResultStart);
         plainText = this.escapeHtml(plainText);
         plainText = this.parseMarkdown(plainText);
         html += plainText;
         let agentResultEnd = content.indexOf(agentResultEndTag, agentResultStart);
         if (agentResultEnd === -1) {
           plainText = content.slice(agentResultStart);
           plainText = this.escapeHtml(plainText);
           plainText = this.parseMarkdown(plainText);
           html += plainText;
           break;
         }
         let json = content.slice(agentResultStart + agentResultTag.length, agentResultEnd);
         try {
           const agentResult = JSON.parse(json);
           console.log('Processing agent_result in getDisplayContent:', agentResult);
           html += `<div class="agent-item">✅ Agent result: ${this.escapeHtml(JSON.stringify(agentResult))}</div>`;
         } catch (e) {
           plainText = content.slice(agentResultStart, agentResultEnd + agentResultEndTag.length);
           plainText = this.escapeHtml(plainText);
           plainText = this.parseMarkdown(plainText);
           html += plainText;
         }
         pos = agentResultEnd + agentResultEndTag.length;
       } else if (earliest === resultStart) {
       } else if (earliest === agentCallStart) {
         // process agent_call
         let plainText = content.slice(pos, agentCallStart);
         plainText = this.escapeHtml(plainText);
         plainText = this.parseMarkdown(plainText);
         html += plainText;
         let agentCallEnd = content.indexOf(agentCallEndTag, agentCallStart);
         if (agentCallEnd === -1) {
           plainText = content.slice(agentCallStart);
           plainText = this.escapeHtml(plainText);
           plainText = this.parseMarkdown(plainText);
           html += plainText;
           break;
         }
         let json = content.slice(agentCallStart + agentCallTag.length, agentCallEnd);
         try {
           const agentCall = JSON.parse(json);
           console.log('Processing agent_call in getDisplayContent:', agentCall.name);
           html += `<div class="agent-item">🤖 Calling agent: ${this.escapeHtml(agentCall.name)}(${this.escapeHtml(JSON.stringify(agentCall.input))})</div>`;
         } catch (e) {
           plainText = content.slice(agentCallStart, agentCallEnd + agentCallEndTag.length);
           plainText = this.escapeHtml(plainText);
           plainText = this.parseMarkdown(plainText);
           html += plainText;
         }
         pos = agentCallEnd + agentCallEndTag.length;
       } else if (earliest === agentResultStart) {
         // process agent_result
         let plainText = content.slice(pos, agentResultStart);
         plainText = this.escapeHtml(plainText);
         plainText = this.parseMarkdown(plainText);
         html += plainText;
         let agentResultEnd = content.indexOf(agentResultEndTag, agentResultStart);
         if (agentResultEnd === -1) {
           plainText = content.slice(agentResultStart);
           plainText = this.escapeHtml(plainText);
           plainText = this.parseMarkdown(plainText);
           html += plainText;
           break;
         }
         let json = content.slice(agentResultStart + agentResultTag.length, agentResultEnd);
         try {
           const agentResult = JSON.parse(json);
           console.log('Processing agent_result in getDisplayContent:', agentResult);
           html += `<div class="agent-item">✅ Agent result: ${this.escapeHtml(JSON.stringify(agentResult))}</div>`;
         } catch (e) {
           plainText = content.slice(agentResultStart, agentResultEnd + agentResultEndTag.length);
           plainText = this.escapeHtml(plainText);
           plainText = this.parseMarkdown(plainText);
           html += plainText;
         }
         pos = agentResultEnd + agentResultEndTag.length;
       } else if (earliest === resultStart) {
        // process tool_result
        let plainText = content.slice(pos, resultStart);
        plainText = this.escapeHtml(plainText);
        plainText = this.parseMarkdown(plainText);
        html += plainText;
        let resultEnd = content.indexOf(toolResultEndTag, resultStart);
        if (resultEnd === -1) {
          plainText = content.slice(resultStart);
          plainText = this.escapeHtml(plainText);
          plainText = this.parseMarkdown(plainText);
          html += plainText;
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
          plainText = content.slice(resultStart, resultEnd + toolResultEndTag.length);
          plainText = this.escapeHtml(plainText);
          plainText = this.parseMarkdown(plainText);
          html += plainText;
        }
        pos = resultEnd + toolResultEndTag.length;
       } else if (earliest === reasoningStart) {
         // process reasoning
         let plainText = content.slice(pos, reasoningStart);
         plainText = this.escapeHtml(plainText);
         plainText = this.parseMarkdown(plainText);
         html += plainText;
         let reasoningEnd = content.indexOf(reasoningEndTag, reasoningStart);
         if (reasoningEnd === -1) {
           plainText = content.slice(reasoningStart);
           plainText = this.escapeHtml(plainText);
           plainText = this.parseMarkdown(plainText);
           html += plainText;
           break;
         }
         let reasoningText = content.slice(reasoningStart + reasoningTag.length, reasoningEnd);
         html += `<div class="reasoning-item">🧠 ${this.escapeHtml(reasoningText)}</div>`;
         pos = reasoningEnd + reasoningEndTag.length;
       } else if (earliest === errorStart) {
         // process error
         let plainText = content.slice(pos, errorStart);
         plainText = this.escapeHtml(plainText);
         plainText = this.parseMarkdown(plainText);
         html += plainText;
         let errorEnd = content.indexOf(errorEndTag, errorStart);
         if (errorEnd === -1) {
           plainText = content.slice(errorStart);
           plainText = this.escapeHtml(plainText);
           plainText = this.parseMarkdown(plainText);
           html += plainText;
           break;
         }
         let errorText = content.slice(errorStart + errorTag.length, errorEnd);
         html += `<div class="error-item">❌ ${this.escapeHtml(errorText)}</div>`;
         pos = errorEnd + errorEndTag.length;
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
         body: JSON.stringify({ prompt })
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
                       } else if (data.agent_call) {
                        // Handle agent call message
                        console.log('🎯 Frontend received agent_call during continue:', data.agent_call);
                        const msgIndex = this.messages.findIndex(msg => msg.id === messageId);
                        if (msgIndex !== -1) {
                          this.messages[msgIndex].content += `<|agent_call|>${JSON.stringify(data.agent_call)}<|agent_call_end|>`;
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

  playNextVoice() {
    if (this.isPlayingVoice || this.voiceQueue.length === 0) return;
    this.isPlayingVoice = true;
    const audioUrl = this.voiceQueue.shift();
    const audio = new Audio(audioUrl);
    audio.onended = () => {
      this.isPlayingVoice = false;
      this.playNextVoice();
    };
    audio.play().catch(err => {
      console.warn('Failed to play voice:', err);
      this.isPlayingVoice = false;
      this.playNextVoice();
    });
  }

  render() {
    return html`
      <top-bar></top-bar>
      <div class="chat-container">
         ${this.messages.map((msg, index) => {
           const isLastSystemMessage = msg.role === 'system' && index === this.messages.length - 1;
           const showContinueButton = msg.role === 'system' && index === this.messages.length - 1 && !this.loading;
           const showRegenerateButton = msg.role === 'system' && !this.loading;
           const isDeletable = msg.role === 'system' || msg.role === 'user';
           const isEditable = msg.role === 'system' || msg.role === 'user';
           const isEditing = this.editingMessageId === msg.id;

           if (isEditing) {
             return html`
               <div class="message-container">
                 <div class="message editing">
                   <textarea class="edit-input" .value=${this.editContent} @input=${(e) => this.editContent = e.target.value}></textarea>
                   <div class="edit-actions">
                     <button class="edit-cancel" @click=${this.cancelEdit}>Cancel</button>
                     <button class="edit-save" @click=${this.saveEdit}>Save</button>
                   </div>
                 </div>
               </div>
             `;
           }

           return html`
             <div class="message-container">
                <div class="message ${msg.role}">${unsafeHTML(this.stripLeadingNewlines(this.getDisplayContent(msg.content)))}${isDeletable && msg.id ? html`<button class="delete-button" @click=${(e) => this.deleteMessage(e, msg.id)}>×</button>` : ''}${isEditable && msg.id ? html`<button class="edit-button" @click=${() => this.startEdit(msg.id, msg.content)}>✎</button>` : ''}${showRegenerateButton && msg.id ? html`<button class="regenerate-button" @click=${() => this.regenerateMessage(msg.id)}>🔄</button>` : ''}${showContinueButton ? html`<button class="continue-button" @click=${() => this.handleContinue(msg.id)}>▶</button>` : ''}</div>
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