import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class AutoScrollSettingsWidget extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 20px;
      background: var(--primary-bg);
      color: var(--text-color);
      border-radius: 8px;
      max-width: 400px;
    }
    label {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
    }
    input[type="checkbox"] {
      width: 16px;
      height: 16px;
    }
  `;

  static properties = {
    enabled: { type: Boolean }
  };

  constructor() {
    super();
    this.enabled = (typeof window !== 'undefined' && window.sessionStorage) ? window.sessionStorage.getItem('chatAutoScroll') !== 'false' : true;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem('chatAutoScroll', this.enabled.toString());
    }
  }

  render() {
    return html`
      <div>
        <label>
          <input type="checkbox" .checked=${this.enabled} @change=${this.toggle} />
          Auto-scroll chat to bottom during prompts
        </label>
      </div>
    `;
  }
}

customElements.define('auto-scroll-settings-widget', AutoScrollSettingsWidget);

export function register(toolboxMenu) {
  toolboxMenu.addItem('Auto-Scroll Settings', [], () => {
    const dialog = document.createElement('popup-dialog');
    dialog.title = 'Auto-Scroll Settings';
    dialog.contentTemplate = () => html`<auto-scroll-settings-widget></auto-scroll-settings-widget>`;
    document.body.appendChild(dialog);
    dialog.open = true;
  });
}