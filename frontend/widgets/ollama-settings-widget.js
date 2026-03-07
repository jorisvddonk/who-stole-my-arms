import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import './popup-dialog.js';

const dialog = document.createElement('popup-dialog');
document.body.appendChild(dialog);

export class OllamaSettingsWidget extends LitElement {
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

    input[type="number"] {
      width: 100px;
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

    .load-models-btn {
      background-color: var(--secondary-bg);
      color: var(--text-color);
      border: 1px solid var(--border-color);
    }

    .load-models-btn:hover {
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

    .models-list {
      margin-top: 10px;
      max-height: 150px;
      overflow-y: auto;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 8px;
      background: var(--secondary-bg);
    }

    .model-item {
      padding: 4px 8px;
      cursor: pointer;
      border-radius: 2px;
    }

    .model-item:hover {
      background: var(--border-color);
    }
  `;

  static properties = {
    settings: { type: Object },
    status: { type: String },
    statusType: { type: String },
    availableModels: { type: Array }
  };

  constructor() {
    super();
    this.settings = {
      baseUrl: 'http://localhost:11434',
      model: 'gemma3:1b',
      temperature: 0.8,
      topP: 0.9,
      topK: 40,
      numCtx: 4096,
      numGPU: 0,
      numThread: 0,
      repeatPenalty: 1.1,
      repeatLastN: 64,
      seed: -1,
      stop: [],
      format: ''
    };
    this.status = '';
    this.statusType = '';
    this.availableModels = [];
    this.loadSettings();
  }

  async loadSettings() {
    try {
      const res = await fetch('/ollama/settings');
      if (res.ok) {
        const loadedSettings = await res.json();
        this.settings = {
          ...loadedSettings,
          stop: Array.isArray(loadedSettings.stop) ? loadedSettings.stop : []
        };
      }
    } catch (error) {
      this.showStatus('Failed to load settings: ' + error.message, 'error');
    }
  }

  async loadModels() {
    try {
      const res = await fetch('/ollama/models');
      if (res.ok) {
        const data = await res.json();
        this.availableModels = data.models || [];
        if (this.availableModels.length === 0) {
          this.showStatus('No models found. Make sure Ollama is running.', 'error');
        }
      } else {
        this.showStatus('Failed to load models: ' + res.statusText, 'error');
      }
    } catch (error) {
      this.showStatus('Failed to load models: ' + error.message, 'error');
    }
  }

  selectModel(modelName) {
    this.settings = {
      ...this.settings,
      model: modelName
    };
    this.requestUpdate();
  }

  async saveSettings() {
    try {
      const res = await fetch('/ollama/settings', {
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
    const { name, value, type } = e.target;
    let processedValue = value;

    if (type === 'number') {
      processedValue = parseFloat(value);
    } else if (name === 'stop') {
      try {
        processedValue = JSON.parse(value);
      } catch {
        return;
      }
    }

    this.settings = {
      ...this.settings,
      [name]: processedValue
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
          <label for="baseUrl">Base URL:</label>
          <input
            type="text"
            id="baseUrl"
            name="baseUrl"
            .value=${this.settings.baseUrl}
            @input=${this.handleInputChange}
          >
        </div>

        <div class="setting-group">
          <label for="model">Model:</label>
          <div style="display: flex; gap: 8px;">
            <input
              type="text"
              id="model"
              name="model"
              .value=${this.settings.model}
              @input=${this.handleInputChange}
              style="flex: 1;"
            >
            <button class="load-models-btn" @click=${this.loadModels}>Load Models</button>
          </div>
        </div>

        ${this.availableModels.length > 0 ? html`
          <div class="models-list">
            ${this.availableModels.map(model => html`
              <div class="model-item" @click=${() => this.selectModel(model.name)}>
                ${model.name}
              </div>
            `)}
          </div>
        ` : ''}

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
          <label for="topK">Top K:</label>
          <input
            type="number"
            id="topK"
            name="topK"
            .value=${this.settings.topK}
            @input=${this.handleInputChange}
            min="0"
          >
        </div>

        <div class="setting-group">
          <label for="numCtx">Context Length:</label>
          <input
            type="number"
            id="numCtx"
            name="numCtx"
            .value=${this.settings.numCtx}
            @input=${this.handleInputChange}
            min="1"
          >
        </div>

        <div class="setting-group">
          <label for="repeatPenalty">Repeat Penalty:</label>
          <input
            type="number"
            id="repeatPenalty"
            name="repeatPenalty"
            .value=${this.settings.repeatPenalty}
            @input=${this.handleInputChange}
            min="0"
            step="0.1"
          >
        </div>

        <div class="setting-group">
          <label for="repeatLastN">Repeat Last N:</label>
          <input
            type="number"
            id="repeatLastN"
            name="repeatLastN"
            .value=${this.settings.repeatLastN}
            @input=${this.handleInputChange}
            min="0"
          >
        </div>

        <div class="setting-group">
          <label for="numGPU">Num GPU:</label>
          <input
            type="number"
            id="numGPU"
            name="numGPU"
            .value=${this.settings.numGPU}
            @input=${this.handleInputChange}
            min="0"
          >
        </div>

        <div class="setting-group">
          <label for="numThread">Num Thread:</label>
          <input
            type="number"
            id="numThread"
            name="numThread"
            .value=${this.settings.numThread}
            @input=${this.handleInputChange}
            min="0"
          >
        </div>

        <div class="setting-group">
          <label for="seed">Seed (-1 for random):</label>
          <input
            type="number"
            id="seed"
            name="seed"
            .value=${this.settings.seed}
            @input=${this.handleInputChange}
          >
        </div>

        <div class="setting-group">
          <label for="stop">Stop Sequences (JSON array):</label>
          <input
            type="text"
            id="stop"
            name="stop"
            .value=${JSON.stringify(this.settings.stop)}
            @input=${this.handleInputChange}
          >
        </div>

        <div class="setting-group">
          <label for="format">Format (json for JSON mode, empty for plain):</label>
          <input
            type="text"
            id="format"
            name="format"
            .value=${this.settings.format}
            @input=${this.handleInputChange}
          >
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

customElements.define('ollama-settings-widget', OllamaSettingsWidget);

export function register(toolboxMenu) {
  toolboxMenu.addItem('Ollama Settings', [], () => {
    dialog.contentTemplate = () => html`<ollama-settings-widget></ollama-settings-widget>`;
    dialog.title = 'Ollama Settings';
    dialog.open = true;
  });
}
