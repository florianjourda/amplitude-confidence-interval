/**
 * @fileoverview This is the code that runs in the background, as one instance for all Chrome tabs.
 *
 * This can communicate with the 'content.js' script that runs on each page matching https://www.linkedin.com/*"
 *
 * Note that we need to keep track of the state data from each tab separately.
 */
var iconBackgroundImageSrc = 'icons/32x32.png';

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
