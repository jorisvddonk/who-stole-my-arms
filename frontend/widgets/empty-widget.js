import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class EmptyWidget extends LitElement {
  static styles = css`
    :host {
      display: block;
      height: 100%;
      border: 1px solid var(--border-color);
      background: #a1887f;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
      border-radius: 4px;
    }
  `;

  render() {
    return html`<div style="padding: 20px; text-align: center; color: var(--text-color);">Empty</div>`;
  }
}

customElements.define('empty-widget', EmptyWidget);