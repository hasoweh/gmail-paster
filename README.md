# Snippet Paster (Chrome extension)

Press a hotkey to open a menu of saved text snippets. Pick one and it's pasted
where your cursor was, **with its formatting** (bold, italic, underline, links, lists).

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Reload any tabs that were already open (or just use the hotkey: the extension injects itself if needed).

## Use

- Click into a text box (Gmail compose, a textarea, a chat box, etc.).
- Press **Alt+Shift+V**. A menu opens near your cursor.
- Type to filter, use **↑/↓**, then press **Enter** (or click). **Esc** closes the menu.

To change the hotkey, go to `chrome://extensions/shortcuts`, or use the **Change** link on the snippet manager page.

## Managing snippets

Click the extension's toolbar icon (or **Manage** in the menu) to open the snippet manager:

- **+ New snippet**, then give it a name and write the text.
- Format with the toolbar or with Ctrl+B / Ctrl+I / Ctrl+U. You can also paste
  already-formatted text from a doc or email.
- Changes save automatically. Use ↑/↓ to reorder the snippets.
- **Export/Import** backs up or moves your snippets as a JSON file.

## How pasting works

- **Rich editors** (Gmail, most web apps with formatting): the snippet is delivered as a
  formatted (HTML) paste, so the formatting is kept. If the editor doesn't accept that,
  the extension falls back to inserting the HTML directly.
- **Plain text boxes** (`<textarea>`, `<input>`): these can't hold formatting, so the
  plain-text version is inserted. Line breaks are kept and list items get a "•" bullet.
- **No text box focused**: the snippet is copied to your clipboard, ready to paste with Ctrl+V.

Chrome doesn't allow extensions on some pages (`chrome://` pages, the Chrome Web Store,
the new-tab page), so the hotkey does nothing there.
