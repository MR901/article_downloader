// Background script (Manifest V2)
// Minimal: popup handles PDF generation; content script handles extraction.

chrome.runtime.onInstalled.addListener(() => {
  // No-op: used as activation point
});

// Simple health check for debugging
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "ping") {
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
