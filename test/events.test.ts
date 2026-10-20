import { describe, expect, it, vi } from 'vitest';
import { App } from '../app/src/core/base';
import '../app/src/core/events';

const parse = (src: string) => window.parseHandler(src);

describe('handler parser', () => {
  it('reads calls to App methods and their arguments', () => {
    expect(parse("App.editTx('12', 3, -1.5, true, null)")).toEqual([
      { fn: 'editTx', args: [{ v: '12' }, { v: 3 }, { v: -1.5 }, { v: true }, { v: null }] },
    ]);
    expect(parse('event.stopPropagation(); App.pick(this, this.value, event)')).toEqual([
      { ev: 'stopPropagation' },
      { fn: 'pick', args: [{ path: [] }, { path: ['value'] }, { ev: true }] },
    ]);
  });

  it('keeps escaped quotes inside strings', () => {
    expect(parse("App.go('#/rules?q=it\\'s')")[0].args[0].v).toBe("#/rules?q=it's");
  });

  it('refuses anything that is not a call to an App method', () => {
    for (const src of ['alert(1)', 'window.App.x()', 'App.x(document.cookie)', 'App.x(1 + 1)', 'App.x(); fetch("/")', 'App.x', 'App.x(this.y())', 'event.foo()']) {
      expect(() => parse(src), src).toThrow(/Unsupported handler/);
    }
  });
});

describe('handler binding', () => {
  it('calls the App method when the event fires, with this and its properties', async () => {
    const seen = vi.fn();
    App.testHandler = seen;
    document.body.innerHTML = '<input id="x" value="hello" data-onchange="App.testHandler(this.value, \'tag\', this)">';
    await Promise.resolve();      // the MutationObserver binds new markup
    const input = document.getElementById('x');
    input.dispatchEvent(new Event('change'));
    expect(seen).toHaveBeenCalledWith('hello', 'tag', input);
  });
});
