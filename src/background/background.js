/**
 * @fileoverview This is the code that runs in the background, as one instance for all Chrome tabs.
 *
 * This can communicate with the 'content.js' script that runs on each page
 * matching "https://analytics.amplitude.com/*".
 */

/**
 * Listen to the content script
 */
chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('request', request);
    var tabId = sender.tab.id,
        confidenceLevel = localStorage.getItem('confidenceLevel') || 95;

    function updateIcon() {
         // Show page action icon in address bar
        chrome.pageAction.show(tabId);
        chrome.pageAction.setTitle({tabId: tabId, title: 'Adds confidence intervals of ' + confidenceLevel + '%'});
    }

    // First signal from the content page when it's loading
    if (request.status === 'getSettings') {
        updateIcon();
        sendResponse({
            'confidenceLevel': confidenceLevel,
        });
    } else if (request.status === 'storeConfidenceLevel') {
        confidenceLevel = request.confidenceLevel;
        localStorage.setItem('confidenceLevel', confidenceLevel);
        updateIcon();
        sendResponse('success');
    } else {
        sendResponse('error');
    }
});
