(() => {
  'use strict';
  const OWNER = 'velcovsky', REPO = 'velcovsky.github.io', FOLDER = 'kriz/krizovky';
  const $ = s => document.querySelector(s);
  const state = { files: [], puzzle: null, slug: '', values: {}, selected: null, direction: 'R', clues: [], checks: {} };
  const norm = s => (s || '').normalize('NFC').toLocaleUpperCase('cs-CZ');
  const key = (r, c) => `${r}-${c}`;
  const isLetter = c => c && c.t === 'L';

  async function fetchJson(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status} při načítání ${url}`);
    return r.json();
  }

  async function loadFiles() {
    const select = $('#puzzle-select'), statusEl = $('#catalog-status');
    try {
      // Statický katalog nevyužívá GitHub API, a proto jej neomezuje anonymní limit API.
      const manifestUrl = `https://${OWNER}.github.io/kriz/krizovky/index.json?v=${Date.now()}`;
      const listing = await fetchJson(manifestUrl);
      if (!Array.isArray(listing)) throw new Error('index.json musí obsahovat seznam souborů.');
      const baseRaw = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${FOLDER}/`;
      const files = listing.map(item => {
        if (typeof item === 'string') {
          const path = item.replace(/^\/+/, '');
          return { name: path.split('/').pop(), download_url: baseRaw + path.split('/').map(encodeURIComponent).join('/') };
        }
        const path = String(item.path || item.name || '').replace(/^\/+/, '');
        if (!path) return null;
        return {
          name: item.name || path.split('/').pop(),
          download_url: item.url || item.download_url || (baseRaw + path.split('/').map(encodeURIComponent).join('/'))
        };
      }).filter(x => x && x.name.toLowerCase().endsWith('.json') && x.name.toLowerCase() !== 'index.json');
      state.files = files.sort((a, b) => a.name.localeCompare(b.name, 'cs'));
      select.replaceChildren();
      if (!state.files.length) {
        select.add(new Option('Ve složce nejsou JSON soubory', ''));
        statusEl.textContent = 'Katalog se načetl, ale neobsahuje žádné křížovky. Zkontroluj soubor kriz/krizovky/index.json.';
        return;
      }
      select.add(new Option('— Vyberte křížovku —', ''));
      state.files.forEach(f => select.add(new Option(f.name.replace(/\.json$/i, '').replace(/[-_]/g, ' '), f.name)));
      statusEl.textContent = `Načteno křížovek: ${state.files.length}.`;
      const params = new URLSearchParams(location.search), initial = params.get('puzzle');
      if (initial && state.files.some(f => f.name === initial)) { select.value = initial; await openSelected(); }
    } catch (e) {
      select.replaceChildren(new Option('Seznam se nepodařilo načíst', ''));
      statusEl.textContent = `Seznam se nepodařilo načíst (${e.message}). Ověř, že existuje ${FOLDER}/index.json a že GitHub Pages už změny zveřejnil.`;
    }
  }

  function allClues(p) {
    const out = [];
    p.cells.forEach((row, r) => row.forEach((cell, c) => {
      if (cell.t !== 'C') return;
      if (cell.clue) out.push({ r, c, d: cell.arrow === 'D' ? 'D' : 'R', text: cell.clue, start: next(r, c, cell.arrow === 'D' ? 'D' : 'R') });
      if (cell.clue2) out.push({ r, c, d: cell.arrow2 === 'R' ? 'R' : 'D', text: cell.clue2, start: next(r, c, cell.arrow2 === 'R' ? 'R' : 'D') });
    }));
    return out.map(x => ({ ...x, cells: wordCells(p, x.start, x.d) })).filter(x => x.cells.length);
  }
  function next(r, c, d) { return d === 'R' ? [r, c + 1] : [r + 1, c]; }
  function wordCells(p, start, d) {
    let [r, c] = start; const out = [];
    while (r >= 0 && c >= 0 && r < p.rows && c < p.cols && isLetter(p.cells[r][c])) {
      out.push([r, c]); if (d === 'R') c++; else r++;
    }
    return out;
  }
  function clueAt(r, c, d) { return state.clues.find(x => x.cells.some(([rr, cc]) => rr === r && cc === c) && x.d === d); }

  async function openSelected() {
    const filename = $('#puzzle-select').value;
    if (!filename) return alert('Nejprve vyber křížovku.');
    try {
      const file = state.files.find(x => x.name === filename), raw = await fetch(file.download_url);
      if (!raw.ok) throw new Error(`HTTP ${raw.status}`);
      const p = await raw.json(); validatePuzzle(p);
      state.puzzle = p; state.slug = filename; state.values = {}; state.checks = {}; state.selected = null; state.direction = 'R'; state.clues = allClues(p);
      try { state.values = JSON.parse(localStorage.getItem(`kriz-${filename}`) || '{}'); } catch {}
      $('#catalog').classList.add('hidden'); $('#solver').classList.remove('hidden');
      $('#puzzle-title').textContent = filename.replace(/\.json$/i, '').replace(/[-_]/g, ' ');
      $('#puzzle-description').textContent = `Mřížka ${p.rows} × ${p.cols}`;
      renderBoard(); renderClues(); progress(); status('Křížovka načtena.');
      history.replaceState(null, '', `${location.pathname}?puzzle=${encodeURIComponent(filename)}`);
      $('#solver').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { alert(`Křížovku nelze načíst: ${e.message}`); }
  }
  function validatePuzzle(p) {
    if (!p || !Number.isInteger(p.rows) || !Number.isInteger(p.cols) || !Array.isArray(p.cells) || p.cells.length !== p.rows || p.cells.some(row => !Array.isArray(row) || row.length !== p.cols))
      throw new Error('Neplatný formát JSON: rows, cols a cells musí tvořit správnou mřížku.');
  }

  function renderBoard() {
    const p = state.puzzle, board = $('#crossword');
    board.style.setProperty('--cols', p.cols); board.style.gridTemplateColumns = `repeat(${p.cols},minmax(0,1fr))`; board.replaceChildren();
    p.cells.forEach((row, r) => row.forEach((cell, c) => {
      const el = document.createElement('div'); el.className = 'cell'; el.dataset.r = r; el.dataset.c = c;
      if (cell.t === 'W') el.classList.add('block');
      else if (cell.t === 'C') {
        el.classList.add('clue-cell'); el.setAttribute('role', 'button'); el.tabIndex = 0;
        const cluesHere = state.clues.filter(x => x.r === r && x.c === c);
        const clue = cluesHere.find(x => x.d === state.direction) || cluesHere[0];
        const n = document.createElement('span'); n.className = 'clue-number'; n.textContent = cell.tj || '';
        const parts = document.createElement('div'); parts.className = 'clue-parts';
        cluesHere.forEach((item, index) => {
          const part = document.createElement('div'); part.className = 'clue-part';
          part.dataset.direction = item.d;
          const text = document.createElement('span'); text.className = 'clue-in-cell';
          text.textContent = item.text;
          part.append(text);
          part.addEventListener('click', event => { event.stopPropagation(); state.direction = item.d; state.selected = item.cells[0]; renderClues(); highlights(); focusCell(...state.selected); });
          parts.append(part);
        });
        el.append(parts, n); el.title = cluesHere.map(x => x.text).join(' | ') || 'Vybrat nápovědu';
        const chooseClue = () => {
          if (!cluesHere.length) return;
          const current = cluesHere.find(x => x.d === state.direction);
          const nextClue = cluesHere.length > 1 && current ? cluesHere.find(x => x.d !== current.d) : (current || cluesHere[0]);
          state.direction = nextClue.d; state.selected = nextClue.cells[0]; renderClues(); highlights(); focusCell(...state.selected);
        };
        el.addEventListener('click', chooseClue); el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseClue(); } });
      } else {
        el.classList.add('letter-cell');
        const input = document.createElement('input');
        input.type = 'text'; input.inputMode = 'text'; input.autocapitalize = 'characters'; input.autocomplete = 'off'; input.spellcheck = false;
        input.enterKeyHint = 'next'; input.maxLength = p.ch_single === false ? 2 : 1;
        input.setAttribute('aria-label', `Řádek ${r + 1}, sloupec ${c + 1}`); input.setAttribute('autocorrect', 'off');
        input.value = state.values[key(r, c)] || ''; input.dataset.r = r; input.dataset.c = c;
        // Důležité: při kliknutí do již vybraného políčka se mřížka znovu nevykresluje.
        // Zůstane tak zachované focus a mobilní klávesnice se může otevřít.
        input.addEventListener('focus', () => selectCell(r, c));
        // Kliknutí na stejné písmeno přepne směr, pokud tudy prochází vodorovné i svislé slovo.
        input.addEventListener('click', () => {
          const across = clueAt(r, c, 'R'), down = clueAt(r, c, 'D');
          if (across && down && state.selected && state.selected[0] === r && state.selected[1] === c) {
            state.direction = state.direction === 'R' ? 'D' : 'R';
            renderClues(); highlights();
          }
        });
        input.addEventListener('input', () => {
          let v = norm(input.value).replace(/[^A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g, '');
          if (p.ch_single !== false) v = [...v].slice(-1).join('');
          input.value = v;
          if (v) state.values[key(r, c)] = v; else delete state.values[key(r, c)];
          delete state.checks[key(r, c)]; persist(); highlights(); progress();
          if (v) moveNext(r, c, 1);
        });
        input.addEventListener('keydown', e => handleKey(e, r, c));
        el.append(input);
      }
      board.append(el);
    }));
    highlights();
  }
  function selectCell(r, c) { state.selected = [r, c]; highlights(); renderClues(); }
  function handleKey(e, r, c) {
    const m = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
    if (m[e.key]) { e.preventDefault(); focusNext(r, c, ...m[e.key]); }
    else if (e.key === 'Backspace' && !e.target.value) moveNext(r, c, -1);
  }
  function focusCell(r, c) { document.querySelector(`input[data-r="${r}"][data-c="${c}"]`)?.focus({ preventScroll: true }); }
  function moveNext(r, c, step) {
    let rr = r, cc = c;
    for (let i = 0; i < state.puzzle.rows * state.puzzle.cols; i++) {
      if (state.direction === 'R') cc += step; else rr += step;
      if (rr < 0 || cc < 0 || rr >= state.puzzle.rows || cc >= state.puzzle.cols) return;
      if (isLetter(state.puzzle.cells[rr][cc])) { focusCell(rr, cc); return; }
    }
  }
  function focusNext(r, c, dr, dc) {
    let rr = r + dr, cc = c + dc;
    while (rr >= 0 && cc >= 0 && rr < state.puzzle.rows && cc < state.puzzle.cols) {
      if (isLetter(state.puzzle.cells[rr][cc])) { focusCell(rr, cc); return; }
      rr += dr; cc += dc;
    }
  }
  function highlights() {
    document.querySelectorAll('#crossword .cell').forEach(el => el.classList.remove('selected', 'in-word', 'correct', 'wrong', 'active-clue'));
    if (!state.puzzle) return;
    const active = state.selected ? clueAt(...state.selected, state.direction) : null;
    if (active) {
      active.cells.forEach(([r, c]) => document.querySelector(`#crossword .cell[data-r="${r}"][data-c="${c}"]`)?.classList.add('in-word'));
      document.querySelector(`#crossword .cell[data-r="${active.r}"][data-c="${active.c}"]`)?.classList.add('active-clue');
    }
    if (state.selected) document.querySelector(`#crossword .cell[data-r="${state.selected[0]}"][data-c="${state.selected[1]}"]`)?.classList.add('selected');
    Object.entries(state.checks).forEach(([k, v]) => { const [r, c] = k.split('-'); document.querySelector(`#crossword .cell[data-r="${r}"][data-c="${c}"]`)?.classList.add(v ? 'correct' : 'wrong'); });
  }
  function renderClues() {
    const host = $('#clues-list'); host.replaceChildren();
    const current = state.selected ? clueAt(...state.selected, state.direction) : null;
    const currentBar = $('#current-clue');
    if (currentBar) currentBar.textContent = current ? `${current.d === 'D' ? '↓ Svisle' : '→ Vodorovně'}: ${current.text} (${current.cells.length} písmen)` : 'Kliknutím vyberte nápovědu v mřížce nebo v seznamu níže.';
    document.querySelectorAll('.clue-tab').forEach(b => b.classList.toggle('active', b.dataset.direction === state.direction));
    state.clues.filter(c => c.d === state.direction).forEach((clue, i) => {
      const b = document.createElement('button'); b.className = 'clue-item';
      if (state.selected && clue.cells.some(([r, c]) => r === state.selected[0] && c === state.selected[1])) b.classList.add('active');
      const idx = document.createElement('span'); idx.className = 'clue-index'; idx.textContent = String(i + 1);
      const text = document.createElement('span'); text.className = 'clue-text'; text.textContent = clue.text;
      const len = document.createElement('span'); len.className = 'clue-length'; len.textContent = `${clue.cells.length} písmen`; text.append(len); b.append(idx, text);
      b.addEventListener('click', () => { state.selected = clue.cells[0]; state.direction = clue.d; renderClues(); highlights(); focusCell(...state.selected); }); host.append(b);
    });
    if (!host.children.length) host.textContent = 'V tomto směru nejsou nápovědy.';
  }
  function persist() { try { localStorage.setItem(`kriz-${state.slug}`, JSON.stringify(state.values)); } catch {} }
  function progress() {
    if (!state.puzzle) return;
    let total = 0, filled = 0; const secret = [];
    state.puzzle.cells.forEach((row, r) => row.forEach((cell, c) => {
      if (isLetter(cell)) { total++; if (state.values[key(r, c)]) filled++; }
      if (Number(cell.tj) > 0) secret[Number(cell.tj) - 1] = state.values[key(r, c)] || '·';
    }));
    $('#progress-label').textContent = `${Math.round(filled / Math.max(total, 1) * 100)} % vyplněno`;
    const host = $('#secret-answer'); host.replaceChildren();
    if (secret.length) secret.forEach(ch => { const s = document.createElement('span'); s.textContent = ch || '·'; host.append(s); });
    else host.textContent = 'Tajenka není definována';
  }
  function status(s, bad = false) { const el = $('#status-message'); el.textContent = s; el.style.background = bad ? '#ffe0e0' : '#eef4ff'; }
  function checkAll() {
    let n = 0, ok = 0;
    state.puzzle.cells.forEach((row, r) => row.forEach((cell, c) => {
      const k = key(r, c), v = state.values[k]; if (!isLetter(cell) || !v) return;
      n++; const answer = norm(cell.ch || ''), correct = answer !== '' && norm(v) === answer; state.checks[k] = correct; if (correct) ok++;
    }));
    highlights(); status(n ? `Správně ${ok} z ${n} vyplněných políček.` : 'Nejprve vyplňte alespoň jedno políčko.');
  }
  function reveal() {
    if (!state.selected) return status('Nejprve vyberte políčko.', true);
    const [r, c] = state.selected, cell = state.puzzle.cells[r][c], answer = norm(cell.ch || '');
    if (!answer) return status('Pro toto políčko není v JSON uvedené řešení.', true);
    state.values[key(r, c)] = answer; state.checks[key(r, c)] = true;
    const input = document.querySelector(`input[data-r="${r}"][data-c="${c}"]`); if (input) input.value = answer;
    persist(); progress(); highlights(); status('Písmeno bylo odhaleno.'); moveNext(r, c, 1);
  }

  $('#load-puzzle').addEventListener('click', openSelected);
  $('#puzzle-select').addEventListener('dblclick', openSelected);
  $('#back-btn').addEventListener('click', () => { $('#solver').classList.add('hidden'); $('#catalog').classList.remove('hidden'); history.replaceState(null, '', location.pathname); });
  $('#check-btn').addEventListener('click', checkAll);
  $('#reveal-btn').addEventListener('click', reveal);
  $('#clear-btn').addEventListener('click', () => {
    if (!confirm('Opravdu vymazat všechna vyplněná písmena této křížovky?')) return;
    state.values = {}; state.checks = {}; persist(); renderBoard(); progress(); status('Vyplnění bylo vymazáno.');
  });
  document.querySelectorAll('.clue-tab').forEach(b => b.addEventListener('click', () => { state.direction = b.dataset.direction; renderClues(); highlights(); }));
  loadFiles();
})();
