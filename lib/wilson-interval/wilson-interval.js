var wilsonInterval;
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
wilsonInterval = require('wilson-interval');

},{"wilson-interval":4}],2:[function(require,module,exports){
module.exports = require('./lib/pnormaldist');

},{"./lib/pnormaldist":3}],3:[function(require,module,exports){
/*
 * This module is an extra from statistics2, which includes many more
 * statistical codes for you to explore.
 */
(function () {
    /* inverse of normal distribution */
    var pnormaldist = function (qn) {
        var b = [1.570796288, 0.03706987906, -0.8364353589e-3,
                -0.2250947176e-3, 0.6841218299e-5, 0.5824238515e-5,
                -0.104527497e-5, 0.8360937017e-7, -0.3231081277e-8,
                0.3657763036e-10, 0.6936233982e-12],
            w1 = qn,
            w3 = -Math.log(4.0 * w1 * (1.0 - w1)),
            i = 1;

        if (qn < 0.0 || qn > 1.0) { return 0.0; }
        if (qn === 0.5) { return 0.0; }
        if (qn > 0.5) { w1 = 1.0 - w1; }

        w1 = b[0];
        for (i; i < 11; i++) {
            w1 += b[i] * Math.pow(w3, i);
        }

        if (qn > 0.5) { return Math.sqrt(w1 * w3); }

        return -Math.sqrt(w1 * w3);
    };

    module.exports = pnormaldist;
})();

},{}],4:[function(require,module,exports){
// index.js

// Dependencies
var pnormaldist = require('pnormaldist');

// Standard Wilson score interval
function wilson_standard(p, n, z) {

    var high 	= ((p+((z*z)/(2*n))) + (z*Math.sqrt(((p*(1-p))/n)+((z*z)/(4*(n*n))))) ) / (1+((z*z)/n));
    var low 	= ((p+((z*z)/(2*n))) - (z*Math.sqrt(((p*(1-p))/n)+((z*z)/(4*(n*n))))) ) / (1+((z*z)/n));
    var center 	= ((p+((z*z)/(2*n))) / (1+((z*z)/n)));

    var interval = {
        high: high,
        center: center,
        low: low
    }

    return interval;
}

// Wilson score interval with continuity correction
function wilson_continuity(p, n, z) {

    var high 	= (((2*n*p)+(z*z) + (z*Math.sqrt((z*z)-(1/n)+(4*n*p*(1-p)) - (4*p-2))+1)) / (2*(n+(z*z))));
    var low 	= (((2*n*p)+(z*z) - (z*Math.sqrt((z*z)-(1/n)+(4*n*p*(1-p)) + (4*p-2))+1)) / (2*(n+(z*z))));
    var center 	= (((2*n*p)+(z*z)) / (2*(n+(z*z))));

    var interval = {
        high: high,
        center: center,
        low: low
    }

    return interval;
}

/*
 * credit: Sean Wallis, Survey of English Usage, University College of London
 * source: https://corplingstats.wordpress.com/2012/04/30/inferential-statistics/
 */
module.exports = function(f, n, c, N, continuity) {

    var p 	= f/n;				// proportion of positive outcomes
        N 	= N || false; 		// population size

    if (N) {							// if population size given:
        var v 	= Math.sqrt(1-n/N);		// determine scale factor
            n 	= n/v; 					// and adjust sample size
    }

		c 	= c || 0.95;		// confidence level, defaults to 95%

	var z 	= pnormaldist(1 - (1 - c) / 2); // calculate z-score: http://www.evanmiller.org/how-not-to-sort-by-average-rating.html

    if (continuity) return wilson_continuity(p, n, z);

    return wilson_standard(p, n, z);
};

},{"pnormaldist":2}]},{},[1]);
