// Snippet manager (options page).
const $ = (id) => document.getElementById(id);

let snippets = [];
let selectedId = null;
let saveTimer = null;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

async function load() {
  const data = await chrome.storage.local.get('snippets');
  snippets = Array.isArray(data.snippets) ? data.snippets : [];
  if (!selectedId && snippets[0]) selectedId = snippets[0].id;
  renderList();
  renderEditor();
}

function persist() {
  $('status').textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await chrome.storage.local.set({ snippets });
    $('status').textContent = 'Saved';
  }, 300);
}

const current = () => snippets.find((s) => s.id === selectedId);

function renderList() {
  const list = $('list');
  list.textContent = '';
  for (const s of snippets) {
    const li = document.createElement('li');
    li.textContent = s.title || '(untitled)';
    if (s.id === selectedId) li.className = 'selected';
    li.addEventListener('click', () => { selectedId = s.id; renderList(); renderEditor(); });
    list.appendChild(li);
  }
}

function renderEditor() {
  const s = current();
  $('editor').hidden = !s;
  $('empty').hidden = !!s;
  if (!s) return;
  $('title').value = s.title || '';
  $('body').innerHTML = s.html || '';
  $('status').textContent = '';
}

// ----- Editing -----
$('title').addEventListener('input', () => {
  const s = current();
  if (!s) return;
  s.title = $('title').value;
  renderList();
  persist();
});

$('body').addEventListener('input', () => {
  const s = current();
  if (!s) return;
  s.html = $('body').innerHTML;
  persist();
});

document.querySelectorAll('.toolbar [data-cmd]').forEach((btn) => {
  btn.addEventListener('mousedown', (e) => e.preventDefault()); // keep selection in editor
  btn.addEventListener('click', () => {
    document.execCommand(btn.dataset.cmd, false, null);
    $('body').dispatchEvent(new Event('input'));
  });
});

$('link').addEventListener('mousedown', (e) => e.preventDefault());
$('link').addEventListener('click', () => {
  const url = prompt('Link URL:', 'https://');
  if (!url) return;
  const sel = window.getSelection();
  if (sel.isCollapsed) {
    document.execCommand('insertHTML', false, `<a href="${encodeURI(url)}">${url.replace(/[<>&]/g, '')}</a>`);
  } else {
    document.execCommand('createLink', false, url);
  }
  $('body').dispatchEvent(new Event('input'));
});

// ----- Add / delete / reorder -----
$('add').addEventListener('click', () => {
  const s = { id: uid(), title: 'New snippet', html: '' };
  snippets.push(s);
  selectedId = s.id;
  persist();
  renderList();
  renderEditor();
  $('title').select();
});

$('delete').addEventListener('click', () => {
  const s = current();
  if (!s || !confirm(`Delete "${s.title || 'untitled'}"?`)) return;
  const i = snippets.indexOf(s);
  snippets.splice(i, 1);
  selectedId = (snippets[i] || snippets[i - 1] || {}).id || null;
  persist();
  renderList();
  renderEditor();
});

function move(delta) {
  const s = current();
  const i = snippets.indexOf(s);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= snippets.length) return;
  [snippets[i], snippets[j]] = [snippets[j], snippets[i]];
  persist();
  renderList();
}
$('up').addEventListener('click', () => move(-1));
$('down').addEventListener('click', () => move(1));

// ----- Import / export -----
$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(snippets, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'snippets.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

$('import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error('Expected a list of snippets.');
    const incoming = data
      .filter((d) => d && typeof d === 'object')
      .map((d) => ({ id: uid(), title: String(d.title || ''), html: String(d.html || '') }));
    const replace = confirm(`Import ${incoming.length} snippet(s).\n\nOK = replace existing snippets\nCancel = add to existing`);
    snippets = replace ? incoming : snippets.concat(incoming);
    selectedId = snippets[0] ? snippets[0].id : null;
    await chrome.storage.local.set({ snippets });
    renderList();
    renderEditor();
  } catch (err) {
    alert('Import failed: ' + err.message);
  }
});

// ----- Hotkey display -----
chrome.commands.getAll((cmds) => {
  const c = cmds.find((x) => x.name === 'open-snippet-menu');
  $('hotkey').textContent = (c && c.shortcut) || 'not set';
});
$('change-hotkey').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));

// Keep in sync if snippets change in another tab.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.snippets) return;
  // Ignore the echo of our own saves so the editor isn't reset while typing.
  if (JSON.stringify(changes.snippets.newValue) === JSON.stringify(snippets)) return;
  load();
});

load();
