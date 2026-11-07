# Snippet Paster

A Chrome extension for pasting saved messages quickly. Press a hotkey, pick a message
from the menu, and it's pasted where your cursor was, **with its formatting**
(bold, italic, underline, links and lists).

It works in Gmail, most web apps with a rich text editor, and ordinary text boxes.

---

## Installation

This extension isn't on the Chrome Web Store, so you load it into Chrome yourself.
It takes about a minute.

### 1. Download the code

**Option A: download a ZIP (no tools needed)**

1. On this repository's page, click the green **Code** button, then **Download ZIP**.
2. Unzip it somewhere permanent, for example `Documents/snippet-paster`.
   Don't delete or move this folder later: Chrome loads the extension from it.

**Option B: clone with git**

```bash
git clone <this-repo-url>
```

### 2. Load it into Chrome

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (the switch in the top-right corner).
3. Click **Load unpacked**.
4. Select the folder that contains `manifest.json` (the folder you unzipped or cloned).
5. "Snippet Paster" now appears in your extensions list.

**Optional:** click the puzzle-piece icon in the Chrome toolbar and pin
**Snippet Paster** to keep its icon visible.

> Tabs that were already open before you installed the extension still work. The
> extension sets itself up on a page the first time you press the hotkey there.
> Refreshing the tab also works.

The same steps work in other Chromium-based browsers, such as Microsoft Edge (`edge://extensions`) and Brave.

---

## How to use it

1. Click into any text box, for example a Gmail compose window.
2. Press **Alt+Shift+V**. A menu of your saved messages opens next to your cursor.
3. Pick a message:
   - type to search,
   - use **↑ / ↓** to move and **Enter** to paste, or
   - click a message.
4. The message is pasted where your cursor was, formatting included.

Press **Esc** to close the menu without pasting.

### Changing the hotkey

Go to `chrome://extensions/shortcuts`, find **Snippet Paster**, and set any combination you like.
The snippet manager page also has a **Change** link to that page.

---

## Saving and editing your messages

Click the **Snippet Paster icon** in the toolbar. You can also click **Manage** at the bottom
of the menu that the hotkey opens. This opens the snippet manager.

| To… | Do this |
| --- | --- |
| Add a message | Click **+ New snippet**, then type a name (this is what the menu shows) and the message text |
| Edit a message | Click it in the list on the left and change the name or text |
| Format text | Select text and use the toolbar (**B**, *I*, U, S, lists, Link, Clear) or Ctrl+B / Ctrl+I / Ctrl+U |
| Keep existing formatting | Copy formatted text from an email or document and paste it into the editor |
| Reorder | Use the **↑ / ↓** buttons. The menu shows messages in the same order |
| Delete | Click **Delete** |
| Back up / move to another computer | **Export** saves your messages to a `.json` file; **Import** loads one |

Changes save automatically. The extension comes with three example messages, which you can edit or delete.

Your messages are stored in your Chrome profile on that computer. They don't sync between
computers, so use **Export / Import** to copy them across.

---

## How pasting works

| Where your cursor is | What gets pasted |
| --- | --- |
| A rich text editor (Gmail, most chat and email apps) | The message **with formatting** |
| A plain text box (e.g. a basic form field) | The plain text. These boxes can't show formatting, but line breaks are kept and list items get a "•" |
| No text box selected | The message is copied to your clipboard. Press **Ctrl+V** (or **Cmd+V**) to paste it |

---

## Troubleshooting

- **Nothing happens when I press the hotkey.**
  - Check `chrome://extensions/shortcuts`. Another extension may already use Alt+Shift+V,
    in which case Chrome leaves Snippet Paster's hotkey blank. Set a different one there.
  - Chrome doesn't let extensions run on some pages, such as `chrome://` pages, the
    Chrome Web Store and the New Tab page.
- **The formatting didn't come through.** The text box you pasted into probably only supports plain
  text. Some websites also remove formatting from everything that's pasted into them.
- **I edited the code and nothing changed.** Go to `chrome://extensions`, click the reload icon
  on Snippet Paster, and then refresh the page you're using.

---

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension configuration (permissions and hotkey) |
| `background.js` | Listens for the hotkey and opens the menu in the current tab |
| `content.js` | The menu shown on the page, plus the code that pastes the message |
| `options.html` / `options.js` / `options.css` | The snippet manager page |
| `icons/` | Extension icons |

## Permissions

- **Read and change data on all websites**: needed to show the menu and paste into text boxes on any site.
- **Storage**: saves your messages in Chrome on your computer.

Your messages stay in your browser. The extension doesn't send any data anywhere.
