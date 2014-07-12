'use strict';

var webpage, system, page, url;

webpage = require('webpage');
system = require('system');
page = webpage.create();
url = system.args[1];

page.open(url, function () {
  var images;

  images = page.evaluate(function () {
    return Array.prototype.filter.call(document.querySelectorAll('a'), function (anchor) {
      var fragments;
      fragments = anchor.href.split('.');
      return fragments.pop() === 'jpg' && !/hq|crop/.test(fragments.pop());
    }).map(function (anchor) {
      return anchor.href;
    });
  });

  console.log(JSON.stringify(images));

  phantom.exit();
});
