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
            timeoutId = setTimeout(calculateAndDrawConfidenceIntervals, 100);
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

function calculateAndDrawConfidenceIntervals() {
    var jDataLabelsGroup = $j('g.highcharts-data-labels.highcharts-series-1.highcharts-tracker'),
        funnelValues = getFunnelValues(jDataLabelsGroup),
        confidenceIntervals = getConfidenceIntervals(funnelValues),
        jFunnelGroup = $j('g.highcharts-series.highcharts-series-1.highcharts-tracker');
    console.log('Found funnel', jFunnelGroup.get(0), 'with values', funnelValues, 'and intervals', confidenceIntervals);
    drawConfidenceIntervals(confidenceIntervals, jFunnelGroup);
}

function getFunnelValues(jDataLabelsGroup) {
    return jDataLabelsGroup.find('tspan').map(function(){return this.innerHTML}).toArray();
}

function getConfidenceIntervals(funnelValues) {
    // First value is the total number of the population.
    var N = funnelValues[0],
        confidenceIntervals = [];
    for (var i = 1; i < funnelValues.length; i++) {
        var S = funnelValues[i],
            confidenceInterval = wilsonInterval(S, N, confidencePercentage / 100);
        confidenceIntervals.push(confidenceInterval);
    }
    return confidenceIntervals;
}

function drawConfidenceIntervals(confidenceIntervals, jFunnelGroup) {
    var jRects = jFunnelGroup.children(),
        baseJRect = jRects.first(),
        nextJRects = jRects.slice(1),
        baseY = parseFloat(baseJRect.attr('y')),
        baseHeight = parseFloat(baseJRect.attr('height')),
        baseWidth = parseFloat(baseJRect.attr('width'));
    nextJRects.each(function(i) {
        var jRect = $j(this);
            newJRect = jRect.clone(),
            confidenceInterval = confidenceIntervals[i],
            y1 = baseY + (1 - confidenceInterval.high) * baseHeight,
            y2 = baseY + (1 - confidenceInterval.low) * baseHeight,
            centerX = parseFloat(jRect.attr('x')) + baseWidth / 2,
            width = baseWidth / 2,
            x1 = centerX - width / 2,
            x2 = centerX + width / 2;
        newJRect.attr({
            'x': x1,
            'y': y1,
            'width': x2 - x1,
            'height': y2 - y1,
            'fill': shadeColor2(jRect.attr('fill'), -0.2),
        });
        jRect.after(newJRect);
    });
}

// http://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors
function shadeColor2(color, percent) {
    var f=parseInt(color.slice(1),16),t=percent<0?0:255,p=percent<0?percent*-1:percent,R=f>>16,G=f>>8&0x00FF,B=f&0x0000FF;
    return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
}
