import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import './popup-dialog.js';

const dialog = document.createElement('popup-dialog');
document.body.appendChild(dialog);

export class KoboldSettingsWidget extends LitElement {
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
  `;

  static properties = {
    settings: { type: Object },
    status: { type: String },
    statusType: { type: String }
  };

  constructor() {
    super();
    this.settings = {
      baseUrl: 'http://localhost:5001',
      maxLength: 100,
      temperature: 0.7,
      topK: 40,
      topP: 0.9,
      repetitionPenalty: 1.0,
      minP: 0.05
    };
    this.status = '';
    this.statusType = '';
    this.loadSettings();
  }

  async loadSettings() {
    try {
      const res = await fetch('/kobold/settings');
      if (res.ok) {
        this.settings = await res.json();
      }
    } catch (error) {
      this.showStatus('Failed to load settings: ' + error.message, 'error');
    }
  }

  async saveSettings() {
    try {
      const res = await fetch('/kobold/settings', {
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
    this.settings = {
      ...this.settings,
      [name]: type === 'number' ? parseFloat(value) : value
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
          <label for="maxLength">Max Length:</label>
          <input
            type="number"
            id="maxLength"
            name="maxLength"
            .value=${this.settings.maxLength}
            @input=${this.handleInputChange}
            min="1"
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
          <label for="topK">Top K:</label>
          <input
            type="number"
            id="topK"
            name="topK"
            .value=${this.settings.topK}
            @input=${this.handleInputChange}
            min="0"
            max="100"
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
          <label for="repetitionPenalty">Repetition Penalty:</label>
          <input
            type="number"
            id="repetitionPenalty"
            name="repetitionPenalty"
            .value=${this.settings.repetitionPenalty}
            @input=${this.handleInputChange}
            min="0.1"
            max="2"
            step="0.1"
          >
        </div>

        <div class="setting-group">
          <label for="minP">Min P:</label>
          <input
            type="number"
            id="minP"
            name="minP"
            .value=${this.settings.minP}
            @input=${this.handleInputChange}
            min="0"
            max="1"
            step="0.01"
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

customElements.define('kobold-settings-widget', KoboldSettingsWidget);

export function register(toolboxMenu) {
  toolboxMenu.addItem('KoboldCPP Settings', [], () => {
    dialog.contentTemplate = () => html`<kobold-settings-widget></kobold-settings-widget>`;
    dialog.title = 'KoboldCPP Settings';
    dialog.open = true;
  });
}