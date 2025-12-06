import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class EmptyWidget extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 100%;
      border: 1px solid var(--border-color);
      background: #a1887f;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
      border-radius: 4px;
      box-sizing: border-box;
    }
    button {
      opacity: 0;
      transition: opacity 0.2s;
      background: none;
      border: none;
      color: var(--text-color);
      font-size: 2em;
      cursor: pointer;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    :host(:hover) button {
      opacity: 1;
    }
  `;

  static properties = {
    rowId: { type: Number }
  };

  render() {
    return html`<button @click=${this.handleClick}>+</button>`;
  }

  handleClick() {
    this.dispatchEvent(new CustomEvent('replace', { detail: { rowId: this.rowId } }));
  }
}

customElements.define('empty-widget', EmptyWidget);