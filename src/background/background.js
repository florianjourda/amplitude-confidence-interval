/**
 * @fileoverview This is the code that runs in the background, as one instance for all Chrome tabs.
 *
 * This can communicate with the 'content.js' script that runs on each page matching https://www.linkedin.com/*"
 *
 * Note that we need to keep track of the state data from each tab separately.
 */
var settings = new Store('settings');

var iconBackgroundImageSrc = 'icons/32x32.png',
    confidencePercentage;

/**
 * Listen to the content script
 */
chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('request', request);
    var tabId = sender.tab.id,
        confidencePercentage = settings.get('confidencePercentage');

    // First signal from the content page when it's loading
    if (request.status === 'get_settings') {
        // Show page action icon in address bar
        chrome.pageAction.show(tabId);
        chrome.pageAction.setTitle({tabId: tabId, title: 'Using confidence percentage of ' + confidencePercentage + '%'});
        sendResponse({
            'confidencePercentage': confidencePercentage
        });
    } else {
        sendResponse('error');
    }
});

console.log('Setup clicked page action.');

/**
 * Listen to the user clicking on the page action icon in the address bar
 */
chrome.pageAction.onClicked.addListener(function(tab) {
    console.log('onClicked');
    // Open settings
    chrome.tabs.create({url: 'src/options/index.html'});
});
