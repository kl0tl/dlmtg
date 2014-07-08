'use strict';

var webpage = require('webpage'),
  system = require('system'),
  page = webpage.create(),
  url = system.args[1];

page.open(url, function () {
  var urls = page.evaluate(function () {
    return Array.prototype.map.call(document.querySelectorAll('a'), function (anchor) {
      return anchor.href;
    });
  });

  console.log(JSON.stringify(urls.slice(1)));

  phantom.exit();
});
