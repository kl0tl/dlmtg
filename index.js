#! /usr/bin/env node

'use strict';

var fs, path, childProcess, clc, docopt, phantomjs, http, mkdirp, Q;

fs = require('fs');
path = require('path');
childProcess = require('child_process');

clc = require('cli-color');
docopt = require('docopt').docopt;
phantomjs = require('phantomjs');
http = require('http-get');
mkdirp = require('mkdirp');
Q = require('kew');

fs.readFile('./README.md', {encoding: 'utf8'}, function (oO, doc) {
  var pkg, options, type, source, dest, urlsCrawler, setsDownloads;

  if (oO) return console.log(clc.red(oO));

  pkg = require('./package.json');
  options = docopt(doc, {version: pkg.version});

  type = options['--type'] || options['-type'];

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
});

function downloadAsJson(setUrl, dest) {
  var setDownload, dir;

  setDownload = Q.defer();

  if (path.extname(setUrl) === '.zip') {
    setDownload.resolve();
  } else {
    dir = path.basename(setUrl, '.json').toUpperCase();

    log('download set ' + clc.magenta(dir));

    mkdirp(dest, function (oO) {
      if (oO) return setDownload.reject(oO);

      http.get(setUrl, path.join(dest, path.basename(setUrl)), function (oO) {
        if (oO) return setDownload.reject(oO);

        log('  ' + clc.green('downloaded') + ' ' + setUrl);

        setDownload.resolve();
      });
    });
  }

  return setDownload.promise;
}

function downloadAsImage(setUrl, dest) {
  var setDownload, dir;

  setDownload = Q.defer();
  dir = path.basename(setUrl).toUpperCase();

  mkdirp(path.join(dest, dir), function (oO) {
    if (oO) return setDownload.reject(oO);

    log('download set ' + clc.magenta(dir));

    childProcess.execFile(phantomjs.path, [path.join(__dirname, 'crawlers', 'images-crawler.js'), setUrl], function (oO, stdout) {
      var cardsUrls;

      if (oO) return setDownload.reject(oO);

      cardsUrls = JSON.parse(stdout);

      Q.all(cardsUrls.map(function (cardUrl) {
        var cardName, cardDownload;

        cardDownload = decodeURIComponent(path.basename(cardUrl));
        cardDownload = Q.defer();

        log('  download card ' + clc.magenta(cardUrl));

        http.get(cardUrl, path.join(dest, dir, cardName), function (oO) {
          if (oO) return cardDownload.reject(oO);

          log('    ' + clc.green('downloaded') + ' ' + cardUrl);

          cardDownload.resolve();
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
