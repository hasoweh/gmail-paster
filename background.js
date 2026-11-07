// Service worker: listens for the hotkey and tells the page to open the menu.

const DEFAULT_SNIPPETS = [
  {
    id: 'welcome',
    title: 'Thanks for reaching out',
    html: 'Hi there,<br><br>Thanks for reaching out! <b>I\'ll get back to you within 24 hours.</b><br><br>Best,<br>Me'
  },
  {
    id: 'followup',
    title: 'Friendly follow-up',
    html: 'Hi,<br><br>Just following up on my last message. <b>Could you let me know by Friday?</b> <i>No rush otherwise.</i><br><br>Thanks!'
  },
  {
    id: 'meeting',
    title: 'Meeting link',
    html: 'Here is the meeting link: <a href="https://example.com/meet">example.com/meet</a><br><b>Time:</b> 10:00 AM'
  }
];

chrome.runtime.onInstalled.addListener(async () => {
  const { snippets } = await chrome.storage.local.get('snippets');
  if (!Array.isArray(snippets)) {
    await chrome.storage.local.set({ snippets: DEFAULT_SNIPPETS });
  }
});

async function openMenuInTab(tab) {
  if (!tab || tab.id == null) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'open-snippet-menu' });
  } catch (e) {
    // Content script isn't loaded in this tab yet (e.g. the tab was open
    // before the extension was installed). Inject it, then retry.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.js']
      });
      await chrome.tabs.sendMessage(tab.id, { type: 'open-snippet-menu' });
    } catch (err) {
      // Restricted pages (chrome://, Chrome Web Store, etc.) can't be scripted.
      console.warn('Snippet Paster: cannot run on this page.', err);
    }
  }
}

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'open-snippet-menu') return;
  if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  openMenuInTab(tab);
});

// Clicking the toolbar icon opens the snippet manager.
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'open-options') chrome.runtime.openOptionsPage();
});
