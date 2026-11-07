// Snippet Paster content script: shows the snippet menu and inserts the chosen
// snippet at the caret position that was active before the menu opened.
(() => {
  if (window.__snippetPasterLoaded) return;
  window.__snippetPasterLoaded = true;

  let menu = null;   // currently open menu, if any
  let saved = null;  // where the caret was before the menu opened

  // ---------- Trusted Types (Gmail and others enforce it) ----------
  let ttPolicy = null;
  try {
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
      ttPolicy = window.trustedTypes.createPolicy('snippet-paster', { createHTML: (s) => s });
    }
  } catch (_) { /* policy name not allowed by the page; fall back to other methods */ }
  const trusted = (html) => (ttPolicy ? ttPolicy.createHTML(html) : html);

  // ---------- Helpers ----------
  function deepActiveElement() {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a;
  }

  const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'email', 'url', 'tel', 'password']);
  function isTextField(el) {
    if (!el) return false;
    if (el.tagName === 'TEXTAREA') return !el.readOnly && !el.disabled;
    if (el.tagName === 'INPUT') {
      return TEXT_INPUT_TYPES.has((el.getAttribute('type') || '').toLowerCase()) && !el.readOnly && !el.disabled;
    }
    return false;
  }

  // Parse snippet HTML in an inert document (no scripts run, no Trusted Types sink).
  function parseSnippet(html) {
    const doc = document.implementation.createHTMLDocument('');
    doc.body.innerHTML = html;
    doc.body.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((n) => n.remove());
    doc.body.querySelectorAll('*').forEach((n) => {
      for (const attr of [...n.attributes]) {
        if (/^on/i.test(attr.name) || /^\s*javascript:/i.test(attr.value)) n.removeAttribute(attr.name);
      }
    });
    return doc.body;
  }

  const BLOCK = /^(P|DIV|LI|H[1-6]|BLOCKQUOTE|PRE|TR|UL|OL)$/;
  function htmlToText(body) {
    let out = '';
    (function walk(node) {
      for (const n of node.childNodes) {
        if (n.nodeType === Node.TEXT_NODE) out += n.data.replace(/\s+/g, ' ');
        else if (n.nodeName === 'BR') out += '\n';
        else if (n.nodeType === Node.ELEMENT_NODE) {
          if (n.nodeName === 'LI') out += '• ';
          walk(n);
          if (BLOCK.test(n.nodeName) && !out.endsWith('\n')) out += '\n';
        }
      }
    })(body);
    return out.replace(/\n+$/, '');
  }

  // ---------- Save / restore caret ----------
  function captureCaret() {
    const el = deepActiveElement();
    const state = { el, kind: 'none', start: 0, end: 0, range: null };
    if (isTextField(el)) {
      state.kind = 'field';
      state.start = el.selectionStart ?? el.value.length;
      state.end = el.selectionEnd ?? el.value.length;
    } else if (el && el.isContentEditable) {
      state.kind = 'editable';
      const sel = window.getSelection();
      if (sel && sel.rangeCount) state.range = sel.getRangeAt(0).cloneRange();
    }
    return state;
  }

  function restoreCaret(s) {
    if (!s || !s.el || !s.el.isConnected) return false;
    try { s.el.focus({ preventScroll: true }); } catch (_) {}
    if (s.kind === 'field') {
      try { s.el.setSelectionRange(s.start, s.end); } catch (_) {}
    } else if (s.kind === 'editable' && s.range) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(s.range);
    }
    return true;
  }

  function caretRect(s) {
    if (s && s.kind === 'editable' && s.range) {
      const r = s.range.getClientRects()[0] || s.range.getBoundingClientRect();
      if (r && (r.width || r.height)) return r;
    }
    if (s && s.el && s.el.getBoundingClientRect && s.el !== document.body) {
      const r = s.el.getBoundingClientRect();
      if (r.width || r.height) return { left: r.left, top: r.top, bottom: Math.min(r.bottom, r.top + 40) };
    }
    return null;
  }

  // ---------- Insertion ----------
  function insertIntoField(el, text, s) {
    // execCommand keeps the browser's undo stack and fires native input events.
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (_) {}
    if (!ok) {
      el.setRangeText(text, s.start, s.end, 'end');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
  }

  function insertIntoEditable(el, html, text, s) {
    // 1) Synthetic paste: rich editors (Gmail, Google Docs comments, Slack,
    //    ProseMirror, Draft.js, Lexical...) read clipboardData themselves.
    try {
      const dt = new DataTransfer();
      dt.setData('text/html', html);
      dt.setData('text/plain', text);
      const target = (s.range && s.range.startContainer.nodeType === 1
        ? s.range.startContainer
        : s.range && s.range.startContainer.parentElement) || el;
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true, composed: true });
      target.dispatchEvent(ev);
      if (ev.defaultPrevented) return 'paste';
    } catch (_) {}

    // 2) execCommand insertHTML: works for plain contenteditable areas, keeps undo.
    try {
      if (document.execCommand('insertHTML', false, trusted(html))) return 'insertHTML';
    } catch (_) {}

    // 3) Manual DOM insertion.
    const sel = window.getSelection();
    const range = sel.rangeCount ? sel.getRangeAt(0) : null;
    if (!range) return null;
    range.deleteContents();
    const frag = document.createDocumentFragment();
    for (const n of parseSnippet(html).childNodes) frag.appendChild(document.importNode(n, true));
    const last = frag.lastChild;
    range.insertNode(frag);
    if (last) {
      range.setStartAfter(last);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
    return 'dom';
  }

  async function copyToClipboard(html, text) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })
      ]);
      return true;
    } catch (_) {
      try { await navigator.clipboard.writeText(text); return true; } catch (_) { return false; }
    }
  }

  async function insertSnippet(snippet) {
    const s = saved;
    const body = parseSnippet(snippet.html || '');
    const html = body.innerHTML;
    const text = htmlToText(body);

    if (!restoreCaret(s) || s.kind === 'none') {
      const ok = await copyToClipboard(html, text);
      toast(ok ? 'No text box was focused. Snippet copied, press Ctrl+V to paste.' : 'No text box was focused.');
      return;
    }
    if (s.kind === 'field') insertIntoField(s.el, text, s);
    else insertIntoEditable(s.el, html, text, s);
  }

  // ---------- UI ----------
  const STYLE = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .backdrop { position: fixed; inset: 0; z-index: 2147483646; background: transparent; }
    .panel {
      position: fixed; z-index: 2147483647; width: 360px; max-width: calc(100vw - 16px);
      background: #fff; color: #1f1f1f; border: 1px solid #d0d4da; border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,.18); overflow: hidden;
      font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    input {
      width: 100%; border: 0; border-bottom: 1px solid #e3e6ea; padding: 10px 12px;
      font: inherit; outline: none; background: transparent; color: inherit;
    }
    ul { list-style: none; margin: 0; padding: 4px; max-height: 320px; overflow-y: auto; }
    li { padding: 8px 10px; border-radius: 6px; cursor: pointer; }
    li.active { background: #e8f0fe; }
    .title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .preview { color: #5f6368; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .empty { padding: 12px; color: #5f6368; }
    .footer {
      display: flex; justify-content: space-between; align-items: center;
      padding: 6px 12px; border-top: 1px solid #e3e6ea; font-size: 11px; color: #5f6368;
    }
    .footer button { all: unset; cursor: pointer; color: #1a73e8; font-size: 11px; }
    .toast {
      position: fixed; z-index: 2147483647; left: 50%; bottom: 24px; transform: translateX(-50%);
      background: #323232; color: #fff; padding: 10px 16px; border-radius: 6px;
      font: 13px/1.4 system-ui, sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,.3);
    }
    @media (prefers-color-scheme: dark) {
      .panel { background: #2b2c2f; color: #e8eaed; border-color: #44474c; }
      input, .footer { border-color: #44474c; }
      li.active { background: #394457; }
      .preview, .empty, .footer { color: #9aa0a6; }
      .footer button { color: #8ab4f8; }
    }
  `;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function mountHost() {
    const host = document.createElement('snippet-paster-root');
    const root = host.attachShadow({ mode: 'closed' });
    const style = el('style');
    style.textContent = STYLE;
    root.appendChild(style);
    (document.body || document.documentElement).appendChild(host);
    // Keep the page's own keyboard shortcuts (e.g. Gmail's) from reacting
    // to keys typed into the menu.
    for (const type of ['keydown', 'keyup', 'keypress', 'input', 'paste', 'copy', 'cut']) {
      host.addEventListener(type, (e) => e.stopPropagation());
    }
    return { host, root };
  }

  function toast(message) {
    const { host, root } = mountHost();
    root.appendChild(el('div', 'toast', message));
    setTimeout(() => host.remove(), 3500);
  }

  function closeMenu(restore) {
    if (!menu) return;
    menu.host.remove();
    menu = null;
    if (restore) restoreCaret(saved);
  }

  async function openMenu() {
    if (menu) { closeMenu(true); return; }
    saved = captureCaret();

    const { snippets = [] } = await chrome.storage.local.get('snippets');
    const { host, root } = mountHost();

    const backdrop = el('div', 'backdrop');
    const panel = el('div', 'panel');
    const search = el('input');
    search.placeholder = 'Search snippets…';
    search.setAttribute('aria-label', 'Search snippets');
    const list = el('ul');
    list.setAttribute('role', 'listbox');
    const footer = el('div', 'footer');
    footer.appendChild(el('span', null, '↑↓ to move · Enter to paste · Esc to close'));
    const manage = el('button', null, 'Manage');
    footer.appendChild(manage);
    panel.append(search, list, footer);
    root.append(backdrop, panel);

    // Position near the caret, clamped to the viewport.
    const r = caretRect(saved);
    const W = Math.min(360, window.innerWidth - 16);
    if (r) {
      let left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8));
      let top = r.bottom + 6;
      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
      requestAnimationFrame(() => {
        const h = panel.offsetHeight;
        if (top + h > window.innerHeight - 8) {
          top = Math.max(8, r.top - h - 6);
          panel.style.top = top + 'px';
        }
      });
    } else {
      panel.style.left = Math.max(8, (window.innerWidth - W) / 2) + 'px';
      panel.style.top = Math.max(8, window.innerHeight * 0.2) + 'px';
    }

    let filtered = snippets;
    let active = 0;

    const previews = new Map();
    const previewOf = (sn) => {
      if (!previews.has(sn)) previews.set(sn, htmlToText(parseSnippet(sn.html || '')).replace(/\s+/g, ' '));
      return previews.get(sn);
    };

    function render() {
      list.textContent = '';
      if (!filtered.length) {
        list.appendChild(el('div', 'empty', snippets.length ? 'No matches.' : 'No snippets yet. Click Manage to add some.'));
        return;
      }
      filtered.forEach((sn, i) => {
        const li = el('li', i === active ? 'active' : '');
        li.setAttribute('role', 'option');
        li.appendChild(el('div', 'title', sn.title || '(untitled)'));
        li.appendChild(el('div', 'preview', previewOf(sn)));
        li.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in search
        li.addEventListener('mousemove', () => { if (active !== i) { active = i; render(); } });
        li.addEventListener('click', () => choose(i));
        list.appendChild(li);
      });
      const act = list.children[active];
      if (act) act.scrollIntoView({ block: 'nearest' });
    }

    function choose(i) {
      const sn = filtered[i];
      if (!sn) return;
      closeMenu(false);
      insertSnippet(sn);
    }

    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      filtered = !q ? snippets : snippets.filter((sn) =>
        (sn.title || '').toLowerCase().includes(q) || previewOf(sn).toLowerCase().includes(q));
      active = 0;
      render();
    });

    search.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, filtered.length - 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
      else if (e.key === 'Tab') { e.preventDefault(); }
    });

    backdrop.addEventListener('mousedown', (e) => { e.preventDefault(); closeMenu(true); });
    manage.addEventListener('click', () => {
      closeMenu(true);
      chrome.runtime.sendMessage({ type: 'open-options' });
    });

    menu = { host };
    render();
    search.focus({ preventScroll: true });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== 'open-snippet-menu') return;
    // Only the frame that actually holds keyboard focus opens the menu.
    if (!document.hasFocus()) return;
    const a = document.activeElement;
    if (a && (a.tagName === 'IFRAME' || a.tagName === 'FRAME')) return;
    openMenu();
  });
})();
