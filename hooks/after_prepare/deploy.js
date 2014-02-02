#!/usr/bin/env node
/**
 * Builds a structure in dist/ that is a compressed version of the application, for deployment
 */
var fs = require('fs-extra');

var ROOT = process.argv[2] + '/platforms/' + process.env.CORDOVA_PLATFORMS + '/assets';
var DIST = ROOT + '/www/';
var SRC = ROOT + '/www-orig/';
var v = new Date().getTime();

try {
  fs.removeSync(SRC);
} catch (e) {
}

try {
  fs.renameSync(DIST, SRC);
} catch (e) {
}
fs.mkdirpSync(DIST);

var staticResources = ['/data', '/components/booststrap/fonts', '/img', 'cordova.js', 'codorva_plugins.json', '/plugins'];
staticResources.forEach(function(p) {
   fs.copy(SRC+p, DIST + p);
})

require('./compress')(SRC,DIST);

