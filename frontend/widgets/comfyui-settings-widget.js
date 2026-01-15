import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import './popup-dialog.js';

const dialog = document.createElement('popup-dialog');
document.body.appendChild(dialog);

export class ComfyUISettingsWidget extends LitElement {
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

    input {
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

    .model-info {
      font-size: 0.8em;
      color: var(--text-color-secondary);
      margin-top: 4px;
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .checkbox-group input[type="checkbox"] {
      width: auto;
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
      host: 'localhost',
      port: 8188,
      workflowPath: './config/comfyui-workflow.json',
      outputFolder: '',
      debugBypass: false
    };
    this.status = '';
    this.statusType = '';
    this.loadSettings();
  }

  async loadSettings() {
    try {
      const res = await fetch('/comfyui/settings');
      if (res.ok) {
        this.settings = await res.json();
      }
    } catch (error) {
      this.showStatus('Failed to load settings: ' + error.message, 'error');
    }
  }

  async saveSettings() {
    try {
      const res = await fetch('/comfyui/settings', {
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
          <label for="host">ComfyUI Host:</label>
          <input
            type="text"
            id="host"
            name="host"
            .value=${this.settings.host}
            @input=${this.handleInputChange}
            placeholder="localhost"
          >
        </div>

        <div class="setting-group">
          <label for="port">ComfyUI Port:</label>
          <input
            type="number"
            id="port"
            name="port"
            .value=${this.settings.port}
            @input=${this.handleInputChange}
            min="1"
            max="65535"
          >
        </div>

        <div class="setting-group">
          <label for="workflowPath">Default Workflow Path:</label>
          <input
            type="text"
            id="workflowPath"
            name="workflowPath"
            .value=${this.settings.workflowPath}
            @input=${this.handleInputChange}
            placeholder="./config/comfyui-workflow.json"
          >
          <div class="model-info">Path to default ComfyUI workflow JSON file</div>
        </div>

        <div class="setting-group">
          <label for="outputFolder">ComfyUI Output Folder:</label>
          <input
            type="text"
            id="outputFolder"
            name="outputFolder"
            .value=${this.settings.outputFolder}
            @input=${this.handleInputChange}
            placeholder="~/ComfyUI/output"
          >
          <div class="model-info">Path to ComfyUI output directory where generated images are saved</div>
        </div>

        <div class="setting-group">
          <label class="checkbox-group">
            <input
              type="checkbox"
              id="debugBypass"
              name="debugBypass"
              .checked=${this.settings.debugBypass}
              @change=${this.handleInputChange}
            >
            Debug Bypass
          </label>
          <div class="model-info">Skip actual ComfyUI calls for testing</div>
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

customElements.define('comfyui-settings-widget', ComfyUISettingsWidget);

export function register(toolboxMenu) {
  toolboxMenu.addItem('ComfyUI Settings', [], () => {
    dialog.contentTemplate = () => html`<comfyui-settings-widget></comfyui-settings-widget>`;
    dialog.title = 'ComfyUI Settings';
    dialog.open = true;
  });
}
