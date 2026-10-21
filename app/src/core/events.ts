export {};
/* ================= Event handlers without inline script =================
   The Content-Security-Policy refuses inline script, so markup carries its handlers as
   data-onclick="App.editTx('12')" (and data-onchange, data-onsubmit, …) instead of onclick=.
   This file attaches a real listener to every element that has one, including ones added
   later through innerHTML. A handler is never evaluated as JavaScript: it is read as a short
   list of calls to App methods, so injected markup can't run code of its own.

   Grammar:  statement (';' statement)*
   statement: event.preventDefault() | event.stopPropagation() | App.name(arg, …)
   arg:       'string' | number | true | false | null | event | this | this.prop.prop… */
type Arg = { v: string | number | boolean | null } | { ev: true } | { path: string[] };
type Statement = { ev: 'preventDefault' | 'stopPropagation' } | { fn: string, args: Arg[] };
(function () {
  const TYPES = ['click', 'change', 'input', 'keydown', 'submit', 'mousedown', 'mouseenter', 'mousemove'];
  const ATTRS = TYPES.map(t => 'data-on' + t), SEL = ATTRS.map(a => '[' + a + ']').join(',');
  const parsed = new Map<string, Statement[]>(), bound = new WeakMap<Element, Set<string>>();

  function parse(src: string): Statement[] {
    let i = 0;
    const fail: () => never = () => { throw new Error('Unsupported handler: ' + src); };
    const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
    const ident = () => { ws(); const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i)); if (!m) fail(); i += m[0].length; return m[0]; };
    const eat = (c: string) => { ws(); if (src[i] !== c) fail(); i++; };
    const peek = () => { ws(); return src[i]; };
    function arg(): Arg {
      const c = peek();
      if (c === "'" || c === '"') {
        let s = ''; i++;
        while (i < src.length && src[i] !== c) { if (src[i] === '\\') i++; s += src[i++]; }
        eat(c); return { v: s };
      }
      const n = /^-?\d+(\.\d+)?/.exec(src.slice(i));
      if (n) { i += n[0].length; return { v: Number(n[0]) }; }
      const w = ident();
      if (w === 'true' || w === 'false') return { v: w === 'true' };
      if (w === 'null') return { v: null };
      if (w === 'event') return { ev: true };
      if (w !== 'this') fail();
      const path: string[] = [];
      while (peek() === '.') { i++; path.push(ident()); }
      return { path };
    }
    const out: Statement[] = [];
    while (true) {
      const obj = ident(); eat('.'); const name = ident(); eat('(');
      const args: Arg[] = [];
      if (peek() !== ')') { args.push(arg()); while (peek() === ',') { i++; args.push(arg()); } }
      eat(')');
      if (obj === 'event' && (name === 'preventDefault' || name === 'stopPropagation') && !args.length) out.push({ ev: name });
      else if (obj === 'App') out.push({ fn: name, args });
      else fail();
      ws(); if (i >= src.length) break;
      eat(';'); ws(); if (i >= src.length) break;
    }
    return out;
  }

  function run(src: string, node: Element, e: Event) {
    let prog = parsed.get(src);
    if (!prog) { prog = parse(src); parsed.set(src, prog); }
    for (const s of prog) {
      if ('ev' in s) { e[s.ev](); continue; }
      const f = window.App && Object.prototype.hasOwnProperty.call(window.App, s.fn) && window.App[s.fn];
      if (typeof f !== 'function') throw new Error('No App.' + s.fn + ' for handler: ' + src);
      f.apply(window.App, s.args.map(a => 'ev' in a ? e : 'path' in a ? a.path.reduce<any>((o, k) => o[k], node) : a.v));
    }
  }

  function bind(node: Element) {
    let set = bound.get(node);
    for (const t of TYPES) {
      if (!node.hasAttribute('data-on' + t) || (set && set.has(t))) continue;
      if (!set) bound.set(node, set = new Set());
      set.add(t);
      // read the attribute when the event fires, so removing or changing it later takes effect
      node.addEventListener(t, function (this: Element, e) { const src = this.getAttribute('data-on' + t); if (src) run(src, this, e); });
    }
  }
  function scan(node: Node) {
    if (node.nodeType !== 1) return;
    const root = node as Element;
    if (root.matches(SEL)) bind(root);
    root.querySelectorAll(SEL).forEach(bind);
  }

  window.parseHandler = parse;     // for the smoke test, which checks every handler in the source
  scan(document.documentElement);
  new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'attributes') bind(m.target as Element);
      else m.addedNodes.forEach(scan);
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ATTRS });
})();
