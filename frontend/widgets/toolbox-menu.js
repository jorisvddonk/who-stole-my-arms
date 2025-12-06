console.log('Toolbox menu module loaded');

import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class ToolboxMenu extends LitElement {
  static styles = css`
    .toolbox.floating {
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 1000;
    }
    .toolbox.inline {
      position: relative;
    }
    button {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #5d4037;
      color: #f4f1e8;
      border: none;
      font-size: 24px;
      cursor: pointer;
    }
    button:hover {
      background: #3e2723;
    }
    .menu {
      background: #bcaaa4;
      border: 1px solid #8d6e63;
      border-radius: 4px;
      padding: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      position: absolute;
      bottom: 60px;
      left: 0;
      z-index: 1001;
      min-width: 200px;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    li {
      position: relative;
      padding: 5px 10px;
      cursor: pointer;
      color: #3e2723;
    }
    li:hover {
      background: #a1887f;
    }
    .submenu {
      position: absolute;
      left: 100%;
      top: 0;
      background: #bcaaa4;
      border: 1px solid #8d6e63;
      border-radius: 4px;
      padding: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      min-width: 200px;
    }
  `;

  static properties = {
    menuItems: { type: Array },
    isOpen: { type: Boolean },
    floating: { type: Boolean }
  };

  constructor() {
    super();
    this.menuItems = [];
    this.isOpen = false;
    this.floating = true;
  }

  connectedCallback() {
    super.connectedCallback();
    console.log('Toolbox connected');
    window.toolboxMenu = this;
    this.loadTools();
  }

  async loadTools() {
    console.log('Loading tools...');
    try {
      const res = await fetch('/toolbox/list');
      const data = await res.json();
      console.log('Tools data:', data);
      for (const url of data.tools) {
        console.log('Importing:', url);
        const mod = await import(url);
        if (mod.register) mod.register(this);
      }
    } catch (error) {
      console.error('Failed to load tools:', error);
    }
  }

  addItem(label, children = [], onClick = null) {
    console.log('Adding item:', label);
    this.menuItems.push({ label, children, onClick });
    this.requestUpdate();
  }

  render() {
    return html`
      <div class="toolbox ${this.floating ? 'floating' : 'inline'}">
        <button @click=${this.toggleMenu}>🔧</button>
        ${this.isOpen ? html`<div class="menu">${this.renderMenu(this.menuItems)}</div>` : ''}
      </div>
    `;
  }

  toggleMenu() {
    this.isOpen = !this.isOpen;
  }

  renderMenu(items) {
    if (items.length === 0) return html`<div>No tools available</div>`;
    return html`
      <ul>
        ${items.map(item => html`
          <li @mouseenter=${() => this.handleMouseEnter(item)} @mouseleave=${() => this.handleMouseLeave(item)} @click=${() => item.onClick && item.onClick()}>
            ${item.label}
            ${item.children && item.children.length > 0 ? html`<span>▶</span>` : ''}
            ${item.isOpen ? html`<ul class="submenu">${this.renderMenu(item.children)}</ul>` : ''}
          </li>
        `)}
      </ul>
    `;
  }

  handleMouseEnter(item) {
    if (item.children && item.children.length > 0) {
      item.isOpen = true;
      this.requestUpdate();
    }
  }

  handleMouseLeave(item) {
    item.isOpen = false;
    this.requestUpdate();
  }

  updated() {
    // Adjust submenu positions to stay on screen
    const submenus = this.shadowRoot.querySelectorAll('.submenu');
    submenus.forEach(sub => {
      const rect = sub.getBoundingClientRect();
      if (rect.bottom > window.innerHeight) {
        sub.style.top = `${-rect.height}px`;
      } else {
        sub.style.top = '0px'; // reset if not needed
      }
      if (rect.right > window.innerWidth) {
        sub.style.left = `${-rect.width}px`;
      } else {
        sub.style.left = '100%'; // reset
      }
    });
  }
}

customElements.define('toolbox-menu', ToolboxMenu);