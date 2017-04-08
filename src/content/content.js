/**
 * @fileoverview This is the code that will run in the context of the content of a page
 * and can interact with the DOM.
 *
 * In manifest.json, we declare that we want this code to run only on the pages matching "https://analytics.amplitude.com/*"
 */

// Matches '100% (107 of 107)', '11.2% (12 of 107)'
var FUNNEL_CONVERSION_TEXT_REGEX = /^(\d+\.?\d?)% \((\d+) of (\d+)\)/,
// Matches '80', '80%', '80 %', '.8', '0.8'
    PERCENTAGE_INPUT_REGEX = /^(\d+(\.\d+)?|\.\d+)\s*%?$/,
    confidencePercentage,
    timeoutId = null,
    $j = jQuery.noConflict();

// Ask settings to the background
chrome.extension.sendMessage({status:'get_settings'}, function(response) {
    console.log('response', response);
    confidencePercentage = response.confidencePercentage;
});

// Run script when page is loaded
$j(function() {
    console.log('Starting Amplitude Confidence Interval script.');

    if (!isFunnelPage()) {
        console.log('Not a funnel page. Stopping.');
        return;
    }

    console.log('This is a funnel page. Adding listener to the funnel svg.');
    // TODO: check that this test doesnot slow down the UI too much
    $j('body').bind('DOMNodeInserted', function(e) {
        var tagName = e.target.tagName;

        // Check if popup with funnel conversion text was displayed
        if (tagName === 'DIV') {
            // TODO: do not do this on the first step of the funnel
            var jB = $j(e.target).find('b');
            if (jB.length && isFunnelConversionPopupText(jB)) {
                updateAndKeepUpdatedFunnelConversionPopupText(jB);
            }
        }

        // Check if funnel was drawn in SVG
        if (tagName === 'g' && isSeriesGroup(e.target)) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(calculateAndDrawConfidenceIntervals, 100);
        }
    });
});

function isFunnelPage() {
    // TODO implement
    return true;
}

function isSeriesGroup(element) {
    return $j(element).is('g.highcharts-series');
}

function isFunnelConversionPopupText(jB) {
    return !!jB.text().match(FUNNEL_CONVERSION_TEXT_REGEX);
}

function updateAndKeepUpdatedFunnelConversionPopupText(jB) {
    // We listen to future changes in the text to update it again
    var DOMSubtreeModifiedHandler;
    DOMSubtreeModifiedHandler = function() {
        jB.off('DOMSubtreeModified', DOMSubtreeModifiedHandler)
        // Avoid infinite recursion of subtree modification by doing the modification after
        // the event listener really has the time to be removed.
        setTimeout(function() {
            updateFunnelConversionPopupText(jB);
            jB.on('DOMSubtreeModified', DOMSubtreeModifiedHandler);
        }, 1);
    }
    DOMSubtreeModifiedHandler();
}

function updateFunnelConversionPopupText(jB) {
    matches = jB.text().match(FUNNEL_CONVERSION_TEXT_REGEX)
    console.log(jB.text(), matches);
    var firstLine = matches[0],
        percent = parseFloat(matches[1]),
        s = parseInt(matches[2], 10),
        n = parseInt(matches[3], 10),
        confidenceInterval = wilsonInterval(s, n, confidencePercentage / 100),
        lowerBound = decimalRound(confidenceInterval.low * 100, 1),
        higherBound = decimalRound(confidenceInterval.high * 100, 1);
    jB.html(firstLine + '<br>' +
        lowerBound + '% - ' + higherBound + '% ' +
        '(at <a href="#" style="color:inherit">' + confidencePercentage + '%</a> confidence)');
    jB.find('a').on('click', function(e) {
        confidencePercentage = promptConfidencePercentage();
        updateFunnelConversionPopupText(jB);
        e.preventDefault();
    });
    return true;
}

function promptConfidencePercentage() {
    var newConfidancePercentage = prompt('What confidence level do want to use for the confidence intervals ? (0% to 100%)', confidencePercentage),
        match = null;
    if (newConfidancePercentage !== null) {
        match = newConfidancePercentage.match(PERCENTAGE_INPUT_REGEX);
    }
    if (!match) {
        return confidencePercentage;
    }
    newConfidancePercentage = parseFloat(match[1]);
    // Correct when user typed .5 instead of 50
    if (newConfidancePercentage <= 1) {
        newConfidancePercentage = 100 * newConfidancePercentage;
    }
    return newConfidancePercentage;
}

function decimalRound(number, precision) {
    var factor = Math.pow(10, precision);
    var tempNumber = number * factor;
    var roundedTempNumber = Math.round(tempNumber);
    return roundedTempNumber / factor;
};

var a, b, c;
function calculateAndDrawConfidenceIntervals() {
    a = null;
    b = null;
    c = null;
    console.log('calculateAndDrawConfidenceIntervals');
    valuesForEachSeries = getValuesForEachSeries();
    $j.each(valuesForEachSeries, function(seriesIndex, seriesValues) {
        var jSeriesGroup = $j('g.highcharts-series.highcharts-series-' + seriesIndex + '.highcharts-tracker');
            confidenceIntervals = getConfidenceIntervals(seriesValues),
            //console.log('Found series', jSeriesGroup.get(0), 'with values', seriesValues, 'and intervals', confidenceIntervals);
        drawConfidenceIntervals(confidenceIntervals, jSeriesGroup);
    });
}

function getValuesForEachSeries() {
    var jDataLabelsGroups = $j('g.highcharts-data-labels.highcharts-tracker'),
        valuesForEachSeries = {};
    jDataLabelsGroups.each(function() {
        var jDataLabelsGroup = $j(this),
            seriesIndex = jDataLabelsGroup.attr('class').match(/highcharts-data-labels highcharts-series-([0-9]+) highcharts-tracker/)[1],
            seriesValues = getSeriesValues(jDataLabelsGroup);
        valuesForEachSeries[seriesIndex] = seriesValues;
    });
    return valuesForEachSeries;
}

function getSeriesValues(jDataLabelsGroup) {
    c = c || jDataLabelsGroup.find('tspan').slice(1).first();
    return jDataLabelsGroup.find('tspan').map(function(){return this.innerHTML}).toArray();
}

function getConfidenceIntervals(seriesValues) {
    // First value is the total number of the population.
    var n = seriesValues[0],
        confidenceIntervals = [];
    for (var i = 1; i < seriesValues.length; i++) {
        var s = seriesValues[i],
            // TODO: deal with 100 confidencePercentage with return NaN
            confidenceInterval = wilsonInterval(s, n, confidencePercentage / 100);
        confidenceIntervals.push(confidenceInterval);
    }
    return confidenceIntervals;
}

function drawConfidenceIntervals(confidenceIntervals, jSeriesGroup) {
    var jRects = jSeriesGroup.children(),
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
        a = a || jRect;
        b = b || newJRect;
    });
}

// http://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors
function shadeColor2(color, percent) {
    var f=parseInt(color.slice(1),16),t=percent<0?0:255,p=percent<0?percent*-1:percent,R=f>>16,G=f>>8&0x00FF,B=f&0x0000FF;
    return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
}
