/**
 * Compresses the entire app, by reading index.html and driving decisions from that
 */

var path = require('path');
var q = require('q');
var fs = require('fs');
var less = require('less');
var compressor = require('node-minify');
var htmlminify = require('html-minifier').minify;
var htmlminifyOptions = {
  collapseWhitespace : true,
  removeComments : true
};

function findFiles(root, ext) {

  var entries = fs.readdirSync(root);
  var out = entries.filter(function(v) {
    return v.lastIndexOf(ext) > 0 && v.lastIndexOf(ext) === v.length - (ext.length);
  }).map(function(v) {
    return root +path.sep+v;
  });

  entries.filter(function(v) {
    return fs.statSync(root + path.sep + v).isDirectory()
  }).forEach(function(dir) {
    out = out.concat(findFiles(root + path.sep + dir, ext))
  });

  return out;
}

function readHTML(srcRoot, destRoot, ver, name) {
  name = name || 'index.html';

  var html = (''+fs.readFileSync(srcRoot + 'index.html'));
  html = html.replace(/<!--EXCLUDE-->([\n]|.)*?<!--EXCLUDE-->/mg,'');

  var parts = html.split('<!--COMPRESS-->');
  var resources = parts[1];
  parts[1] = '<link rel="stylesheet" href="style.css?v=%%"/><script src="script.js?v=%%"></script>'.replace(/%%/g, ver);

  //Write new HTML file out
  fs.writeFileSync(destRoot + "/index.html", htmlminify(parts.join('\n'), htmlminifyOptions));

  return {
    resources : resources,
    src : srcRoot,
    dest : destRoot,
    version : ver,
    promises : [],
    styles : [],
    scripts : []
  }
}

function buildStyles(conf) {
  //Process LINK tags
  conf.resources.replace(/<link\s+rel="([^"]+)"\s+href="([^"]+)"/g, function(all, rel, href) {
    console.log('Style: ', rel, href);
    if (rel === 'stylesheet/less') {
      var parser = new(less.Parser)({
        paths: [conf.src, conf.src + 'less'], // Specify search paths for @import directives
        filename: href      // Specify a filename, for better error messages
      });
      var out = conf.dest+(href.replace(/\//g,'_').replace('.less', '.css'));
      var txt = ''+fs.readFileSync(conf.src+href);
      var def = q.defer();
      conf.promises.push(def.promise);
 
      parser.parse(txt, function(e, tree) {
        if (e) {
          def.reject(e);
        } else {
          fs.writeFileSync(out, tree.toCSS());
          def.resolve();
        }
      });
      conf.styles.push(out);
    } else {
      conf.styles.push(conf.src+href);
    }
  });
}

function buildScripts(conf) {
  //Process SCRIPT tags
  conf.resources.replace(/<script\s+src="([^"]+)"/g, function(all, src) {
    console.log('Script: ', src);
    conf.scripts.push(conf.src + src);
  });
}

//Process VIEWs
function buildViews(conf) {
  var views = {};
  findFiles(conf.src + 'html','.html').map(function(v) {
    console.log('View:', v);
    views[v.replace(conf.src,'')] = htmlminify(''+fs.readFileSync(v), htmlminifyOptions);
  });
  var name = conf.dest + '/templates.js'; 
  conf.scripts.push(name);
  fs.writeFileSync(name, '(function() { var templates = ' + JSON.stringify(views)+'; ' +
    'window.preloadTemplates = function(reg) { for (var k in templates) { reg(k, templates[k]); } }; })()');
}

function serialize(conf) {
  //Compress JavasScript
  new compressor.minify({
    type: 'gcc',
    language: 'ECMASCRIPT5',
    fileIn : conf.scripts,
    fileOut : conf.dest + 'script.js',
    callback : function (err, min) {
      console.log(err);
    }
  });

  //Compress CSS
  new compressor.minify({
    type: 'yui-css',
    fileIn: conf.styles,
    fileOut: conf.dest + 'style.css',
    callback: function(err, min){
      console.log(err);
    }
  });
}

module.exports = function(srcRoot, destRoot, ver) {   
  var html = readHTML(srcRoot, destRoot, ver||(''+new Date().getTime()));
  buildStyles(html);
  buildScripts(html);
  buildViews(html);
  q.allSettled(html.promises).then(function() {
    serialize(html);
  });
};
