import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class RowHamburgerButton extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      right: 0px;
      top: 10px;
      height: calc(100%);
      width: 10px;
      z-index: 100;
    }
    .hamburger {
      height: 100%;
      width: 100%;
      cursor: pointer;
      background: var(--dark-accent);
      border: 1px solid var(--border-color);
      border-radius: 0 2px 2px 0;
      font-size: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--light-text);
    }
    .menu {
      position: absolute;
      right: 10px;
      top: 0;
      background: var(--menu-bg);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 5px 0;
      min-width: 160px;
      z-index: 101;
    }
    .menu-item {
      padding: 5px 10px;
      cursor: pointer;
      color: var(--text-color);
    }
    .menu-item:hover {
      background: var(--hover-bg);
    }
  `;

  static properties = {
    rowId: { type: Number },
    isOpen: { type: Boolean }
  };

  constructor() {
    super();
    this.rowId = null;
    this.isOpen = false;
  }

  toggleMenu() {
    this.isOpen = !this.isOpen;
    this.requestUpdate();
  }

  handleAction(action) {
    this.dispatchEvent(new CustomEvent('menu-action', { detail: { action, rowId: this.rowId } }));
    this.isOpen = false;
    this.requestUpdate();
  }

  render() {
    return html`
      <div class="hamburger" @click=${this.toggleMenu}>☰</div>
      ${this.isOpen ? html`
        <div class="menu">
          <div class="menu-item" @click=${() => this.handleAction('add-row-above')}>Add Row Above</div>
          <div class="menu-item" @click=${() => this.handleAction('edit-widgets')}>Edit Widgets</div>
          <div class="menu-item" @click=${() => this.handleAction('remove')}>Remove Row</div>
          <div class="menu-item" @click=${() => this.handleAction('add-row-below')}>Add Row Below</div>
        </div>
      ` : ''}
    `;
  }
}

customElements.define('row-hamburger-button', RowHamburgerButton);