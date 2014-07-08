'use strict';

var childProcess, phantomjs, path, stdio, http, mkdirp, Q, options, source, dest, urlsCrawler, setsDownloads;

childProcess = require('child_process');
phantomjs = require('phantomjs');
path = require('path');
stdio = require('stdio');
http = require('http-get');
mkdirp = require('mkdirp');
Q = require('kew');

options = stdio.getopt({
  type: {
    key: 't',
    args: 1,
    description: 'The type of data to download, json or images (mandatory)'
  },
  help: {
    key: 'h'
  }
}, 'dest');

if (options.type === 'image') {
  source = 'http://mtgimage.com/actual/set/';
} else if (options.type === 'json') {
  source = 'http://mtgjson.com/json/';
} else if ('type' in options) {
  throw new Error('The "type" option must be set to "image" or "json"');
} else {
  throw new Error('The "type" option is missing');
}

dest = options.args && options.args[0] || path.join(__dirname, 'downloads', options.type);

urlsCrawler = path.join(__dirname, 'crawlers', 'urls-crawler.js');
setsDownloads = Q.defer();

childProcess.execFile(phantomjs.path, [urlsCrawler, source], function (oO, stdout, stderr) {
  if (oO) setsDownloads.reject(oO);
  else setsDownloads.resolve(JSON.parse(stdout));
});

setsDownloads.then(function (setsUrls) {
  return setsUrls.reduce(function (all, setUrl) {
    return all.then(function () {
      if (options.type === 'json') return downloadAsJson(setUrl);
      if (options.type === 'image') return downloadAsImage(setUrl);
    });
  }, Q.resolve());
}).then(function () {
  console.log('done');
}).fail(function (oO) {
  console.log(oO);
});

function downloadAsJson(setUrl) {
  var setDownload, dir;

  setDownload = Q.defer();

  if (path.extname(setUrl) === '.zip') {
    setDownload.resolve();
  } else {
    dir = path.basename(setUrl, '.json').toUpperCase();

    console.log('download set ' + dir);

    mkdirp(dest, function (oO) {
      if (oO) return setDownload.reject(oO);

      http.get(setUrl, path.join(dest, path.basename(setUrl)), function (oO) {
        if (oO) return setDownload.reject(oO);

        console.log('  ' + setUrl + ' downloaded');

        setDownload.resolve();
      });
    });
  }

  return setDownload.promise;
}

function downloadAsImage(setUrl) {
  var setDownload = Q.defer(),
    dir = path.basename(setUrl).toUpperCase();

  mkdirp(path.join(dest, dir), function (oO) {
    if (oO) return setDownload.reject(oO);

    console.log('download set ' + dir);

    childProcess.execFile(phantomjs.path, [path.join(__dirname, 'crawlers', 'images-crawler.js'), setUrl], function (oO, stdout, stderr) {
      if (oO) return setDownload.reject(oO);

      var cardsUrls = JSON.parse(stdout);

      Q.all(cardsUrls.map(function (cardUrl) {
        var cardName = decodeURIComponent(path.basename(cardUrl)),
          cardDownload = Q.defer();

        console.log('  download card ' + cardUrl);

        http.get(cardUrl, path.join(dest, dir, cardName), function (oO) {
          if (oO) return cardDownload.reject(oO);

          console.log('    ' + cardUrl + ' downloaded');

          cardDownload.resolve();
        });

        return cardDownload.promise;
      })).then(function () {
        setDownload.resolve();
      }, function () {
        setDownload.reject();
      });
    });
  });

  return setDownload.promise;
}
