#! /usr/bin/env node

'use strict';

var fs, path, childProcess;

fs = require('fs');
path = require('path');
childProcess = require('child_process');

var multiline, clc, docopt, phantomjs, http, mkdirp, Q;

multiline = require('multiline');
clc = require('cli-color');
docopt = require('docopt').docopt;
phantomjs = require('phantomjs');
http = require('http-get');
mkdirp = require('mkdirp');
Q = require('kew');

var doc, pkg, options, type, override, source, dest, urlsCrawler, setsDownloads;

doc = multiline(function () {/*
  Download `Magic The Gathering` card’s data.

  Usage: dlmtg [<dest>] [options]

  -h --help               Show this.
  -v --version            Show version number.
  -o --override           Replace existing data in dest.
  -t --type (image|json)  Type of data to download (mandatory).
*/});

pkg = require('./package.json');
options = docopt(doc, {version: pkg.version});

type = options['--type'] || options['-t'];
override = options['--override'] || options['-o'];

if (type === 'image') {
  source = 'http://mtgimage.com/actual/set/';
} else if (type === 'json') {
  source = 'http://mtgjson.com/json/';
} else if (typeof type === 'string') {
  return log(clc.red('The type option must be set to image or json'));
} else {
  return log(clc.red('The type option is missing'));
}

dest = options.dest || path.join(__dirname, 'downloads', type);

urlsCrawler = path.join(__dirname, 'crawlers', 'urls-crawler.js');
setsDownloads = Q.defer();

childProcess.execFile(phantomjs.path, [urlsCrawler, source], function (oO, stdout) {
  if (oO) setsDownloads.reject(oO);
  else setsDownloads.resolve(JSON.parse(stdout));
});

setsDownloads.then(function (setsUrls) {
  return setsUrls.reduce(function (all, setUrl) {
    return all.then(function () {
      if (type === 'json') return downloadAsJson(setUrl, dest);
      if (type === 'image') return downloadAsImage(setUrl, dest);
    });
  }, Q.resolve());
}).then(function () {
  log(clc.green('done'));
}).fail(function (oO) {
  log(clc.red(oO.message));
});

function downloadAsJson(setUrl, dest) {
  var setDownload, filename, basename, then;

  setDownload = Q.defer();

  if (path.extname(setUrl) === '.zip') {
    setDownload.resolve();
  } else {
    filename = path.basename(setUrl, '.json').toUpperCase();
    basename = path.basename(setUrl);

    then = function then(oO) {
      if (oO) return setDownload.reject(oO);

      log('  ' + clc.green('downloaded') + ' ' + setUrl);

      setDownload.resolve();
    };

    log('download set ' + clc.magenta(filename));

    fs.exists(path.join(dest, basename), function (exists) {
      if (exists && !override) return then(null);

      mkdirp(dest, function (oO) {
        if (oO) return setDownload.reject(oO);

        http.get(setUrl, path.join(dest, basename), then);
      });
    });
  }

  return setDownload.promise;
}

function downloadAsImage(setUrl, dest) {
  var setDownload, dirname;

  setDownload = Q.defer();
  dirname = path.basename(setUrl).toUpperCase();

  mkdirp(path.join(dest, dirname), function (oO) {
    if (oO) return setDownload.reject(oO);

    log('download set ' + clc.magenta(dirname));

    childProcess.execFile(phantomjs.path, [path.join(__dirname, 'crawlers', 'images-crawler.js'), setUrl], function (oO, stdout) {
      var cardsUrls;

      if (oO) return setDownload.reject(oO);

      cardsUrls = JSON.parse(stdout);

      Q.all(cardsUrls.map(function (cardUrl) {
        var cardName, cardDownload, then;

        cardName = decodeURIComponent(path.basename(cardUrl));
        cardDownload = Q.defer();

        then = function then(oO) {
          if (oO) return cardDownload.reject(oO);

          log('    ' + clc.green('downloaded') + ' ' + cardUrl);

          cardDownload.resolve();
        };

        log('  download card ' + clc.magenta(cardName));

        fs.exists(path.join(dest, dirname, cardName), function (exists) {
          if (exists && !override) return then(null);

          http.get(cardUrl, path.join(dest, dirname, cardName), then);
        });

        return cardDownload.promise;
      })).then(function () {
        log('  ' + clc.green('downloaded') + ' ' + setUrl);
        setDownload.resolve();
      }, function () {
        setDownload.reject();
      });
    });
  });

  return setDownload.promise;
}

function log(message) {
  console.log(clc.bgBlack('dlmgt') + ' ' + message);
}
