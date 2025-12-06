import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class DummyWidget extends LitElement {
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
  `;

  render() {
    const emojis = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    const random = emojis[Math.floor(Math.random() * emojis.length)];
    return html`<div style="height: 100%; display: flex; align-items: center; justify-content: center; font-size: 2em; color: var(--text-color);">${random}</div>`;
  }
}

customElements.define('dummy-widget', DummyWidget);