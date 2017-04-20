/**
 * @fileoverview This is the code that will run in the context of the content of a page
 * and can interact with the DOM.
 *
 * In manifest.json, we declare that we want this code to run only on the pages matching "https://analytics.amplitude.com/*"
 */

// Matches '100% (107 of 107)', '11.2% (12,011 of 107,123)'
var FUNNEL_CONVERSION_TEXT_REGEX = /^(\d+\.?\d?)% \(([\d,]+) of ([\d,]+)\)/,
// Matches '80', '80%', '80 %', '.8', '0.8'
    PERCENTAGE_INPUT_REGEX = /^(\d+(\.\d+)?|\.\d+)\s*%?$/,
    confidenceLevel,
    timeoutId = null,
    shouldCalculateAndDrawConfidenceIntervals = false,
    wasDOMNodeInsertedSinceLastCheck = false,
    $j = jQuery.noConflict();

// Run script when page is loaded
$j(function() {
    if (!isFunnelPage()) {
        return;
    }

    // Ask settings to the background
    chrome.extension.sendMessage({status:'getSettings'}, function(response) {
        confidenceLevel = response.confidenceLevel;
        console.log('Will add confidence interval with confidence level of ' +
            confidenceLevel + '% to Amplitude funnels');
    });

    // TODO: check that this test does not slow down the UI too much
    $j('body').bind('DOMNodeInserted', function(e) {
        var tagName = e.target.tagName;

        // Check if tooltip with funnel conversion text was displayed
        if (tagName === 'DIV') {
            var jB = $j(e.target).find('b');
            if (jB.length && isFunnelConversionTooltipText(jB)) {
                updateAndKeepUpdatedFunnelConversionTooltipText(jB);
            }
        }

        // Check if funnel was drawn in SVG
        wasDOMNodeInsertedSinceLastCheck = true;
        if (tagName === 'g' && isSeriesGroup(e.target)) {
            calculateAndDrawConfidenceIntervalsWhenNoMoreDOMInsertion();
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

function updateAndKeepUpdatedFunnelConversionTooltipText(jB) {
    // We listen to future changes in the text to update it again
    var DOMSubtreeModifiedHandler;
    DOMSubtreeModifiedHandler = function() {
        jB.off('DOMSubtreeModified', DOMSubtreeModifiedHandler)
        // Avoid infinite recursion of subtree modification by doing the modification after
        // the event listener really has the time to be removed.
        setTimeout(function() {
            updateFunnelConversionTooltipText(jB);
            jB.on('DOMSubtreeModified', DOMSubtreeModifiedHandler);
        }, 1);
    }
    DOMSubtreeModifiedHandler();
}

function updateFunnelConversionTooltipText(jB) {
    // No confidence interval has to be drawn for the base step of funnel (100% base).
    if (IsTooltipOnFunnelBaseStep(jB)) {
        return;
    }

    matches = jB.text().match(FUNNEL_CONVERSION_TEXT_REGEX)
    var firstLine = matches[0],
        percent = parseFloat(matches[1]),
        s = parseIntWithComma(matches[2]),
        n = parseIntWithComma(matches[3]),
        confidenceInterval = wilsonInterval(s, n, confidenceLevel / 100),
        lowerBound = decimalRound(confidenceInterval.low * 100, 1),
        higherBound = decimalRound(confidenceInterval.high * 100, 1);
    jB.html(firstLine + '<br>' +
        lowerBound + '% - ' + higherBound + '% ' +
        '(at <a href="#" style="color:inherit">' + confidenceLevel + '%</a> confidence)');
    jB.find('a').on('click', function(e) {
        confidenceLevel = promptConfidenceLevel();
        storeConfidenceLevel(confidenceLevel);
        updateFunnelConversionTooltipText(jB);
        calculateAndDrawConfidenceIntervals();
        e.preventDefault();
    });
    return true;
}

/**
 * Tells if the given bold text is part of the tooltip that appears when the mouse
 * is over one of the steps.
 */
function isFunnelConversionTooltipText(jB) {
    return !!jB.text().match(FUNNEL_CONVERSION_TEXT_REGEX);
}

function IsTooltipOnFunnelBaseStep(jB) {
    // The first tooltip doesn't have a div telling "Average 12s Since Last Step (Median 8s)"
    // TODO: make this check less brittle
    var divWithAverage = jB.parent().parent().next();
    return divWithAverage.length === 0;
}

function promptConfidenceLevel() {
    var newConfidenceLevel = prompt('What confidence level do want to use for the confidence intervals ? (0% to 100%)', confidenceLevel),
        match = null;
    if (newConfidenceLevel !== null) {
        match = newConfidenceLevel.match(PERCENTAGE_INPUT_REGEX);
    }
    if (!match) {
        return confidenceLevel;
    }
    newConfidenceLevel = parseFloat(match[1]);
    // Correct when user typed .5 instead of 50
    if (newConfidenceLevel <= 1) {
        newConfidenceLevel = 100 * newConfidenceLevel;
    }
    return newConfidenceLevel;
}

function storeConfidenceLevel(confidenceLevel) {
    chrome.extension.sendMessage({
        status: 'storeConfidenceLevel',
        confidenceLevel: confidenceLevel,
    }, function(response) {
        console.log('response', response);
    });
}

function decimalRound(number, precision) {
    var factor = Math.pow(10, precision);
    var tempNumber = number * factor;
    var roundedTempNumber = Math.round(tempNumber);
    return roundedTempNumber / factor;
};

function calculateAndDrawConfidenceIntervalsWhenNoMoreDOMInsertion() {
    // Draw the interval is no more DOM insertion has been done recently (ie DOM is stable)
    if (!wasDOMNodeInsertedSinceLastCheck) {
        calculateAndDrawConfidenceIntervals();
        return;
    }
    wasDOMNodeInsertedSinceLastCheck = false;

    clearTimeout(timeoutId);
    timeoutId = setTimeout(calculateAndDrawConfidenceIntervalsWhenNoMoreDOMInsertion, 100);
}

function calculateAndDrawConfidenceIntervals() {
    console.log('calculateAndDrawConfidenceIntervals');
    removePreviousConfidenceIntervals();
    valuesForEachSeries = getValuesForEachSeries();
    $j.each(valuesForEachSeries, function(seriesIndex, seriesValues) {
        var jSeriesGroup = $j('g.highcharts-series.highcharts-series-' + seriesIndex + '.highcharts-tracker');
            confidenceIntervals = getConfidenceIntervals(seriesValues),
            //console.log('Found series', jSeriesGroup.get(0), 'with values', seriesValues, 'and intervals', confidenceIntervals);
        drawConfidenceIntervals(confidenceIntervals, jSeriesGroup);
    });
}

function removePreviousConfidenceIntervals() {
    $j('rect.confidence-interval').remove();
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
    return jDataLabelsGroup.find('tspan').map(function(){
        return parseIntWithComma(this.innerHTML);
    }).toArray();
}

// Converts '10,203' to 10203
function parseIntWithComma(numberAsString) {
    return parseInt(numberAsString.replace(',',''), 10);
}

function getConfidenceIntervals(seriesValues) {
    // First value is the total number of the population.
    var n = seriesValues[0],
        confidenceIntervals = [];
    for (var i = 1; i < seriesValues.length; i++) {
        var s = seriesValues[i],
            // TODO: deal with 100 confidenceLevel with return NaN
            confidenceInterval = wilsonInterval(s, n, confidenceLevel / 100);
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
            'class': 'confidence-interval',
            x: x1,
            y: y1,
            width: x2 - x1,
            height: y2 - y1,
            fill: shadeColor2(jRect.attr('fill'), -0.2),
        });
        jRect.after(newJRect);
    });
}

// http://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors
function shadeColor2(color, percent) {
    var f=parseInt(color.slice(1),16),t=percent<0?0:255,p=percent<0?percent*-1:percent,R=f>>16,G=f>>8&0x00FF,B=f&0x0000FF;
    return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
}
