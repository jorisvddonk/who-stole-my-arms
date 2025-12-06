import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { sessionManager } from './session-manager.js';

export class TopBar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 30px;
      background: var(--secondary-bg);
      border-bottom: 1px solid var(--border-color);
      padding: 0 10px;
      font-size: 14px;
      color: var(--text-color);
      flex-shrink: 0;
      position: relative;
    }
    .session-info {
      font-weight: bold;
    }
    .hamburger {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      color: var(--text-color);
      padding: 2px;
      border-radius: 2px;
    }
    .hamburger:hover {
      background: var(--hover-bg);
    }
    .menu {
      position: absolute;
      right: 0;
      top: 100%;
      background: var(--menu-bg);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 5px 0;
      min-width: 200px;
      z-index: 1000;
      box-shadow: 0 2px 8px var(--shadow-color);
    }
    .menu-item {
      padding: 8px 12px;
      cursor: pointer;
      color: var(--text-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .menu-item:hover {
      background: var(--hover-bg);
    }
    .menu-item.current {
      background: var(--accent-bg);
      color: var(--light-text);
    }
    .menu-item.current::after {
      content: '✓';
      font-weight: bold;
    }
    .menu-divider {
      height: 1px;
      background: var(--border-color);
      margin: 5px 0;
    }
    .new-session {
      font-style: italic;
      opacity: 0.8;
    }
  `;

  static properties = {
    currentSession: { type: String },
    sessions: { type: Array },
    menuOpen: { type: Boolean }
  };

  constructor() {
    super();
    this.currentSession = sessionManager.getCurrentSession();
    this.sessions = [];
    this.menuOpen = false;
    this.sessionChangeHandler = this.handleSessionChange.bind(this);
    this.initialize();
  }

  async initialize() {
    await sessionManager.initialize();
    this.currentSession = sessionManager.getCurrentSession();
    this.sessions = sessionManager.getSessions();
    this.requestUpdate();
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this.handleClickOutside);
    sessionManager.addSessionChangeListener(this.sessionChangeHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this.handleClickOutside);
    sessionManager.removeSessionChangeListener(this.sessionChangeHandler);
  }

  handleClickOutside(event) {
    if (!this.contains(event.target)) {
      this.closeMenu();
    }
  }

  handleSessionChange(sessionId) {
    this.currentSession = sessionId;
    this.sessions = sessionManager.getSessions();
    this.requestUpdate();
  }

  async switchSession(sessionId) {
    await sessionManager.switchSession(sessionId);
    this.closeMenu();
  }

  async createNewSession() {
    try {
      await sessionManager.createNewSession();
    } catch (error) {
      console.error('Failed to create new session:', error);
    }
  }

  toggleMenu(event) {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
    this.requestUpdate();
  }

  closeMenu() {
    this.menuOpen = false;
    this.requestUpdate();
  }

  async switchSession(sessionId) {
    this.currentSession = sessionId;
    sessionStorage.setItem('currentSession', sessionId);
    this.closeMenu();
    // Dispatch global event for other components to listen
    window.dispatchEvent(new CustomEvent('session-changed', { detail: { sessionId } }));
    this.requestUpdate();
  }

  async createNewSession() {
    try {
      const res = await fetch('/sessions', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        this.sessions.push(data.sessionId);
        await this.switchSession(data.sessionId);
      }
    } catch (error) {
      console.error('Failed to create new session:', error);
    }
  }

  render() {
    return html`
      <div class="session-info">Session: ${this.currentSession}</div>
      <button class="hamburger" @click=${this.toggleMenu}>☰</button>
      ${this.menuOpen ? html`
        <div class="menu">
          ${this.sessions.map(session => html`
            <div
              class="menu-item ${session === this.currentSession ? 'current' : ''}"
              @click=${(e) => { e.stopPropagation(); this.switchSession(session); }}
            >
              ${session}
            </div>
          `)}
          <div class="menu-divider"></div>
          <div class="menu-item new-session" @click=${(e) => { e.stopPropagation(); this.createNewSession(); }}>
            + New Session
          </div>
        </div>
      ` : ''}
    `;
  }
}

customElements.define('top-bar', TopBar);