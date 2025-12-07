import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import './popup-dialog.js';
import { sessionManager } from './session-manager.js';

const dialog = document.createElement('popup-dialog');
document.body.appendChild(dialog);

export class FormatterSettingsWidget extends LitElement {
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

    select {
      padding: 8px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--input-bg);
      color: var(--text-color);
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

    .formatter-info {
      background: var(--secondary-bg);
      padding: 10px;
      border-radius: 4px;
      border: 1px solid var(--border-color);
      font-family: monospace;
      font-size: 0.8em;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 200px;
      overflow-y: auto;
    }
  `;

  static properties = {
    settings: { type: Object },
    formatters: { type: Array },
    status: { type: String },
    statusType: { type: String }
  };

  constructor() {
    super();
    this.settings = {
      selectedFormatter: 'chatHistoryMessageFormatter_Basic'
    };
    this.formatters = [];
    this.status = '';
    this.statusType = '';
    this.loadSettings();
    this.loadFormatters();
  }

  async loadSettings() {
    try {
      const sessionId = sessionManager.getCurrentSession();
      const res = await fetch(`/sessions/${sessionId}/formatter/settings`);
      if (res.ok) {
        this.settings = await res.json();
      }
    } catch (error) {
      this.showStatus('Failed to load settings: ' + error.message, 'error');
    }
  }

  async loadFormatters() {
    try {
      const res = await fetch('/formatters/list');
      if (res.ok) {
        const data = await res.json();
        this.formatters = data.formatters;
      }
    } catch (error) {
      this.showStatus('Failed to load formatters: ' + error.message, 'error');
    }
  }

  async saveSettings() {
    try {
      const sessionId = sessionManager.getCurrentSession();
      const res = await fetch(`/sessions/${sessionId}/formatter/settings`, {
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
    const { name, value } = e.target;
    this.settings = {
      ...this.settings,
      [name]: value
    };
  }

  handleSave() {
    this.saveSettings();
  }

  handleCancel() {
    dialog.open = false;
  }

  getSelectedFormatterInfo() {
    const selected = this.formatters.find(f => f.name === this.settings.selectedFormatter);
    if (!selected) return 'No formatter selected';
    return Object.entries(selected.functions).map(([funcName, code]) => `${funcName}:\n${code}`).join('\n\n');
  }

  render() {
    return html`
      <div class="settings-form">

        <div class="setting-group">
          <label for="selectedFormatter">Selected Formatter:</label>
          <select
            id="selectedFormatter"
            name="selectedFormatter"
            .value=${this.settings.selectedFormatter}
            @change=${this.handleInputChange}
          >
            ${this.formatters.map(formatter => html`
              <option value=${formatter.name} ?selected=${formatter.name === this.settings.selectedFormatter}>
                ${formatter.name}
              </option>
            `)}
          </select>
        </div>

        <div class="setting-group">
          <label>Formatter Functions:</label>
          <div class="formatter-info">${this.getSelectedFormatterInfo()}</div>
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

customElements.define('formatter-settings-widget', FormatterSettingsWidget);

export function register(toolboxMenu) {
  toolboxMenu.addItem('Formatter Settings', [], () => {
    dialog.contentTemplate = () => html`<formatter-settings-widget></formatter-settings-widget>`;
    dialog.title = 'Formatter Settings';
    dialog.open = true;
  });
}