import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import './popup-dialog.js';

const dialog = document.createElement('popup-dialog');
document.body.appendChild(dialog);

export class PromptManagerWidget extends LitElement {
  static styles = css`
    .prompt-manager {
      display: flex;
      flex-direction: column;
      gap: 20px;
      color: var(--text-color);
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
    }

    .section {
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 15px;
      background: var(--secondary-bg);
    }

    .section h3 {
      margin: 0 0 10px 0;
      color: var(--text-color);
      font-size: 1.1em;
    }

    .groups-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .group-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px;
      background: var(--input-bg);
      border-radius: 4px;
      border: 1px solid var(--border-color);
    }

    .group-checkbox {
      width: 16px;
      height: 16px;
    }

    .group-name {
      flex: 1;
      font-family: monospace;
      font-size: 0.9em;
    }

    .group-preview {
      flex: 2;
      font-size: 0.8em;
      color: var(--text-color);
      opacity: 0.8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .build-section {
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 15px;
      background: var(--secondary-bg);
    }

    .ordered-groups {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 15px;
    }

    .group-tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 8px;
      background: var(--dark-accent);
      color: var(--light-text);
      border-radius: 12px;
      font-size: 0.8em;
      font-family: monospace;
    }

    .remove-group {
      cursor: pointer;
      color: var(--light-text);
      opacity: 0.7;
    }

    .remove-group:hover {
      opacity: 1;
    }

    .add-group-section {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .group-input {
      flex: 1;
      padding: 8px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--input-bg);
      color: var(--text-color);
      font-family: monospace;
      font-size: 0.9em;
    }

    .add-button {
      padding: 8px 12px;
      background-color: var(--dark-accent);
      color: var(--light-text);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9em;
    }

    .add-button:hover {
      background-color: var(--darker-accent);
    }

    .build-button {
      padding: 10px 20px;
      background-color: var(--dark-accent);
      color: var(--light-text);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1em;
      margin-top: 10px;
    }

    .build-button:hover {
      background-color: var(--darker-accent);
    }

    .result-section {
      margin-top: 15px;
      padding: 10px;
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      white-space: pre-wrap;
      font-family: monospace;
      font-size: 0.9em;
      max-height: 200px;
      overflow-y: auto;
    }

    .error {
      color: var(--error-color);
      font-size: 0.9em;
      margin-top: 5px;
    }

    .loading {
      color: var(--text-color);
      opacity: 0.7;
      font-style: italic;
    }
  `;

  static properties = {
    providers: { type: Array },
    groups: { type: Array },
    selectedGroups: { type: Array },
    orderedGroups: { type: Array },
    result: { type: String },
    error: { type: String },
    loading: { type: Boolean }
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
        this.result = data.prompt;
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
        <div class="section">
          <h3>Available Groups</h3>
          <div class="groups-list">
            ${this.groups.map(providerGroup => html`
              <div>
                <strong>${providerGroup.provider}:</strong>
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
              </div>
            `)}
          </div>
          <button class="add-button" @click=${this.addSelectedToOrder} ?disabled=${this.selectedGroups.length === 0}>
            Add Selected to Order
          </button>
        </div>

        <div class="build-section">
          <h3>Build Prompt</h3>

          <div class="ordered-groups">
            ${this.orderedGroups.map(groupPath => html`
              <span class="group-tag">
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

          <button class="build-button" @click=${this.buildPrompt} ?disabled=${this.loading}>
            ${this.loading ? 'Building...' : 'Build Prompt'}
          </button>

          ${this.error ? html`<div class="error">${this.error}</div>` : ''}
          ${this.loading ? html`<div class="loading">Building prompt...</div>` : ''}

          ${this.result ? html`
            <div class="result-section">
              <strong>Result:</strong><br>
              ${this.result}
            </div>
          ` : ''}
        </div>
      </div>
    `;
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
    dialog.contentTemplate = () => html`<prompt-manager-widget></prompt-manager-widget>`;
    dialog.open = true;
  });
}