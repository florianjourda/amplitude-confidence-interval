/**
 * @fileoverview This is the code that will run in the context of the content of a page
 * and can interact with the DOM.
 *
 * In manifest.json, we declare that we want this code to run only on the pages matching "https://analytics.amplitude.com/*"
 */

var confidencePercentage,
    jFunnelGroup;
    timeoutId = null;

// Ask settings to the background
chrome.extension.sendMessage({status:'get_settings'}, function(response) {
    console.log('response', response);
    confidencePercentage = response.confidencePercentage;
});

// Run script when page is loaded
$j = jQuery.noConflict();
$j(function() {
    console.log('Starting Amplitude Confidence Interval script.');

    if (!isFunnelPage()) {
        console.log('Not a funnel page. Stopping.');
        return;
    }

    console.log('This is a funnel page. Adding listener to the funnel svg.');
    $j('body').bind('DOMNodeInserted', function(e) {
        if (isFunnelGroup(e.target)) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(drawConfidenceIntervalOnFunnelGroup, 1);
        }
    });
});

function isFunnelPage() {
    // TODO implement
    return true;
}

function isFunnelGroup(element) {
    return $j(element).is('g.highcharts-series');
}

function drawConfidenceIntervalOnFunnelGroup() {
    var jFunnelGroup = $j('g.highcharts-series.highcharts-series-1.highcharts-tracker'),
        jDataLabelsGroup = $j('g.highcharts-data-labels.highcharts-series-1.highcharts-tracker'),
        jFunnelParentSVG = $j(jFunnelGroup.attr('clip-path').match(/url\((.*)\)/)[1]).parents('svg');
    //jFunnelParentSVG.parent().html(jFunnelParentSVG.parent().html());
    // $j("body").html($j("body").html());
    var funnelValues = getFunnelValues(jDataLabelsGroup);
    console.log('Found funnel', jFunnelGroup.get(0), 'with values', funnelValues);
}

function getFunnelValues(jDataLabelsGroup) {
    return jDataLabelsGroup.find('tspan').map(function(){return this.innerHTML}).toArray();
}
