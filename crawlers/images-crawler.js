'use strict';

var webpage = require('webpage'),
  system = require('system'),
  page = webpage.create(),
  url = system.args[1];

page.open(url, function () {
  var images = page.evaluate(function () {
    return Array.prototype.filter.call(document.querySelectorAll('a'), function (anchor) {
      var fragments = anchor.href.split('.');
      return fragments.pop() === 'jpg' && !/hq|crop/.test(fragments.pop());
    }).map(function (anchor) {
      return anchor.href;
    });
  });

  console.log(JSON.stringify(images));

  phantom.exit();
});
