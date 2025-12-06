import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class CharacterBioDockWidget extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: var(--dock-widget-inset-bg);
      box-shadow: inset 0 2px 4px var(--inset-shadow);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 10px;
      color: var(--text-color);
      font-family: 'Times New Roman', serif;
      min-height: 100%;
      box-sizing: border-box;
    }
    .title {
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 8px;
      color: var(--accent-color);
    }
    .bio {
      font-size: 12px;
      line-height: 1.4;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .empty {
      font-style: italic;
      color: var(--text-color-secondary);
    }
  `;

  static properties = {
    bio: { type: String },
    sessionId: { type: String }
  };

  constructor() {
    super();
    this.bio = '';
    this.sessionId = this.getSessionIdFromUrl();
    this.fetchBio();
    window.addEventListener('character-bio-updated', () => this.fetchBio());
  }

  getSessionIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('sessionId') || 'default';
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

  render() {
    return html`
      <div class="title">Character Bio</div>
      <div class="bio">
        ${this.bio ? this.bio : html`<span class="empty">No bio set</span>`}
      </div>
    `;
  }
}

customElements.define('character-bio-dock-widget', CharacterBioDockWidget);

// Register this widget type with the dock system
export function registerWidgetType(dockWidgetManager) {
  dockWidgetManager.registerWidgetType('character-bio-dock-widget', 'Character Bio');
}