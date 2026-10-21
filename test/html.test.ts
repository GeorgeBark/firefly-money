import { afterEach, describe, expect, it, vi } from 'vitest';
import { Html, html, htmlList, joinHtml, raw } from '../app/src/core/html';

const str = (h: unknown) => String(h);

describe('html', () => {
  afterEach(() => { delete (window as any).MONEY_CHECK_HTML; vi.restoreAllMocks(); });
  it('escapes values', () => {
    expect(str(html`<b title="${'"x" & \'y\''}">${'<img src=x onerror=alert(1)>'}</b>`))
      .toBe('<b title="&quot;x&quot; &amp; &#39;y&#39;">&lt;img src=x onerror=alert(1)&gt;</b>');
  });
  it('keeps nested templates, arrays of them and raw() as markup', () => {
    const name = '<i>';
    expect(str(html`<p>${html`<b>${name}</b>`}${[html`<br>`, 'a&b']}${raw('<hr>')}</p>`)).toBe('<p><b>&lt;i&gt;</b><br>a&amp;b<hr></p>');
  });
  it('drops null, undefined and false but keeps 0', () => {
    expect(str(html`${null}${undefined}${false}${0}`)).toBe('0');
  });
  it('works where a string is expected', () => {
    const d = document.createElement('div'); d.innerHTML = String(html`<span>${'x'}</span>`);
    expect(d.firstElementChild!.textContent).toBe('x');
    expect(`${html`<a>`}`).toBe('<a>');
  });
  it('reports escaped markup and + joins while checking', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    (window as any).MONEY_CHECK_HTML = true;
    ['<b>x</b>', ' data-x="1"', 'Fish & chips'].forEach(v => html`${v}`);
    expect(err).toHaveBeenCalledTimes(2);
    void (html`<b>` + '');
    expect(err.mock.calls[2][0]).toMatch(/^Html joined with \+/);
  });
});

describe('htmlList and joinHtml', () => {
  it('joins items, and an empty list is falsy', () => {
    expect(str(htmlList([html`<li>1</li>`, '<2>']))).toBe('<li>1</li>&lt;2&gt;');
    expect(htmlList([])).toBe('');
    expect(htmlList([]) || 'none').toBe('none');
  });
  it('escapes a plain separator', () => {
    expect(str(joinHtml(['a', html`<b>b</b>`], ' & '))).toBe('a &amp; <b>b</b>');
    expect(joinHtml([], ', ')).toBeInstanceOf(Html);
  });
});
