import { LitElement, html, css, unsafeHTML } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import './popup-dialog.js';

const dialog = document.createElement('popup-dialog');
document.body.appendChild(dialog);

export class PromptManagerWidget extends LitElement {
  static styles = css`
    .prompt-manager {
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: var(--text-color);
      max-width: 800px;
      max-height: 400px;
    }

    .top-row {
      display: flex;
      flex-direction: row;
      gap: 8px;
      flex: 1;
      min-height: 0;
    }

    .left-panel, .right-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 0;
    }

    .left-panel .section, .right-panel .build-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .bottom-section {
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 6px;
      background: var(--secondary-bg);
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
      box-sizing: border-box;
      align-items: stretch;
    }

    .section {
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 6px;
      background: var(--secondary-bg);
    }

    .section h3 {
      margin: 0 0 3px 0;
      color: var(--text-color);
      font-size: 0.85em;
      font-weight: 600;
    }

    .groups-list {
      display: flex;
      flex-direction: column;
      gap: 3px;
      flex: 1;
      overflow-y: auto;
      min-height: 0;
    }

    .group-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      background: var(--input-bg);
      border-radius: 2px;
      border: 1px solid var(--border-color);
      font-size: 0.8em;
      min-height: 28px;
    }

    .group-checkbox {
      width: 12px;
      height: 12px;
      flex-shrink: 0;
    }

    .group-name {
      flex: 1;
      font-family: monospace;
      font-size: 0.8em;
      font-weight: 500;
    }

    .group-preview {
      flex: 1.2;
      font-size: 0.75em;
      color: var(--text-color);
      opacity: 0.7;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .build-section {
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 6px;
      background: var(--secondary-bg);
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

     .ordered-groups {
       display: flex;
       flex-direction: column;
       gap: 4px;
       margin-bottom: 6px;
       min-height: 20px;
       position: relative;
     }

     .group-tag {
       display: inline-flex;
       align-items: center;
       gap: 3px;
       padding: 2px 4px;
       background: var(--dark-accent);
       color: var(--light-text);
       border-radius: 6px;
       font-size: 0.7em;
       font-family: monospace;
       font-weight: 500;
       white-space: nowrap;
       cursor: grab;
     }

     .group-tag.dragging {
       opacity: 0.5;
     }

     .group-tag.drag-over {
       background: var(--darker-accent);
     }

     .insert-indicator {
       position: absolute;
       left: 0;
       right: 0;
       height: 2px;
       background: var(--dark-accent);
       border-radius: 1px;
       opacity: 0;
       transition: opacity 0.2s ease;
       pointer-events: none;
       z-index: 10;
     }

     .insert-indicator.visible {
       opacity: 1;
     }

    .remove-group {
      cursor: pointer;
      color: var(--light-text);
      opacity: 0.8;
      font-size: 1.2em;
      line-height: 1;
      margin-left: 1px;
    }

    .remove-group:hover {
      opacity: 1;
      color: var(--error-color, #ff6b6b);
    }

    .add-group-section {
      display: flex;
      gap: 6px;
      align-items: stretch;
      margin-bottom: 6px;
    }

    .group-input {
      flex: 1;
      padding: 4px 6px;
      border: 1px solid var(--border-color);
      border-radius: 2px;
      background: var(--input-bg);
      color: var(--text-color);
      font-family: monospace;
      font-size: 0.8em;
      min-height: 28px;
    }

    .add-button {
      padding: 4px 8px;
      background-color: var(--dark-accent);
      color: var(--light-text);
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-size: 0.8em;
      font-weight: 500;
      white-space: nowrap;
    }

    .add-button:hover {
      background-color: var(--darker-accent);
    }

    .action-area {
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .placeholder-text {
      font-size: 0.75em;
      color: var(--text-color);
      opacity: 0.5;
      text-align: center;
      width: 100%;
    }

    .bottom-section .build-button {
      width: 100%;
      padding: 8px 16px;
      background-color: var(--dark-accent);
      color: var(--light-text);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9em;
      font-weight: 500;
      text-align: center;
    }

    .bottom-section .build-button:hover {
      background-color: var(--darker-accent);
    }

    .bottom-section .result-section {
      margin-top: 4px;
      padding: 4px 6px;
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      border-radius: 3px;
      white-space: pre-wrap;
      font-family: monospace;
      font-size: 0.8em;
      line-height: 1.2;
      max-height: 120px;
      overflow-y: auto;
      width: 100%;
      box-sizing: border-box;
      align-self: flex-start;
    }

    .result-section * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    .result-section > div:first-child {
      font-weight: 600;
      margin-bottom: 2px !important;
    }

    .result-section > div:last-child {
      margin-top: 0 !important;
    }

    .error {
      color: var(--error-color);
      font-size: 0.75em;
      margin-top: 3px;
      font-weight: 500;
    }

    .loading {
      color: var(--text-color);
      opacity: 0.7;
      font-style: italic;
      font-size: 0.8em;
      margin-top: 3px;
    }
  `;

  static properties = {
    providers: { type: Array },
    groups: { type: Array },
    selectedGroups: { type: Array },
    orderedGroups: { type: Array },
    result: { type: String },
    error: { type: String },
    loading: { type: Boolean },
    draggedIndex: { type: Number }
  };

  constructor() {
    super();
    this.providers = [];
    this.groups = [];
    this.selectedGroups = [];
    this.orderedGroups = [];
    this.result = '';
    this.error = '';
    this.loading = false;
    this.draggedIndex = null;
    this.loadData();
  }

  async loadData() {
    try {
      const [providersRes, groupsRes] = await Promise.all([
        fetch('/prompts/providers'),
        fetch('/prompts/groups')
      ]);

      if (providersRes.ok) {
        const providersData = await providersRes.json();
        this.providers = providersData.providers;
      }

      if (groupsRes.ok) {
        const groupsData = await groupsRes.json();
        this.groups = groupsData.groups;
      }
    } catch (error) {
      this.error = 'Failed to load prompt data: ' + error.message;
    }
  }

  handleGroupToggle(groupPath, checked) {
    if (checked) {
      this.selectedGroups = [...this.selectedGroups, groupPath];
    } else {
      this.selectedGroups = this.selectedGroups.filter(g => g !== groupPath);
    }
  }

  addToOrder() {
    const input = this.shadowRoot.querySelector('.group-input');
    const groupPath = input.value.trim();

    if (groupPath && !this.orderedGroups.includes(groupPath)) {
      this.orderedGroups = [...this.orderedGroups, groupPath];
      input.value = '';
    }
  }

  removeFromOrder(groupPath) {
    this.orderedGroups = this.orderedGroups.filter(g => g !== groupPath);
  }

  handleDragStart(e, index) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
    e.target.classList.add('dragging');
    this.draggedIndex = index;
  }

  handleContainerDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const tags = container.querySelectorAll('.group-tag');

    if (tags.length === 0) {
      // Empty container
      this.updateInsertIndicator(0);
      return;
    }

    // Find which item we're over
    let insertIndex = tags.length;
    for (let i = 0; i < tags.length; i++) {
      const tagRect = tags[i].getBoundingClientRect();
      const tagY = tagRect.top - rect.top;
      if (y < tagY + tagRect.height / 2) {
        insertIndex = i;
        break;
      }
    }

    this.updateInsertIndicator(insertIndex);
  }

  handleDragOver(e, index) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    const insertIndex = y < height / 2 ? index : index + 1;

    this.updateInsertIndicator(insertIndex);
    return false;
  }

  handleDragEnter(e, index) {
    // Keep for compatibility but main logic moved to dragover
  }

  handleDragLeave(e) {
    // Keep for compatibility but main logic moved to dragover
  }

  handleDrop(e, dropIndex) {
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    const insertIndex = y < height / 2 ? dropIndex : dropIndex + 1;

    if (this.draggedIndex === insertIndex || this.draggedIndex === insertIndex - 1) return;

    const draggedGroup = this.orderedGroups[this.draggedIndex];
    const newOrderedGroups = [...this.orderedGroups];
    newOrderedGroups.splice(this.draggedIndex, 1);
    newOrderedGroups.splice(insertIndex > this.draggedIndex ? insertIndex - 1 : insertIndex, 0, draggedGroup);

    this.orderedGroups = newOrderedGroups;

    this.hideInsertIndicator();

    // Clean up drag classes
    const tags = this.shadowRoot.querySelectorAll('.group-tag');
    tags.forEach(tag => {
      tag.classList.remove('dragging', 'drag-over');
    });

    return false;
  }

  handleDragEnd(e) {
    this.hideInsertIndicator();

    const tags = this.shadowRoot.querySelectorAll('.group-tag');
    tags.forEach(tag => {
      tag.classList.remove('dragging', 'drag-over');
    });
  }

  updateInsertIndicator(insertIndex) {
    const indicator = this.shadowRoot.querySelector('#insert-indicator');
    const tags = this.shadowRoot.querySelectorAll('.group-tag');

    if (insertIndex === 0) {
      indicator.style.top = '-3px';
    } else if (insertIndex >= tags.length) {
      const lastTag = tags[tags.length - 1];
      indicator.style.top = (lastTag.offsetTop + lastTag.offsetHeight - 3) + 'px';
    } else {
      const tag = tags[insertIndex];
      indicator.style.top = (tag.offsetTop - 3) + 'px';
    }

    indicator.classList.add('visible');
  }

  hideInsertIndicator() {
    const indicator = this.shadowRoot.querySelector('#insert-indicator');
    indicator.classList.remove('visible');
  }

  handleContainerDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const tags = container.querySelectorAll('.group-tag');

    let insertIndex = tags.length;
    for (let i = 0; i < tags.length; i++) {
      const tagRect = tags[i].getBoundingClientRect();
      const tagY = tagRect.top - rect.top;
      if (y < tagY + tagRect.height / 2) {
        insertIndex = i;
        break;
      }
    }

    if (this.draggedIndex === insertIndex || this.draggedIndex === insertIndex - 1) return;

    const draggedGroup = this.orderedGroups[this.draggedIndex];
    const newOrderedGroups = [...this.orderedGroups];
    newOrderedGroups.splice(this.draggedIndex, 1);
    newOrderedGroups.splice(insertIndex > this.draggedIndex ? insertIndex - 1 : insertIndex, 0, draggedGroup);

    this.orderedGroups = newOrderedGroups;

    this.hideInsertIndicator();

    // Clean up drag classes
    const tags2 = this.shadowRoot.querySelectorAll('.group-tag');
    tags2.forEach(tag => {
      tag.classList.remove('dragging', 'drag-over');
    });
  }

  addSelectedToOrder() {
    for (const groupPath of this.selectedGroups) {
      if (!this.orderedGroups.includes(groupPath)) {
        this.orderedGroups = [...this.orderedGroups, groupPath];
      }
    }
    this.selectedGroups = [];
  }

  async buildPrompt() {
    if (this.orderedGroups.length === 0) {
      this.error = 'Please add at least one group to the order.';
      return;
    }

    this.loading = true;
    this.error = '';
    this.result = '';

    try {
      const response = await fetch('/prompts/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groups: this.orderedGroups
        })
      });

      if (response.ok) {
        const data = await response.json();
        this.result = data.prompt.trim();
      } else {
        const errorData = await response.json();
        this.error = errorData.error || 'Failed to build prompt';
      }
    } catch (error) {
      this.error = 'Failed to build prompt: ' + error.message;
    } finally {
      this.loading = false;
    }
  }

  render() {
    return html`
      <div class="prompt-manager">
        <div class="top-row">
          <div class="left-panel">
            <div class="section">
              <h3>Available Groups</h3>
              <div class="groups-list">
                ${this.groups.map(providerGroup => html`
                  ${providerGroup.groups.map(groupName => {
                    const groupPath = `${providerGroup.provider}/${groupName}`;
                    const isSelected = this.selectedGroups.includes(groupPath);
                    return html`
                      <div class="group-item">
                        <input
                          type="checkbox"
                          class="group-checkbox"
                          .checked=${isSelected}
                          @change=${(e) => this.handleGroupToggle(groupPath, e.target.checked)}
                        >
                        <span class="group-name">${groupPath}</span>
                        <span class="group-preview">${this.getGroupPreview(providerGroup.provider, groupName)}</span>
                      </div>
                    `;
                  })}
                `)}
              </div>
              <div class="action-area">
                ${this.selectedGroups.length > 0 ? html`
                  <button class="add-button" @click=${this.addSelectedToOrder}>
                    Add Selected (${this.selectedGroups.length}) to Order
                  </button>
                ` : html`${unsafeHTML('<div class="placeholder-text">' + this.getPlaceholderText().trim() + '</div>')}`}
              </div>
            </div>
          </div>

          <div class="right-panel">
            <div class="section build-section">
              <h3>Build Prompt</h3>

               <div class="ordered-groups" @dragover=${this.handleContainerDragOver} @drop=${this.handleContainerDrop}>
                 <div class="insert-indicator" id="insert-indicator"></div>
                 ${this.orderedGroups.map((groupPath, index) => html`
                   <span
                     class="group-tag"
                     draggable="true"
                     @dragstart=${(e) => this.handleDragStart(e, index)}
                     @dragover=${(e) => this.handleDragOver(e, index)}
                     @dragenter=${(e) => this.handleDragEnter(e, index)}
                     @dragleave=${this.handleDragLeave}
                     @drop=${(e) => this.handleDrop(e, index)}
                     @dragend=${this.handleDragEnd}
                   >
                     ${groupPath}
                     <span class="remove-group" @click=${() => this.removeFromOrder(groupPath)}>×</span>
                   </span>
                 `)}
               </div>

              <div class="add-group-section">
                <input
                  type="text"
                  class="group-input"
                  placeholder="Enter group path (e.g., system/basic or system/*)"
                  @keydown=${(e) => e.key === 'Enter' && this.addToOrder()}
                >
                <button class="add-button" @click=${this.addToOrder}>Add</button>
              </div>
            </div>
          </div>
        </div>

        <div class="bottom-section">
          <button class="build-button" @click=${this.buildPrompt} ?disabled=${this.loading}>${this.loading ? 'Building...' : 'Build Prompt'}</button>

          ${this.error ? html`<div class="error">${this.error}</div>` : ''}
          ${this.loading ? html`<div class="loading">Building prompt...</div>` : ''}

          ${this.result ? html`
            <div class="result-section">${this.result}</div>
          ` : ''}
        </div>
      </div>
    `;
  }

  getPlaceholderText() {
    return 'Select groups above to add them to your prompt';
  }

  getGroupPreview(providerName, groupName) {
    // This is a simple preview - in a real implementation you might fetch actual content
    if (providerName === 'system') {
      if (groupName === 'basic') return 'Simple system prompt';
      if (groupName === 'advanced') return 'Detailed system prompt with formatting';
    }
    return 'Prompt group';
  }
}

customElements.define('prompt-manager-widget', PromptManagerWidget);

export function register(toolboxMenu) {
  toolboxMenu.addItem('Prompt Manager', [], () => {
    dialog.title = 'Prompt Manager';
    dialog.contentTemplate = () => html`<prompt-manager-widget></prompt-manager-widget>`;
    dialog.open = true;
  });
}