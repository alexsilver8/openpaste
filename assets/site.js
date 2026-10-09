/*
 * OpenPaste site: the interactive layer.
 * The page works without it; this script turns the static design into a small, working
 * version of the app: a shelf that remembers what you copy here, search with filters,
 * a ⇧⌘V / Ctrl+Shift+V overlay, and privacy controls that actually do something.
 */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- platform
  const ua = navigator.userAgent || '';
  const platform = ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '').toLowerCase();
  const mobile = /android|iphone|ipad|ipod/i.test(ua);
  const os = mobile
    ? null
    : /mac/.test(platform) || /Macintosh/.test(ua)
      ? 'mac'
      : /win/.test(platform) || /Windows/.test(ua)
        ? 'win'
        : /linux|x11/.test(platform) || /Linux/.test(ua)
          ? 'linux'
          : null;
  const isMac = /mac|iphone|ipad|ipod/i.test(platform + ' ' + ua);
  const SHORTCUT = isMac ? '⇧⌘V' : 'Ctrl+Shift+V';
  if (!isMac) {
    $$('.shortcut').forEach((el) => (el.textContent = SHORTCUT));
    $$('.mod').forEach((el) => (el.textContent = 'Ctrl+'));
  }

  // ---------------------------------------------------------------- helpers
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function highlight(text, words) {
    text = String(text);
    if (!words || !words.length) return esc(text);
    const re = new RegExp('(' + words.map(reEsc).join('|') + ')', 'ig');
    return text
      .split(re)
      .map((part, i) => (i % 2 ? '<mark>' + esc(part) + '</mark>' : esc(part)))
      .join('');
  }

  const MIN = 60 * 1000;
  const HR = 60 * MIN;
  const DAY = 24 * HR;
  function ago(t) {
    const d = Date.now() - t;
    if (d < 45 * 1000) return 'just now';
    if (d < HR) return Math.max(1, Math.round(d / MIN)) + ' min ago';
    if (d < DAY) {
      const h = Math.round(d / HR);
      return h + (h === 1 ? ' hr ago' : ' hrs ago');
    }
    if (d < 2 * DAY) return 'yesterday';
    return Math.round(d / DAY) + ' days ago';
  }

  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function cssColorToHex(value) {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value || '');
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  function inkOn(hex) {
    const c = hexToRgb(hex);
    if (!c) return '#ffffff';
    const lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
    return lum > 0.6 ? '#18181b' : '#ffffff';
  }

  // ---------------------------------------------------------------- toast
  const toastEl = document.createElement('div');
  toastEl.className = 'op-toast';
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastEl);
  let toastTimer = 0;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  // ---------------------------------------------------------------- clipboard
  let suppressCapture = false;
  async function writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      suppressCapture = true;
      try {
        ok = document.execCommand('copy');
      } catch (_) {
        ok = false;
      }
      suppressCapture = false;
      ta.remove();
      return ok;
    }
  }

  // ---------------------------------------------------------------- the clipboard history
  const now = Date.now();
  const store = {
    items: [
      { kind: 'link', url: 'https://docs.github.com/en/pages/quickstart', app: 'Slack', t: now - 2 * MIN },
      { kind: 'text', text: "Can we move the design review to Thursday at 14:00? I'll bring the new onboarding flow.", app: 'Slack', t: now - 4 * MIN },
      { kind: 'code', text: 'export function debounce(fn, ms) {\n  let timer\n  return (...args) => {\n    clearTimeout(timer)\n    timer = setTimeout(\n      () => fn(...args), ms)\n  }\n}', app: 'VS Code', t: now - 14 * MIN },
      { kind: 'color', hex: '#5B4CF5', app: 'Figma', t: now - 22 * MIN, boards: ['brand'] },
      { kind: 'image', name: 'Q3 signups.png', meta: '1280 × 800 image', app: 'Screenshot', t: now - 35 * MIN, bars: [30, 46, 40, 64, 58, 82, 94] },
      { kind: 'link', url: 'https://vitest.dev/guide/mocking', app: 'Chrome', t: now - 62 * MIN },
      { kind: 'text', text: 'Thanks for the report! This is fixed in the next release. Could you give it another try then?', app: 'Mail', t: now - 2 * HR, boards: ['replies'] },
      { kind: 'code', text: 'pnpm install && pnpm dev', app: 'Terminal', t: now - 3 * HR, boards: ['snippets'] },
      { kind: 'color', hex: '#C8245F', app: 'Figma', t: now - 4 * HR, boards: ['brand'] },
      { kind: 'file', name: 'brand-guidelines.pdf', meta: 'PDF document', app: 'Finder', t: now - 5 * HR, boards: ['brand'] },
      { kind: 'link', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API', app: 'Chrome', t: now - 6 * HR },
      { kind: 'code', text: '.card {\n  border-radius: 12px;\n  box-shadow: 0 1px 2px rgb(0 0 0 / 8%);\n}', app: 'VS Code', t: now - 8 * HR, boards: ['snippets'] },
      { kind: 'color', hex: '#0B7F8C', app: 'Figma', t: now - 9 * HR, boards: ['brand'] },
      { kind: 'text', text: "Happy to help! Here's the guide that walks through the setup step by step.", app: 'Slack', t: now - 20 * HR, boards: ['replies'] },
      { kind: 'link', url: 'https://www.electronjs.org/docs/latest/api/clipboard', app: 'Notes', t: now - 26 * HR },
      { kind: 'image', name: 'onboarding-flow.png', meta: '1440 × 900 image', app: 'Figma', t: now - 28 * HR, bars: [70, 52, 80, 44, 62, 36, 58] },
      { kind: 'code', text: 'git switch -c feat/paste-stacks', app: 'Terminal', t: now - 30 * HR, boards: ['snippets'] },
      { kind: 'file', name: 'invoice-october.pdf', meta: 'PDF document', app: 'Finder', t: now - 2 * DAY },
      { kind: 'color', hex: '#F5B642', app: 'Figma', t: now - 2 * DAY - 3 * HR },
      { kind: 'text', text: 'Pinned items are never cleaned up automatically.', app: 'Notes', t: now - 3 * DAY }
    ],
    subs: [],
    subscribe(fn) {
      this.subs.push(fn);
    },
    emit(meta) {
      this.subs.forEach((fn) => fn(meta || {}));
    }
  };
  store.items.forEach((it, i) => (it.id = 'seed' + i));
  let nextId = 1;
  const settings = { capture: true, skipPrivate: true };

  const contentOf = (it) => (it.kind === 'link' ? it.url : it.kind === 'color' ? it.hex : it.kind === 'text' || it.kind === 'code' ? it.text : it.name);
  function shortName(it) {
    if (it.kind === 'link') {
      try {
        return new URL(it.url).host.replace(/^www\./, '');
      } catch (_) {
        return it.url;
      }
    }
    const s = contentOf(it).replace(/\s+/g, ' ').trim();
    return s.length > 32 ? s.slice(0, 31) + '…' : s;
  }

  function classify(text) {
    const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
    if (hex && /^#/.test(text)) {
      let h = hex[1];
      if (h.length === 3) h = h.replace(/./g, (c) => c + c);
      return { kind: 'color', hex: '#' + h.toUpperCase() };
    }
    if (!/\s/.test(text) && /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(text)) {
      return { kind: 'link', url: /^https?:\/\//i.test(text) ? text : 'https://' + text };
    }
    const lines = text.split('\n').length;
    if ((lines > 1 && /[{};=()<>]/.test(text)) || /^(const|let|function|import|export|pnpm|npm|git|cd)\b/.test(text)) {
      return { kind: 'code', text: text };
    }
    return { kind: 'text', text: text.length > 2000 ? text.slice(0, 2000) : text };
  }

  // Adds something copied on this page to the front of the history (or moves it there).
  function remember(text, app) {
    const existing = store.items.find((it) => contentOf(it) === text);
    if (existing) {
      existing.t = Date.now();
      store.emit({ fresh: existing.id });
      return existing;
    }
    const item = Object.assign(classify(text), { id: 'copy' + nextId++, app: app || 'This page', t: Date.now() });
    store.items.push(item);
    store.emit({ fresh: item.id });
    return item;
  }

  async function copyItem(it) {
    const ok = await writeClipboard(contentOf(it));
    if (!ok) {
      toast('Your browser blocked the clipboard. Try selecting and copying instead.');
      return false;
    }
    it.t = Date.now();
    store.emit({ fresh: it.id });
    toast('Copied ' + shortName(it) + '. Paste it anywhere.');
    return true;
  }

  // ---------------------------------------------------------------- search
  function parseQuery(q) {
    const out = { kind: null, app: null, words: [] };
    String(q)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .forEach((tok) => {
        const kind = /^is:(\w*)$/i.exec(tok);
        const app = /^app:(.*)$/i.exec(tok);
        if (kind) out.kind = kind[1].toLowerCase() || null;
        else if (app) out.app = app[1].toLowerCase() || null;
        else out.words.push(tok.toLowerCase());
      });
    return out;
  }
  function matches(it, p) {
    if (p.kind && it.kind !== p.kind) return false;
    if (p.app && it.app.toLowerCase().replace(/\s+/g, '').indexOf(p.app) !== 0) return false;
    const hay = [contentOf(it), it.app, it.kind, it.meta || ''].join(' ').toLowerCase();
    return p.words.every((w) => hay.indexOf(w) !== -1);
  }

  // ---------------------------------------------------------------- cards
  const BAND = { text: '#5a1f5c', link: '#1f6fe6', code: '#0a5fa0', color: '#7b3fe4', image: '#5b6475', file: '#3f3f46' };
  const LABEL = { text: 'Text', link: 'Link', code: 'Code', color: 'Color', image: 'Image', file: 'File' };
  const BOARDS = [
    { id: 'history', name: 'History' },
    { id: 'snippets', name: 'Snippets', color: '#5b4cf5' },
    { id: 'brand', name: 'Brand', color: '#c8245f' },
    { id: 'replies', name: 'Replies', color: '#0b7f8c' }
  ];
  const boardColor = (id) => (BOARDS.find((b) => b.id === id) || {}).color;

  function tintCode(code, words) {
    if (words && words.length) return highlight(code, words);
    return esc(code).replace(/\b(export|function|const|let|var|return|import|from|await|async|if|else)\b/g, '<span class="op-kw">$1</span>');
  }

  function cardHTML(it, words, index, selected, numbered) {
    let body = '';
    let foot = '';
    if (it.kind === 'text') {
      body = '<span class="op-body op-text">' + highlight(it.text, words) + '</span>';
      foot = it.text.length + ' characters';
    } else if (it.kind === 'link') {
      let host = it.url;
      let path = '';
      try {
        const u = new URL(it.url);
        host = u.host.replace(/^www\./, '');
        path = u.pathname + u.search;
      } catch (_) {}
      body = '<span class="op-body"><span class="op-host">' + highlight(host, words) + '</span><span class="op-path">' + highlight(path === '/' ? '' : path, words) + '</span></span>';
      foot = 'Web link';
    } else if (it.kind === 'code') {
      body = '<span class="op-body op-code">' + tintCode(it.text, words) + '</span>';
      const n = it.text.split('\n').length;
      foot = n + (n === 1 ? ' line' : ' lines');
    } else if (it.kind === 'color') {
      const c = hexToRgb(it.hex) || { r: 0, g: 0, b: 0 };
      body =
        '<span class="op-body op-color" style="background:' + it.hex + ';color:' + inkOn(it.hex) + '"><b>' + highlight(it.hex.toUpperCase(), words) +
        '</b><small>rgb(' + c.r + ' ' + c.g + ' ' + c.b + ')</small></span>';
      foot = 'Color';
    } else if (it.kind === 'image') {
      const shades = ['#a79fff', '#a79fff', '#8b80ff', '#8b80ff', '#6d5ff7', '#5b4cf5', '#5b4cf5'];
      body = '<span class="op-body op-image" aria-hidden="true">' + it.bars.map((h, i) => '<i style="height:' + h + '%;background:' + shades[i % shades.length] + '"></i>').join('') + '</span>';
      foot = esc(it.meta);
    } else {
      body =
        '<span class="op-body op-file"><svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg><b>' +
        highlight(it.name, words) + '</b></span>';
      foot = esc(it.meta);
    }
    const board = (it.boards || [])[0];
    const dot = board ? '<span class="op-dot" style="background:' + boardColor(board) + '" title="Pinned to ' + board + '"></span>' : '';
    const num = numbered && index < 9 ? '<span class="op-num" aria-hidden="true">' + (index + 1) + '</span>' : '';
    const label = LABEL[it.kind] + ', ' + shortName(it) + ', from ' + it.app + ', ' + ago(it.t) + '. Copy to clipboard.';
    return (
      '<button type="button" class="op-card' + (selected ? ' is-selected' : '') + '" data-id="' + it.id + '" aria-label="' + esc(label) + '">' +
      '<span class="op-band" style="background:' + BAND[it.kind] + '"><span><b>' + LABEL[it.kind] + '</b><small>' + esc(it.app) + ' · ' + ago(it.t) + '</small></span>' + num + '</span>' +
      body + '<span class="op-foot"><span>' + foot + '</span>' + dot + '</span></button>'
    );
  }

  const SEARCH_ICON = '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

  // ---------------------------------------------------------------- a shelf
  // One component, three places: the shelf in the green band, the search section and the overlay.
  function Shelf(root, opts) {
    this.root = root;
    this.opts = opts;
    this.query = opts.query || '';
    this.board = 'history';
    this.sel = 0;
    this.list = [];
    const tabs = opts.tabs
      ? '<div class="op-tabs" role="group" aria-label="Pinboards">' +
        BOARDS.map((b) => '<button type="button" class="op-tab" data-board="' + b.id + '" aria-pressed="' + (b.id === 'history') + '">' + (b.color ? '<i style="background:' + b.color + '"></i>' : '') + b.name + '</button>').join('') +
        '</div>'
      : '';
    root.innerHTML =
      '<div class="op-shelf-top">' +
      '<label class="op-search' + (opts.wide ? ' wide' : '') + '">' + SEARCH_ICON + '<span class="sr-only">Search the clipboard history</span>' +
      '<input type="text" placeholder="' + (opts.placeholder || 'Search') + '" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"></label>' +
      tabs + '<span class="op-count" aria-live="polite"></span></div>' +
      '<div class="op-cards ' + opts.layout + '" role="group" aria-label="Clipboard history"></div>' +
      (opts.hints
        ? '<div class="op-hints"><span><kbd>Return</kbd> copy</span><span><kbd>← →</kbd> move</span><span><kbd>Esc</kbd> clear</span><span>Click a card to copy it</span></div>'
        : '');
    this.input = $('input', root);
    this.cards = $('.op-cards', root);
    this.count = $('.op-count', root);
    this.input.value = this.query;

    this.input.addEventListener('input', () => {
      this.query = this.input.value;
      this.sel = 0;
      this.render();
    });
    this.input.addEventListener('keydown', (e) => this.onKey(e));
    this.cards.addEventListener('click', (e) => {
      const card = e.target.closest('.op-card');
      if (!card) return;
      const i = this.list.findIndex((it) => it.id === card.dataset.id);
      if (i < 0) return;
      this.sel = i;
      this.copySelected();
    });
    $$('.op-tab', root).forEach((btn) =>
      btn.addEventListener('click', () => {
        this.setBoard(btn.dataset.board);
        this.input.focus({ preventScroll: true });
      })
    );
    store.subscribe((meta) => {
      // A clock tick shouldn't yank focus from a card someone has tabbed to.
      if (!meta.fresh && this.cards.contains(document.activeElement)) return;
      this.render(meta);
    });
    this.render();
  }

  Shelf.prototype.setBoard = function (id) {
    this.board = id;
    this.sel = 0;
    $$('.op-tab', this.root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.board === id)));
    this.render();
  };

  Shelf.prototype.setQuery = function (q) {
    this.query = q;
    this.input.value = q;
    this.sel = 0;
    this.render();
  };

  Shelf.prototype.render = function (meta) {
    const p = parseQuery(this.query);
    this.parsed = p;
    let list = store.items.filter((it) => this.board === 'history' || (it.boards || []).indexOf(this.board) !== -1);
    list = list.filter((it) => matches(it, p)).sort((a, b) => b.t - a.t);
    if (this.opts.limit) list = list.slice(0, this.opts.limit);
    this.list = list;
    if (this.sel >= list.length) this.sel = Math.max(0, list.length - 1);
    const fresh = meta && meta.fresh;
    if (list.length) {
      this.cards.innerHTML = list.map((it, i) => cardHTML(it, p.words, i, i === this.sel, this.opts.numbered)).join('');
      if (fresh && !reduceMotion) {
        const el = this.cards.querySelector('[data-id="' + fresh + '"]');
        if (el) el.classList.add('is-new');
      }
    } else {
      const hint = this.query ? 'Nothing matches “' + esc(this.query.trim()) + '”. Try <code>is:color</code> or <code>app:figma</code>.' : 'Nothing pinned here yet.';
      this.cards.innerHTML = '<p class="op-empty">' + hint + '</p>';
    }
    this.count.textContent = this.query.trim() ? list.length + (list.length === 1 ? ' match' : ' matches') : '';
    if (fresh && this.opts.layout === 'row') this.cards.scrollLeft = 0;
    this.keepSelectedVisible();
    if (this.opts.onRender) this.opts.onRender(p);
  };

  Shelf.prototype.select = function (i) {
    if (!this.list.length) return;
    this.sel = Math.max(0, Math.min(this.list.length - 1, i));
    $$('.op-card', this.cards).forEach((el, j) => el.classList.toggle('is-selected', j === this.sel));
    this.keepSelectedVisible();
  };

  // Scrolls the card row sideways only, never the page.
  Shelf.prototype.keepSelectedVisible = function () {
    if (this.opts.layout !== 'row') return;
    const el = this.cards.children[this.sel];
    if (!el || !el.classList.contains('op-card')) return;
    const c = this.cards;
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    if (left < c.scrollLeft) c.scrollLeft = left - 8;
    else if (right > c.scrollLeft + c.clientWidth) c.scrollLeft = right - c.clientWidth + 8;
  };

  Shelf.prototype.copySelected = async function () {
    const it = this.list[this.sel];
    if (!it) return;
    const ok = await copyItem(it);
    if (ok && this.opts.afterCopy) this.opts.afterCopy();
  };

  Shelf.prototype.onKey = function (e) {
    const cols = this.opts.layout === 'grid' ? Math.max(1, Math.round(this.cards.clientWidth / 192)) : 1;
    switch (e.key) {
      case 'ArrowRight':
        if (this.opts.layout === 'row' || this.input.selectionStart === this.input.value.length) {
          e.preventDefault();
          this.select(this.sel + 1);
        }
        break;
      case 'ArrowLeft':
        if (this.opts.layout === 'row' || this.input.selectionStart === 0) {
          e.preventDefault();
          this.select(this.sel - 1);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.select(this.sel + cols);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.select(this.sel - cols);
        break;
      case 'Home':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          this.select(0);
        }
        break;
      case 'End':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          this.select(this.list.length - 1);
        }
        break;
      case 'Enter':
        e.preventDefault();
        this.copySelected();
        break;
      case 'Escape':
        if (this.input.value) {
          e.preventDefault();
          this.setQuery('');
        } else if (this.opts.onEscape) {
          e.preventDefault();
          this.opts.onEscape();
        }
        break;
      case 'Tab':
        // In the overlay, Tab switches pinboards, as in the app.
        if (this.opts.tabKeys) {
          e.preventDefault();
          const i = BOARDS.findIndex((b) => b.id === this.board);
          const next = (i + (e.shiftKey ? -1 : 1) + BOARDS.length) % BOARDS.length;
          this.setBoard(BOARDS[next].id);
        }
        break;
      default:
        if (this.opts.numbered && (e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
          const i = Number(e.key) - 1;
          if (this.list[i]) {
            e.preventDefault();
            this.sel = i;
            this.copySelected();
          }
        }
    }
  };

  Shelf.prototype.focus = function () {
    this.input.focus({ preventScroll: true });
  };

  // ---------------------------------------------------------------- the shelf in the green band
  const inlineRoot = $('[data-js="shelf-inline"]');
  if (inlineRoot) {
    new Shelf(inlineRoot, { layout: 'row', tabs: true, placeholder: 'Search' });
  }

  // ---------------------------------------------------------------- the search section
  const searchRoot = $('[data-js="search-panel"]');
  const filterList = $('[data-js="filters"]');
  let searchShelf = null;
  if (searchRoot) {
    const filterItems = filterList ? $$('li', filterList) : [];
    searchShelf = new Shelf(searchRoot, {
      layout: 'grid',
      query: 'is:link docs',
      limit: 9,
      wide: true,
      hints: true,
      placeholder: 'Try “is:color”, “app:figma” or any word',
      onRender(p) {
        const active = p.kind ? 'is:' + p.kind : p.app ? 'app:' + p.app : '';
        filterItems.forEach((li) => {
          const on = li.dataset.filter === active;
          li.style.background = on ? '#efeff2' : 'transparent';
          li.style.color = on ? '#111113' : '';
          li.setAttribute('aria-pressed', String(on));
        });
      }
    });
    filterItems.forEach((li) => {
      li.setAttribute('role', 'button');
      li.tabIndex = 0;
      const apply = () => {
        const words = searchShelf.query
          .split(/\s+/)
          .filter((t) => t && !/^(is|app):/i.test(t));
        const q = [li.dataset.filter].concat(words).filter(Boolean).join(' ');
        searchShelf.setQuery(q ? q + ' ' : '');
        searchShelf.focus();
      };
      li.addEventListener('click', apply);
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          apply();
        }
      });
    });
  }

  // The filter chips in the "Everything you need" grid jump to search with that filter.
  const chipRow = $('[data-js="filter-chips"]');
  if (chipRow && searchShelf) {
    $$('span', chipRow).forEach((chip) => {
      chip.setAttribute('role', 'button');
      chip.tabIndex = 0;
      chip.title = 'Search with ' + chip.textContent.trim();
      const go = () => {
        searchShelf.setQuery(chip.textContent.trim() + ' ');
        const section = document.getElementById('search');
        if (section) section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        setTimeout(() => searchShelf.focus(), reduceMotion ? 0 : 500);
      };
      chip.addEventListener('click', go);
      chip.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      });
    });
  }

  // ---------------------------------------------------------------- the ⇧⌘V overlay
  const overlay = document.createElement('div');
  overlay.className = 'op-overlay';
  overlay.hidden = true;
  overlay.innerHTML =
    '<div class="op-overlay-panel" role="dialog" aria-modal="true" aria-label="OpenPaste shelf">' +
    '<div class="op-overlay-head"><b>OpenPaste</b><span class="op-overlay-hint">Type to search · <kbd>←</kbd> <kbd>→</kbd> move · <kbd>Return</kbd> copy · <kbd>Tab</kbd> pinboards · <kbd>Esc</kbd> close</span>' +
    '<button type="button" class="op-close" aria-label="Close the shelf">×</button></div><div class="op-overlay-shelf"></div></div>';
  document.body.appendChild(overlay);
  let lastFocus = null;
  let closeTimer = 0;
  const overlayShelf = new Shelf($('.op-overlay-shelf', overlay), {
    layout: 'row',
    tabs: true,
    tabKeys: true,
    numbered: !mobile,
    placeholder: 'Search',
    onEscape: closeOverlay,
    afterCopy: closeOverlay
  });
  const isOpen = () => overlay.classList.contains('open');
  function openOverlay() {
    clearTimeout(closeTimer);
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add('op-shelf-open');
    overlayShelf.setBoard('history');
    overlayShelf.setQuery('');
    requestAnimationFrame(() => {
      overlay.classList.add('open');
      overlayShelf.focus();
    });
  }
  function closeOverlay() {
    overlay.classList.remove('open');
    document.body.classList.remove('op-shelf-open');
    closeTimer = setTimeout(() => (overlay.hidden = true), reduceMotion ? 0 : 280);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  $('.op-close', overlay).addEventListener('click', closeOverlay);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) closeOverlay();
  });
  document.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || (e.key || '').toLowerCase() !== 'v') return;
    const t = e.target;
    const editing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (editing && !overlay.contains(t)) return; // let paste-as-plain-text work in fields
    e.preventDefault();
    if (isOpen()) closeOverlay();
    else openOverlay();
  });
  $$('[data-js="open-shelf"]').forEach((el) => {
    if (el.tagName !== 'BUTTON') {
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      el.setAttribute('aria-label', 'Open the shelf');
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openOverlay();
        }
      });
    }
    el.addEventListener('click', openOverlay);
  });

  // ---------------------------------------------------------------- capture copies made on this page
  document.addEventListener('copy', (e) => {
    if (suppressCapture) return;
    const t = e.target;
    let text = '';
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && typeof t.selectionStart === 'number') {
      text = t.value.slice(t.selectionStart, t.selectionEnd);
    } else {
      text = String(window.getSelection() || '');
    }
    text = text.replace(/ /g, ' ').trim();
    if (!text) return;
    if (!settings.capture) {
      toast('Capturing is paused, so that copy was skipped.');
      return;
    }
    remember(text, 'This page');
    toast(mobile ? 'Added to the shelf on this page.' : 'On your shelf. Press ' + SHORTCUT + ' to see it.');
  });

  // Copy-on-click bits of the design: the hero color chip and the color bars.
  $$('[data-copy]').forEach((el) => {
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.setAttribute('aria-label', 'Copy ' + el.dataset.copy);
    const go = async () => {
      if (await writeClipboard(el.dataset.copy)) {
        remember(el.dataset.copy, 'This page');
        toast('Copied ' + el.dataset.copy + '. It’s on your shelf too.');
      }
    };
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });
  });
  const bars = $('[data-js="bars"]');
  if (bars) {
    bars.setAttribute('role', 'group');
    bars.setAttribute('aria-label', 'Colors you can copy');
    $$(':scope > span', bars).forEach((bar) => {
      const hex = cssColorToHex(getComputedStyle(bar).backgroundColor) || '#FFFFFF';
      bar.setAttribute('role', 'button');
      bar.tabIndex = 0;
      bar.setAttribute('aria-label', 'Copy ' + hex);
      const tip = document.createElement('span');
      tip.className = 'op-tip';
      tip.textContent = hex;
      bar.appendChild(tip);
      const go = async () => {
        if (await writeClipboard(hex)) {
          remember(hex, 'This page');
          toast('Copied ' + hex + '. It’s on your shelf as a color card.');
        }
      };
      bar.addEventListener('click', go);
      bar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      });
    });
  }

  // ---------------------------------------------------------------- the copy → paste journey
  const journey = $('[data-js="journey"]');
  if (journey) {
    const row = $(':scope > div', journey);
    const steps = row ? Array.from(row.children) : [];
    steps.forEach((s) => s.classList.add('op-step'));
    const path = $('svg path', journey);
    const svg = path && path.ownerSVGElement;
    let active = -1;
    const setActive = (i) => {
      if (i === active) return;
      active = i;
      steps.forEach((s, j) => s.classList.toggle('is-active', j === i));
    };
    let hovering = false;
    steps.forEach((s, i) => {
      s.addEventListener('mouseenter', () => {
        hovering = true;
        setActive(i);
      });
      s.addEventListener('mouseleave', () => (hovering = false));
    });
    if (!reduceMotion && path && svg) {
      const dot = document.createElement('span');
      dot.className = 'op-journey-dot';
      journey.appendChild(dot);
      const total = path.getTotalLength();
      const vb = svg.viewBox.baseVal;
      const DURATION = 8000;
      let visible = false;
      let start = performance.now();
      let raf = 0;
      const frame = (ts) => {
        raf = 0;
        if (!visible) return;
        const progress = ((ts - start) % DURATION) / DURATION;
        const pt = path.getPointAtLength(progress * total);
        const r = svg.getBoundingClientRect();
        const jr = journey.getBoundingClientRect();
        if (r.width) {
          const x = r.left - jr.left + (pt.x / vb.width) * r.width;
          const y = r.top - jr.top + (pt.y / vb.height) * r.height;
          dot.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        }
        if (!hovering) setActive(Math.min(steps.length - 1, Math.floor(progress * steps.length)));
        raf = requestAnimationFrame(frame);
      };
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        if (visible && !raf) raf = requestAnimationFrame(frame);
      }).observe(journey);
    } else {
      setActive(0);
    }
  }

  // ---------------------------------------------------------------- "pastes where you were"
  const pasteDemo = $('[data-js="paste-demo"]');
  if (pasteDemo) {
    const bar = $('span[style*="46%"]', pasteDemo);
    const line = bar && bar.parentElement;
    const caret = line && line.lastElementChild;
    const key = $$('div', pasteDemo).find((d) => /Return/.test(d.textContent) && !d.children.length);
    if (line && caret && key) {
      caret.classList.add('op-caret');
      const typed = document.createElement('span');
      typed.className = 'op-typed';
      line.insertBefore(typed, caret);
      const phrase = 'Thursday at 14:00 works!';
      let running = false;
      const run = () => {
        if (running) return;
        running = true;
        key.classList.add('is-pressed');
        setTimeout(() => key.classList.remove('is-pressed'), 160);
        bar.style.display = 'none';
        typed.textContent = '';
        let i = 0;
        const step = () => {
          typed.textContent = phrase.slice(0, ++i);
          if (i < phrase.length) setTimeout(step, reduceMotion ? 0 : 34);
          else setTimeout(() => (running = false), 900);
        };
        if (reduceMotion) {
          typed.textContent = phrase;
          running = false;
        } else setTimeout(step, 180);
      };
      const tile = pasteDemo.parentElement;
      tile.addEventListener('mouseenter', run);
      tile.addEventListener('click', run);
      new IntersectionObserver((entries, obs) => {
        if (entries[0].isIntersecting) {
          setTimeout(run, 400);
          obs.disconnect();
        }
      }, { threshold: 0.6 }).observe(pasteDemo);
    }
  }

  // ---------------------------------------------------------------- privacy controls
  const SWITCH_MESSAGES = {
    capture: ['Paused. Copies on this page won’t reach the shelf.', 'Capturing again. Copy something to try it.'],
    skipPrivate: ['Password manager copies would now be recorded. Best left on.', 'Password manager copies are skipped again.']
  };
  $$('[data-js="switch"]').forEach((sw) => {
    const key = sw.dataset.setting;
    const knob = sw.firstElementChild;
    const label = sw.parentElement.firstElementChild.textContent.trim();
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-label', label);
    sw.tabIndex = 0;
    const set = (on) => {
      settings[key] = on;
      sw.setAttribute('aria-checked', String(on));
      sw.style.backgroundColor = on ? '#5b4cf5' : '#c9c9d1';
      if (knob) knob.style.right = on ? '3px' : '19px';
    };
    set(settings[key] !== false);
    const toggle = () => {
      const on = sw.getAttribute('aria-checked') !== 'true';
      set(on);
      const msg = SWITCH_MESSAGES[key];
      if (msg) toast(on ? msg[1] : msg[0]);
    };
    sw.addEventListener('click', toggle);
    sw.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle();
      }
    });
  });

  const chipBox = $('[data-js="chips"]');
  if (chipBox) {
    const addBtn = $('[data-js="add-chip"]', chipBox);
    const makeRemovable = (chip) => {
      const name = chip.textContent.trim();
      chip.classList.add('op-chip');
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'op-chip-x';
      x.setAttribute('aria-label', 'Stop ignoring ' + name);
      x.textContent = '×';
      x.addEventListener('click', () => {
        chip.remove();
        toast(name + ' is no longer ignored.');
        if (addBtn) addBtn.focus();
      });
      chip.appendChild(x);
    };
    $$(':scope > span', chipBox)
      .filter((s) => s !== addBtn)
      .forEach(makeRemovable);
    if (addBtn) {
      addBtn.setAttribute('role', 'button');
      addBtn.tabIndex = 0;
      addBtn.setAttribute('aria-label', 'Add an app to ignore');
      const startAdding = () => {
        const input = document.createElement('input');
        input.className = 'op-chip-input';
        input.placeholder = 'App name';
        input.setAttribute('aria-label', 'App to ignore');
        addBtn.hidden = true;
        chipBox.insertBefore(input, addBtn);
        input.focus();
        let done = false;
        const finish = (commit) => {
          if (done) return;
          done = true;
          const name = input.value.trim();
          input.remove();
          addBtn.hidden = false;
          if (commit && name) {
            const chip = document.createElement('span');
            chip.style.cssText = 'background: #efeff2; border-radius: 6px; padding: 3px 8px';
            chip.textContent = name.slice(0, 28);
            chipBox.insertBefore(chip, addBtn);
            makeRemovable(chip);
            toast('Copies made in ' + chip.firstChild.textContent + ' will be ignored.');
          }
          addBtn.focus();
        };
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            finish(true);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            finish(false);
          }
        });
        input.addEventListener('blur', () => finish(true));
      };
      addBtn.addEventListener('click', startAdding);
      addBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startAdding();
        }
      });
    }
  }

  $$('[data-js="select"]').forEach((span) => {
    const current = span.textContent.trim();
    const select = document.createElement('select');
    select.className = 'op-select';
    select.setAttribute('aria-label', span.parentElement.firstElementChild.textContent.trim());
    span.dataset.options.split('|').forEach((o) => select.add(new Option(o, o, o === current, o === current)));
    span.replaceWith(select);
    select.addEventListener('change', () => {
      const row = select.closest('[data-row]');
      toast(row && row.dataset.row === 'max' ? 'The shelf will keep at most ' + select.value + '.' : 'Unpinned items will now be removed after ' + select.value + '.');
    });
  });

  const folder = $('[data-js="open-folder"]');
  if (folder) {
    folder.setAttribute('role', 'button');
    folder.tabIndex = 0;
    const where = { mac: '~/Library/Application Support/OpenPaste/data', win: '%APPDATA%\\OpenPaste\\data', linux: '~/.config/OpenPaste/data' }[os];
    const go = () => toast(where ? 'In the app, this opens ' + where : 'In the app, this opens the folder where your history lives.');
    folder.addEventListener('click', go);
    folder.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });
  }

  const privacyLinks = $('[data-js="privacy-links"]');
  if (privacyLinks) {
    const items = $$('li', privacyLinks);
    items.forEach((li) => {
      li.setAttribute('role', 'button');
      li.tabIndex = 0;
      const go = () => {
        items.forEach((other) => {
          const on = other === li;
          other.style.background = on ? '#efeff2' : 'transparent';
          other.style.color = on ? '#111113' : '';
        });
        const row = $('[data-row="' + li.dataset.target + '"]');
        if (!row) return;
        row.classList.remove('op-flash');
        void row.offsetWidth;
        row.classList.add('op-flash');
        const control = $('[role="switch"], select, .op-chip-x, [data-js="add-chip"]', row);
        if (control && control.focus) control.focus({ preventScroll: true });
      };
      li.addEventListener('click', go);
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      });
    });
  }

  // ---------------------------------------------------------------- downloads and the latest release
  const releaseAsset = { mac: 'mac-arm', win: 'win', linux: 'appimage' }[os];
  const buttonLabel = { mac: 'Download for macOS', win: 'Download for Windows', linux: 'Download for Linux' }[os] || 'Download';
  let recommended = releaseAsset;

  function applyDownloads() {
    $$('[data-asset]').forEach((a) => a.classList.toggle('op-recommended', a.dataset.asset === recommended));
    const link = recommended && os !== 'linux' && $('[data-asset="' + recommended + '"]');
    $$('[data-download-button]').forEach((btn) => {
      btn.href = link ? link.href : '#download';
      const text = $('[data-download-label]', btn);
      if (text) text.textContent = buttonLabel;
    });
  }
  applyDownloads();

  // Chromium can tell an Intel Mac from an Apple silicon one.
  if (os === 'mac' && navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
    navigator.userAgentData
      .getHighEntropyValues(['architecture'])
      .then((v) => {
        if (v.architecture === 'x86') {
          recommended = 'mac-intel';
          applyDownloads();
        }
      })
      .catch(() => {});
  }

  const patterns = {
    'mac-arm': /-arm64\.dmg$/,
    'mac-intel': /^OpenPaste-[\d.]+\.dmg$/,
    win: /\.exe$/,
    appimage: /\.AppImage$/,
    deb: /_amd64\.deb$/
  };
  const api = (path) =>
    fetch('https://api.github.com/repos/alexsilver8/openpaste' + path, { headers: { Accept: 'application/vnd.github+json' } }).then((r) =>
      r.ok ? r.json() : null
    );
  const releaseP = api('/releases/latest').catch(() => null);
  const repoP = api('').catch(() => null);

  releaseP.then((release) => {
    if (!release || !release.assets) return;
    const version = String(release.tag_name || '').replace(/^v/, '');
    if (version) $$('[data-version]').forEach((el) => (el.textContent = version));
    Object.keys(patterns).forEach((key) => {
      const match = release.assets.find((a) => patterns[key].test(a.name));
      const link = $('[data-asset="' + key + '"]');
      if (match && link) link.href = match.browser_download_url;
    });
    applyDownloads();
  });

  // Live numbers for "Built in the open", straight from GitHub.
  Promise.all([repoP, releaseP]).then(([repo, release]) => {
    const parts = [];
    const plural = (n, one, many) => n.toLocaleString() + ' ' + (n === 1 ? one : many);
    if (repo) {
      if (repo.stargazers_count > 0) parts.push('★ ' + plural(repo.stargazers_count, 'star', 'stars'));
      if (repo.forks_count > 0) parts.push(plural(repo.forks_count, 'fork', 'forks'));
      const ghLink = $('[data-js="gh-link"]');
      if (ghLink && repo.stargazers_count > 0) ghLink.textContent = 'GitHub ★ ' + repo.stargazers_count.toLocaleString();
    }
    if (release && release.tag_name) {
      const date = new Date(release.published_at || Date.now()).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      parts.push(release.tag_name + ' released ' + date);
    }
    const stats = $('[data-js="gh-stats"]');
    if (stats && parts.length) stats.textContent = parts.concat('MIT licensed').join(' · ');
  });

  // ---------------------------------------------------------------- fade sections in as they arrive
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const hero = document.getElementById('top');
    const targets = $$('main h2, main blockquote, main section > div, main section > svg').filter(
      (el) => !(hero && hero.contains(el)) && el.getBoundingClientRect().top > window.innerHeight
    );
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        }),
      { rootMargin: '0px 0px -60px 0px', threshold: 0.08 }
    );
    targets.forEach((el) => {
      el.classList.add('op-reveal');
      io.observe(el);
    });
  }

  // Keep "2 min ago" honest while the page is open.
  setInterval(() => store.emit(), 30 * 1000);
})();
