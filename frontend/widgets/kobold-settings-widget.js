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

    textarea {
      width: 100%;
      padding: 8px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--input-bg);
      color: var(--text-color);
      resize: vertical;
      min-height: 80px;
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
      n: 1,
      maxContextLength: 10240,
      maxLength: 100,
      repetitionPenalty: 1.05,
      temperature: 0.75,
      topP: 0.92,
      topK: 100,
      topA: 0,
      typical: 1,
      tfs: 1,
      repPenRange: 360,
      repPenSlope: 0.7,
      samplerOrder: [6, 0, 1, 3, 4, 2, 5],
      memory: '',
      trimStop: true,
      minP: 0,
      dynatempRange: 0,
      dynatempExponent: 1,
      smoothingFactor: 0,
      nsigma: 0,
      bannedTokens: [],
      renderSpecial: false,
      logprobs: false,
      replaceInstructPlaceholders: true,
      presencePenalty: 0,
      logitBias: {},
      stopSequence: ['{{[INPUT]}}', '{{[OUTPUT]}}'],
      useDefaultBadwordsids: false,
      bypassEos: false
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
    const { name, value, type, checked } = e.target;
    let processedValue = value;

    if (type === 'number') {
      processedValue = parseFloat(value);
    } else if (type === 'checkbox') {
      processedValue = checked;
    } else if (name === 'samplerOrder' || name === 'bannedTokens' || name === 'stopSequence') {
      try {
        processedValue = JSON.parse(value);
      } catch {
        processedValue = value;
      }
    } else if (name === 'logitBias') {
      try {
        processedValue = JSON.parse(value);
      } catch {
        processedValue = {};
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

        <div class="setting-group">
          <label for="n">N:</label>
          <input
            type="number"
            id="n"
            name="n"
            .value=${this.settings.n}
            @input=${this.handleInputChange}
            min="1"
          >
        </div>

        <div class="setting-group">
          <label for="maxContextLength">Max Context Length:</label>
          <input
            type="number"
            id="maxContextLength"
            name="maxContextLength"
            .value=${this.settings.maxContextLength}
            @input=${this.handleInputChange}
            min="1"
          >
        </div>

        <div class="setting-group">
          <label for="topA">Top A:</label>
          <input
            type="number"
            id="topA"
            name="topA"
            .value=${this.settings.topA}
            @input=${this.handleInputChange}
            min="0"
            max="1"
            step="0.01"
          >
        </div>

        <div class="setting-group">
          <label for="typical">Typical:</label>
          <input
            type="number"
            id="typical"
            name="typical"
            .value=${this.settings.typical}
            @input=${this.handleInputChange}
            min="0"
            max="1"
            step="0.01"
          >
        </div>

        <div class="setting-group">
          <label for="tfs">TFS:</label>
          <input
            type="number"
            id="tfs"
            name="tfs"
            .value=${this.settings.tfs}
            @input=${this.handleInputChange}
            min="0"
            max="1"
            step="0.01"
          >
        </div>

        <div class="setting-group">
          <label for="repPenRange">Rep Pen Range:</label>
          <input
            type="number"
            id="repPenRange"
            name="repPenRange"
            .value=${this.settings.repPenRange}
            @input=${this.handleInputChange}
            min="0"
          >
        </div>

        <div class="setting-group">
          <label for="repPenSlope">Rep Pen Slope:</label>
          <input
            type="number"
            id="repPenSlope"
            name="repPenSlope"
            .value=${this.settings.repPenSlope}
            @input=${this.handleInputChange}
            min="0"
            step="0.01"
          >
        </div>

        <div class="setting-group">
          <label for="samplerOrder">Sampler Order (JSON array):</label>
          <input
            type="text"
            id="samplerOrder"
            name="samplerOrder"
            .value=${JSON.stringify(this.settings.samplerOrder)}
            @input=${this.handleInputChange}
          >
        </div>

        <div class="setting-group">
          <label for="memory">Memory:</label>
          <input
            type="text"
            id="memory"
            name="memory"
            .value=${this.settings.memory}
            @input=${this.handleInputChange}
          >
        </div>

        <div class="setting-group">
          <label for="trimStop">Trim Stop:</label>
          <input
            type="checkbox"
            id="trimStop"
            name="trimStop"
            .checked=${this.settings.trimStop}
            @change=${this.handleInputChange}
          >
        </div>

        <div class="setting-group">
          <label for="dynatempRange">DynaTemp Range:</label>
          <input
            type="number"
            id="dynatempRange"
            name="dynatempRange"
            .value=${this.settings.dynatempRange}
            @input=${this.handleInputChange}
            min="0"
            step="0.01"
          >
        </div>

        <div class="setting-group">
          <label for="dynatempExponent">DynaTemp Exponent:</label>
          <input
            type="number"
            id="dynatempExponent"
            name="dynatempExponent"
            .value=${this.settings.dynatempExponent}
            @input=${this.handleInputChange}
            min="0"
            step="0.01"
          >
        </div>

        <div class="setting-group">
          <label for="smoothingFactor">Smoothing Factor:</label>
          <input
            type="number"
            id="smoothingFactor"
            name="smoothingFactor"
            .value=${this.settings.smoothingFactor}
            @input=${this.handleInputChange}
            min="0"
            step="0.01"
          >
        </div>

        <div class="setting-group">
          <label for="nsigma">N Sigma:</label>
          <input
            type="number"
            id="nsigma"
            name="nsigma"
            .value=${this.settings.nsigma}
            @input=${this.handleInputChange}
            min="0"
            step="0.01"
          >
        </div>

        <div class="setting-group">
          <label for="bannedTokens">Banned Tokens (JSON array):</label>
          <input
            type="text"
            id="bannedTokens"
            name="bannedTokens"
            .value=${JSON.stringify(this.settings.bannedTokens)}
            @input=${this.handleInputChange}
          >
        </div>

        <div class="setting-group">
          <label for="renderSpecial">Render Special:</label>
          <input
            type="checkbox"
            id="renderSpecial"
            name="renderSpecial"
            .checked=${this.settings.renderSpecial}
            @change=${this.handleInputChange}
          >
        </div>

        <div class="setting-group">
          <label for="logprobs">Logprobs:</label>
          <input
            type="checkbox"
            id="logprobs"
            name="logprobs"
            .checked=${this.settings.logprobs}
            @change=${this.handleInputChange}
          >
        </div>

        <div class="setting-group">
          <label for="replaceInstructPlaceholders">Replace Instruct Placeholders:</label>
          <input
            type="checkbox"
            id="replaceInstructPlaceholders"
            name="replaceInstructPlaceholders"
            .checked=${this.settings.replaceInstructPlaceholders}
            @change=${this.handleInputChange}
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
            min="0"
            max="2"
            step="0.1"
          >
        </div>

        <div class="setting-group">
          <label for="logitBias">Logit Bias (JSON object):</label>
          <input
            type="text"
            id="logitBias"
            name="logitBias"
            .value=${JSON.stringify(this.settings.logitBias)}
            @input=${this.handleInputChange}
          >
        </div>

        <div class="setting-group">
          <label for="stopSequence">Stop Sequence (JSON array):</label>
          <input
            type="text"
            id="stopSequence"
            name="stopSequence"
            .value=${JSON.stringify(this.settings.stopSequence)}
            @input=${this.handleInputChange}
          >
        </div>

        <div class="setting-group">
          <label for="useDefaultBadwordsids">Use Default Badwordsids:</label>
          <input
            type="checkbox"
            id="useDefaultBadwordsids"
            name="useDefaultBadwordsids"
            .checked=${this.settings.useDefaultBadwordsids}
            @change=${this.handleInputChange}
          >
        </div>

        <div class="setting-group">
          <label for="bypassEos">Bypass EOS:</label>
          <input
            type="checkbox"
            id="bypassEos"
            name="bypassEos"
            .checked=${this.settings.bypassEos}
            @change=${this.handleInputChange}
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