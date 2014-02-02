#!/usr/bin/env node
/**
 * Builds a structure in dist/ that is a compressed version of the application, for deployment
 */
var fs = require('fs-extra');

var ROOT = process.argv[2] + '/platforms/' + process.env.CORDOVA_PLATFORMS + '/assets';
var DIST = ROOT + '/www/';
var SRC = ROOT + '/www-orig/';

//fs.removeSync(DIST);
fs.removeSync(SRC);

