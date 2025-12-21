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
      .message-container:hover .regenerate-button,
      .message-container:hover .voice-button {
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
       .voice-button {
         position: absolute;
         top: 5px;
         right: 105px;
         background: var(--border-color);
         color: var(--text-color);
         border: none;
         border-radius: 50%;
         width: 20px;
         height: 20px;
         cursor: pointer;
         opacity: 0;
         transition: opacity 0.2s;
         font-size: 10px;
         line-height: 1;
         display: flex;
         align-items: center;
         justify-content: center;
       }
      .voice-button:hover {
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
      editContent: { type: String },
      tooltipVisible: { type: Boolean },
      tooltipContent: { type: String },
      tooltipX: { type: Number },
      tooltipY: { type: Number }
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
       this.tooltipVisible = false;
       this.tooltipContent = '';
       this.tooltipX = 0;
       this.tooltipY = 0;
       this.checkLLMSettings();
     }

    parsePngMetadata(buffer) {
      const metadata = {};
      const view = new DataView(buffer);
      if (view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a) return metadata;
      let offset = 8;
      while (offset < buffer.byteLength) {
        const length = view.getUint32(offset, false);
        const type = String.fromCharCode(view.getUint8(offset+4), view.getUint8(offset+5), view.getUint8(offset+6), view.getUint8(offset+7));
        if (type === 'tEXt') {
          const data = new Uint8Array(buffer, offset+8, length);
          const nullIndex = data.indexOf(0);
          if (nullIndex !== -1) {
            const keyword = String.fromCharCode(...data.slice(0, nullIndex));
            const value = String.fromCharCode(...data.slice(nullIndex+1));
            metadata[keyword] = value;
          }
        }
        offset += 8 + length + 4;
      }
      console.log('PNG metadata:', metadata);
      return metadata;
    }

    async getPrompts(path) {
      try {
        const res = await fetch(`/images/${path}`);
        if (!res.ok) return { positive: '', negative: '' };
        const buffer = await res.arrayBuffer();
        const metadata = this.parsePngMetadata(buffer);
        let positive = '';
        let negative = '';
        if (metadata.prompt) {
          try {
            const workflow = JSON.parse(metadata.prompt);
            for (const nodeId in workflow) {
              const node = workflow[nodeId];
              if (node.class_type === 'CLIPTextEncode' && node.inputs.text !== undefined) {
                // Check connections to determine positive or negative
                let isPositive = false;
                let isNegative = false;
                for (const otherNodeId in workflow) {
                  const otherNode = workflow[otherNodeId];
                  if (otherNode.inputs) {
                    for (const inputKey in otherNode.inputs) {
                      const input = otherNode.inputs[inputKey];
                      if (Array.isArray(input) && input[0] === nodeId) {
                        if (inputKey === 'positive') isPositive = true;
                        if (inputKey === 'negative') isNegative = true;
                      }
                    }
                  }
                }
                if (isPositive) positive = node.inputs.text;
                if (isNegative) negative = node.inputs.text;
              }
            }
          } catch (e) {
            console.warn('Failed to parse workflow:', e);
          }
        }
        return { positive, negative };
      } catch (e) {
        console.warn('Failed to get prompts:', e);
        return { positive: '', negative: '' };
      }
    }

    showTooltip(e, img, traits, clothing, attributes, imgElement) {
      const rect = imgElement.getBoundingClientRect();
      this.tooltipX = rect.right + 10;
      this.tooltipY = rect.top;
      const activeTraits = Object.keys(traits || {}).filter(k => traits[k]);
      const activeClothing = Object.keys(clothing || {}).filter(k => clothing[k]);
      let attributesHtml = '';
      if (attributes && Object.keys(attributes).length > 0) {
        attributesHtml = '<br><strong>Attributes:</strong><br>';
        for (const character in attributes) {
          attributesHtml += `&nbsp;&nbsp;<strong>${character}:</strong><br>`;
          const charAttrs = attributes[character];
          for (const category in charAttrs) {
            const values = charAttrs[category];
            if (values && values.length > 0) {
              attributesHtml += `&nbsp;&nbsp;&nbsp;&nbsp;<strong>${category}:</strong> ${values.join(', ')}<br>`;
            }
          }
        }
      }
      const traitsHtml = activeTraits.length > 0 ? `<br><strong>Traits:</strong> ${activeTraits.join(', ')}` : '';
      const clothingHtml = activeClothing.length > 0 ? `<br><strong>Clothing:</strong> ${activeClothing.join(', ')}` : '';
      if (!img.prompts) {
        this.getPrompts(img.path).then(prompts => {
          img.prompts = prompts;
          this.tooltipContent = `<strong>Positive:</strong> ${prompts.positive}<br><strong>Negative:</strong> ${prompts.negative}${traitsHtml}${clothingHtml}${attributesHtml}`;
          this.tooltipVisible = true;
          this.requestUpdate();
        });
      } else {
        this.tooltipContent = `<strong>Positive:</strong> ${img.prompts.positive}<br><strong>Negative:</strong> ${img.prompts.negative}${traitsHtml}${clothingHtml}${attributesHtml}`;
        this.tooltipVisible = true;
        this.requestUpdate();
      }
    }

    hideTooltip() {
      this.tooltipVisible = false;
      this.requestUpdate();
    }

    openImagePopup(img) {
     if (!this.imagePopup) {
       this.imagePopup = document.createElement('popup-dialog');
       document.body.appendChild(this.imagePopup);
     }
     this.imagePopup.maxWidth = '90vw';
     this.imagePopup.maxHeight = '90vh';
     this.imagePopup.title = img.filename;
     this.imagePopup.contentTemplate = () => html`<img src="/images/${img.path}" style="max-width: 100%; max-height: 100%; display: block; margin: auto;">`;
     this.imagePopup.open = true;
   }

   connectedCallback() {
     super.connectedCallback();
     sessionManager.addSessionChangeListener(this.sessionChangeHandler);
     this.loadChatHistory();
     if (!this.imagePopup) {
       this.imagePopup = document.createElement('popup-dialog');
       document.body.appendChild(this.imagePopup);
     }
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
     console.log('ChatApp: Session changed to', sessionId);
     this.currentSession = sessionId;
     this.messages = [];
     this.loadChatHistory();
   }

  async loadChatHistory() {
    console.log('ChatApp: Loading chat history for session', this.currentSession);
    try {
      const res = await fetch(`/sessions/${this.currentSession}/chat/messages`);
      if (res.ok) {
        const data = await res.json();
        console.log('ChatApp: Loaded', data.messages.length, 'messages');
         const messages = [];
         for (const msg of data.messages) {
           const message = {
             id: msg.id,
             role: msg.actor === 'user' ? 'user' : 'system',
             content: msg.content,
             images: [],
             voiceItems: [],
             traits: {},
             clothing: {},
             attributes: {}
           };
           if (message.role === 'system') {
             try {
                const annRes = await fetch(`/sessions/${this.currentSession}/chat/messages/${msg.id}/annotations`);
               if (annRes.ok) {
                 const annData = await annRes.json();
                 console.log('ChatApp: Annotations for message', msg.id, annData.annotations);
                  if (annData.annotations.hasOwnProperty('tool.image.result')) {
                    const imageAnnotation = annData.annotations['tool.image.result'];
                    message.images = imageAnnotation;
                    console.log('ChatApp: Found images for message', msg.id, message.images.length, 'images');
                  }
                 if (annData.annotations.hasOwnProperty('evaluators.VoiceEvaluator')) {
                   const voiceAnnotation = annData.annotations['evaluators.VoiceEvaluator'];
                   message.voiceItems = voiceAnnotation.voiceItems;
                   console.log('ChatApp: Found voice items for message', msg.id, message.voiceItems.length, 'voice items:', message.voiceItems);
                  } else {
                    console.log('ChatApp: No voice annotation found for message', msg.id);
                  }
                  if (annData.annotations.hasOwnProperty('tool.traits.reactive')) {
                    const traitsAnnotation = annData.annotations['tool.traits.reactive'];
                    message.traits = traitsAnnotation.traits;
                    console.log('ChatApp: Found traits for message', msg.id, message.traits);
                  }
                  if (annData.annotations.hasOwnProperty('tool.clothing.reactive')) {
                    const clothingAnnotation = annData.annotations['tool.clothing.reactive'];
                    message.clothing = clothingAnnotation.clothing;
                    console.log('ChatApp: Found clothing for message', msg.id, message.clothing);
                  }
                  if (annData.annotations.hasOwnProperty('tool.attributes.v2')) {
                    const attributesAnnotation = annData.annotations['tool.attributes.v2'];
                    message.attributes = attributesAnnotation.active_attributes;
                    console.log('ChatApp: Found attributes for message', msg.id, message.attributes);
                  }
                }
             } catch (error) {
               console.warn('Failed to load annotations:', error);
             }
           }
          messages.push(message);
        }
        this.messages = messages;
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
                   } else if (data.chunkId) {
                     this.messages[systemMessageIndex].id = data.chunkId;
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
         this.messages[systemMessageIndex] = { role: 'system', content: data.text || 'No response', id: data.chunkId };
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
     console.log('ChatApp: Handling generate with prompt:', prompt);
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
                        console.log('ChatApp: Received token:', data.token);
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
                         console.log('ChatApp: Tool call received:', data.tool_call.name);
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
                       console.log('ChatApp: Generation finished:', data.finishReason);
                       break;
                   } else if (data.chunkId) {
                     // Set the message id for continuation
                     this.messages[systemMessageIndex].id = data.chunkId;
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
           this.messages[systemMessageIndex] = { role: 'system', content: data.text || 'No response', id: data.chunkId };
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

   async replayVoice(voiceItems) {
     if (this.isPlayingVoice) return; // Don't interrupt current playback

     if (!voiceItems || voiceItems.length === 0) {
       console.log('No voice items available for replay');
       return;
     }

      // Filter to only successfully generated voice items
      const generatedVoices = voiceItems.filter(item => item.status === 'generated' && item.filePath);

      if (generatedVoices.length === 0) {
        console.warn('No successfully generated voice files to replay');
        return;
      }

      // Add voice files to queue in order
      for (const voiceItem of generatedVoices) {
        try {
          // Fetch the audio file - filePath is like "generated/voices/filename.wav"
          const filename = voiceItem.filePath.split('/').pop();
          const response = await fetch(`/voices/${filename}`);
          if (!response.ok) {
            console.warn('Failed to fetch voice file:', voiceItem.filePath);
            continue;
          }

          const blob = await response.blob();
          const audioUrl = URL.createObjectURL(blob);
          this.voiceQueue.push(audioUrl);
        } catch (error) {
          console.warn('Failed to load voice file:', voiceItem.filePath, error);
        }
      }

      // Start playing if not already playing
      if (!this.isPlayingVoice && this.voiceQueue.length > 0) {
        this.playNextVoice();
      }
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
                  <div class="message ${msg.role}">${unsafeHTML(this.stripLeadingNewlines(this.getDisplayContent(msg.content)))}${isDeletable && msg.id ? html`<button class="delete-button" @click=${(e) => this.deleteMessage(e, msg.id)}>×</button>` : ''}${isEditable && msg.id ? html`<button class="edit-button" @click=${() => this.startEdit(msg.id, msg.content)}>✎</button>` : ''}${showRegenerateButton && msg.id ? html`<button class="regenerate-button" @click=${() => this.regenerateMessage(msg.id)}>🔄</button>` : ''}${showContinueButton ? html`<button class="continue-button" @click=${() => this.handleContinue(msg.id)}>▶</button>` : ''}${msg.voiceItems && msg.voiceItems.length > 0 ? html`<button class="voice-button" @click=${() => this.replayVoice(msg.voiceItems)}>📣</button>` : ''}</div>
                  ${msg.images && msg.images.length > 0 ? html`<div class="message-images">${msg.images.map(img => html`<img src="/images/${img.path}" alt="${img.filename}" style="max-width: 200px; max-height: 200px; margin-left: 10px; cursor: pointer;" @click=${() => this.openImagePopup(img)} @mouseover=${(e) => this.showTooltip(e, img, msg.traits, msg.clothing, msg.attributes, e.target)} @mouseout=${() => this.hideTooltip()}>`)}</div>` : ''}
                ${this.loading && isLastSystemMessage ? html`<div class="generating-indicator">Generating...</div>` : ''}
              </div>
            `;
         })}
      </div>
       <div class="resizer" @mousedown=${this.startResize}></div>
       <dock-widget .loading=${this.loading} @generate=${this.handleGenerate} style=${this.dockHeight ? `height: ${this.dockHeight}px;` : ''}></dock-widget>
       ${this.tooltipVisible ? html`<div style="position: fixed; left: ${this.tooltipX}px; top: ${this.tooltipY}px; background: var(--primary-bg); color: var(--text-color); border: 1px solid var(--border-color); padding: 5px; border-radius: 5px; z-index: 1000; max-width: 600px;">${unsafeHTML(this.tooltipContent)}</div>` : ''}
     `;
  }
}

customElements.define('chat-app', ChatApp);