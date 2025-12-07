import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import './popup-dialog.js';

const dialog = document.createElement('popup-dialog');
document.body.appendChild(dialog);

export class OpenRouterSettingsWidget extends LitElement {
  static styles = css`
    .settings-form {
      display: flex;
      flex-direction: column;
      gap: 15px;
      color: var(--text-color);
      max-width: 400px;
    }

    .setting-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    label {
      font-weight: bold;
      font-size: 0.9em;
    }

    input, select {
      padding: 8px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--input-bg);
      color: var(--text-color);
    }

    input[type="password"] {
      font-family: monospace;
    }

    input[type="number"] {
      width: 100px;
    }

    select {
      width: 100%;
    }

    .button-group {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      margin-top: 20px;
    }

    button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9em;
    }

    .save-btn {
      background-color: var(--dark-accent);
      color: var(--light-text);
    }

    .save-btn:hover {
      background-color: var(--darker-accent);
    }

    .cancel-btn {
      background-color: var(--secondary-bg);
      color: var(--text-color);
      border: 1px solid var(--border-color);
    }

    .cancel-btn:hover {
      background-color: var(--border-color);
    }

    .status {
      margin-top: 10px;
      padding: 8px;
      border-radius: 4px;
      font-size: 0.9em;
    }

    .status.success {
      background-color: var(--success-bg);
      color: var(--success-text);
      border: 1px solid var(--success-border);
    }

    .status.error {
      background-color: var(--error-bg);
      color: var(--error-text);
      border: 1px solid var(--error-border);
    }

    .model-info {
      font-size: 0.8em;
      color: var(--text-color-secondary);
      margin-top: 4px;
    }
  `;

  static properties = {
    settings: { type: Object },
    models: { type: Array },
    status: { type: String },
    statusType: { type: String }
  };

  constructor() {
    super();
    this.settings = {
      apiKey: '',
      model: 'tngtech/tng-r1t-chimera:free',
      maxTokens: 100,
      temperature: 0.7,
      topP: 0.9,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      enableReasoning: true
    };
    this.models = [];
    this.status = '';
    this.statusType = '';
    this.loadSettings();
    this.loadModels();
  }

  async loadSettings() {
    try {
      const res = await fetch('/openrouter/settings');
      if (res.ok) {
        this.settings = await res.json();
      }
    } catch (error) {
      this.showStatus('Failed to load settings: ' + error.message, 'error');
    }
  }

  async loadModels() {
    try {
      const res = await fetch('/openrouter/models');
      if (res.ok) {
        const data = await res.json();
        this.models = data.data || [];
      } else {
        // Fallback to common models if API call fails
        this.models = [
          { id: 'tngtech/tng-r1t-chimera:free', name: 'TNG R1T Chimera (Free)' },
          { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
          { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
          { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' }
        ];
      }
    } catch (error) {
      // Use fallback models
      this.models = [
        { id: 'tngtech/tng-r1t-chimera:free', name: 'TNG R1T Chimera (Free)' },
        { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
        { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' }
      ];
    }
  }

  async saveSettings() {
    try {
      const res = await fetch('/openrouter/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.settings)
      });

      if (res.ok) {
        this.showStatus('Settings saved successfully!', 'success');
      } else {
        const error = await res.json();
        this.showStatus('Failed to save settings: ' + error.error, 'error');
      }
    } catch (error) {
      this.showStatus('Failed to save settings: ' + error.message, 'error');
    }
  }

  showStatus(message, type) {
    this.status = message;
    this.statusType = type;
    setTimeout(() => {
      this.status = '';
      this.statusType = '';
    }, 3000);
  }

  handleInputChange(e) {
    const { name, value, type, checked } = e.target;
    this.settings = {
      ...this.settings,
      [name]: type === 'number' ? parseFloat(value) : type === 'checkbox' ? checked : value
    };
  }

  handleSave() {
    this.saveSettings();
  }

  handleCancel() {
    dialog.open = false;
  }

  render() {
    return html`
      <div class="settings-form">

        <div class="setting-group">
          <label for="apiKey">API Key:</label>
          <input
            type="password"
            id="apiKey"
            name="apiKey"
            .value=${this.settings.apiKey}
            @input=${this.handleInputChange}
            placeholder="sk-or-v1-..."
          >
        </div>

        <div class="setting-group">
          <label for="model">Model:</label>
          <select
            id="model"
            name="model"
            .value=${this.settings.model}
            @change=${this.handleInputChange}
          >
            ${this.models.map(model => html`
              <option value=${model.id} ?selected=${model.id === this.settings.model}>
                ${model.name || model.id}
              </option>
            `)}
          </select>
          <div class="model-info">Select the OpenRouter model to use for generation</div>
        </div>

        <div class="setting-group">
          <label for="maxTokens">Max Tokens:</label>
          <input
            type="number"
            id="maxTokens"
            name="maxTokens"
            .value=${this.settings.maxTokens}
            @input=${this.handleInputChange}
            min="1"
            max="32768"
          >
        </div>

        <div class="setting-group">
          <label for="temperature">Temperature:</label>
          <input
            type="number"
            id="temperature"
            name="temperature"
            .value=${this.settings.temperature}
            @input=${this.handleInputChange}
            min="0"
            max="2"
            step="0.1"
          >
        </div>

        <div class="setting-group">
          <label for="topP">Top P:</label>
          <input
            type="number"
            id="topP"
            name="topP"
            .value=${this.settings.topP}
            @input=${this.handleInputChange}
            min="0"
            max="1"
            step="0.05"
          >
        </div>

        <div class="setting-group">
          <label for="frequencyPenalty">Frequency Penalty:</label>
          <input
            type="number"
            id="frequencyPenalty"
            name="frequencyPenalty"
            .value=${this.settings.frequencyPenalty}
            @input=${this.handleInputChange}
            min="-2"
            max="2"
            step="0.1"
          >
        </div>

        <div class="setting-group">
          <label for="presencePenalty">Presence Penalty:</label>
          <input
            type="number"
            id="presencePenalty"
            name="presencePenalty"
            .value=${this.settings.presencePenalty}
            @input=${this.handleInputChange}
            min="-2"
            max="2"
            step="0.1"
          >
        </div>

        <div class="setting-group">
          <label for="enableReasoning">
            <input
              type="checkbox"
              id="enableReasoning"
              name="enableReasoning"
              .checked=${this.settings.enableReasoning}
              @change=${this.handleInputChange}
            >
            Enable Reasoning
          </label>
          <div class="model-info">Enable reasoning/thinking process in model responses</div>
        </div>

        ${this.status ? html`
          <div class="status ${this.statusType}">${this.status}</div>
        ` : ''}

        <div class="button-group">
          <button class="cancel-btn" @click=${this.handleCancel}>Cancel</button>
          <button class="save-btn" @click=${this.handleSave}>Save Settings</button>
        </div>
      </div>
    `;
  }
}

customElements.define('openrouter-settings-widget', OpenRouterSettingsWidget);

export function register(toolboxMenu) {
  toolboxMenu.addItem('OpenRouter Settings', [], () => {
    dialog.contentTemplate = () => html`<openrouter-settings-widget></openrouter-settings-widget>`;
    dialog.title = 'OpenRouter Settings';
    dialog.open = true;
  });
}