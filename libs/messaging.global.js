(function() {
  try {
    var root = (typeof window !== 'undefined') ? window : (typeof self !== 'undefined' ? self : this);
    if (root.__ArticleDocMessaging) return;

    function queryTabs(queryInfo) {
      return new Promise(function(resolve, reject) {
        try {
          chrome.tabs.query(queryInfo, function(tabs) {
            var err = chrome.runtime && chrome.runtime.lastError;
            if (err) return reject(new Error(err.message || 'tabs.query failed'));
            resolve(tabs);
          });
        } catch (e) { reject(e); }
      });
    }

    function executeScriptMV2(tabId, file) {
      return new Promise(function(resolve, reject) {
        try {
          chrome.tabs.executeScript(tabId, { file: file }, function() {
            var err = chrome.runtime && chrome.runtime.lastError;
            if (err) return reject(new Error(err.message || 'executeScript failed'));
            resolve();
          });
        } catch (e) { reject(e); }
      });
    }

    function ensureContentScripts(tabId) {
      try { if (root.__ArticleDocLogger) root.__ArticleDocLogger.info('Injecting content scripts into active tab (fallback)'); } catch (_) {}
      return executeScriptMV2(tabId, 'providers.js')
        .catch(function(){})
        .then(function(){ return executeScriptMV2(tabId, 'content.js'); })
        .then(function(){ return new Promise(function(r){ setTimeout(r, 100); }); });
    }

    function sendMessageToTab(tabId, message, opts) {
      var timeoutMs = (opts && opts.timeoutMs) || 5000;
      return new Promise(function(resolve, reject) {
        function shouldTryInject(msg) {
          if (!msg) return false;
          var m = String(msg);
          return /Receiving end does not exist|Could not establish connection|The message port closed/i.test(m);
        }

        function attempt(hasRetried) {
          var finished = false;
          var tId = null;
          try {
            chrome.tabs.sendMessage(tabId, message, function(response) {
              var err = chrome.runtime && chrome.runtime.lastError;
              if (tId) { try { clearTimeout(tId); } catch (_) {} }
              if (err) {
                if (!hasRetried && shouldTryInject(err.message)) {
                  ensureContentScripts(tabId)
                    .then(function(){ attempt(true); })
                    .catch(function(injectErr){ reject(new Error((err.message || 'sendMessage failed') + '; inject failed: ' + (injectErr.message || injectErr))); });
                  return;
                }
                reject(new Error(err.message || 'sendMessage failed'));
                return;
              }
              finished = true;
              resolve(response);
            });
            tId = setTimeout(function() {
              if (finished) return;
              if (!hasRetried) {
                ensureContentScripts(tabId)
                  .then(function(){ attempt(true); })
                  .catch(function(e){ reject(new Error('Timed out waiting for content script response; inject failed: ' + (e.message || e))); });
              } else {
                reject(new Error('Timed out waiting for content script response'));
              }
            }, timeoutMs);
          } catch (e) {
            if (!hasRetried && shouldTryInject(e && e.message)) {
              ensureContentScripts(tabId)
                .then(function(){ attempt(true); })
                .catch(function(injectErr){ reject(new Error((e.message || 'sendMessage failed') + '; inject failed: ' + (injectErr.message || injectErr))); });
              return;
            }
            reject(e);
          }
        }
        attempt(false);
      });
    }

    root.__ArticleDocMessaging = {
      queryTabs: queryTabs,
      sendMessageToTab: sendMessageToTab,
      ensureContentScripts: ensureContentScripts
    };
  } catch (_) {}
})();


