import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import './popup-dialog.js';

const dialog = document.createElement('popup-dialog');
document.body.appendChild(dialog);

export class CharacterBioToolWidget extends LitElement {
  static styles = css`
    .container {
      display: flex;
      flex-direction: column;
      gap: 10px;
      color: var(--text-color);
      font-family: 'Times New Roman', serif;
    }
    .title {
      font-weight: bold;
      font-size: 16px;
      color: var(--accent-color);
    }
    textarea {
      width: 100%;
      min-height: 200px;
      padding: 8px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--input-bg);
      color: var(--text-color);
      font-family: inherit;
      font-size: 12px;
      resize: vertical;
    }
    .buttons {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    button {
      padding: 6px 12px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--button-bg);
      color: var(--text-color);
      cursor: pointer;
      font-size: 12px;
    }
    button:hover {
      background: var(--button-hover-bg);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  static properties = {
    bio: { type: String },
    sessionId: { type: String },
    isSaving: { type: Boolean }
  };

  constructor() {
    super();
    this.bio = '';
    this.sessionId = this.getSessionIdFromUrl();
    this.isSaving = false;
  }

  getSessionIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('sessionId') || 'default';
  }

  async connectedCallback() {
    super.connectedCallback();
    await this.fetchBio();
  }

  async fetchBio() {
    try {
      const response = await fetch(`/sessions/${this.sessionId}/widgets/character-bio`);
      const data = await response.json();
      this.bio = data.bio || '';
    } catch (error) {
      console.error('Failed to fetch character bio:', error);
      this.bio = '';
    }
  }

  async saveBio() {
    this.isSaving = true;
    try {
      const response = await fetch(`/sessions/${this.sessionId}/widgets/character-bio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: this.bio })
      });
      if (response.ok) {
        // Notify the dock widget to refresh
        window.dispatchEvent(new CustomEvent('character-bio-updated'));
        dialog.open = false;
      } else {
        console.error('Failed to save bio');
      }
    } catch (error) {
      console.error('Failed to save bio:', error);
    } finally {
      this.isSaving = false;
    }
  }

  render() {
    return html`
      <div class="container">
        <div class="title">Edit Character Bio</div>
        <textarea
          .value=${this.bio}
          @input=${(e) => this.bio = e.target.value}
          placeholder="Enter your character's biography here..."
        ></textarea>
        <div class="buttons">
          <button @click=${() => dialog.open = false} ?disabled=${this.isSaving}>Cancel</button>
          <button @click=${this.saveBio} ?disabled=${this.isSaving}>
            ${this.isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    `;
  }
}

customElements.define('character-bio-tool-widget', CharacterBioToolWidget);

export function register(toolboxMenu) {
  toolboxMenu.addItem('Character Bio', [], () => {
    dialog.contentTemplate = () => html`<character-bio-tool-widget></character-bio-tool-widget>`;
    dialog.open = true;
  });
}