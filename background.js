/**
 * Background Script for ArticleDoc Browser Extension (Manifest V2)
 *
 * This background script follows a minimal architecture where:
 * - Popup script (popup.js) handles all PDF generation and user interaction
 * - Content script (content.js) handles article extraction from web pages
 * - Background script only provides basic lifecycle management and inter-script communication
 *
 * This design keeps the background script lightweight and focused on essential coordination tasks.
 */

// Extension installation handler - serves as an activation point for the extension
chrome.runtime.onInstalled.addListener(() => {
  // No specific initialization needed - extension components are self-contained
  // This listener exists primarily to ensure the extension is properly activated
});

/**
 * Simple health check endpoint for debugging and testing inter-script communication
 * Responds to ping messages to verify the background script is responsive
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "ping") {
    // Respond with success status for health checks
    sendResponse({ ok: true });
    // Return true to indicate this is an asynchronous response handler
    return true;
  }
  // Return false for unhandled message types
  return false;
});
