#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var Q = require('q');
var FXOSConsoleLogs = require('../');
var fxconsole = require('fxconsole');
var FXOSConnect = require('fxos-connect');
var es = require('event-stream');
var colors = require("colors")

var transformResult = function (result) {
  switch (result.type) {
    case "undefined":
      return undefined;
    case "null":
      return null;
  }
  return result;
}

var opts = require("nomnom")
  .option('manifestURL', {
    position: 0,
    help: "App manifest.webapp to deploy",
    list: false
  })
  .option('port', {
    abbr: 'p',
    help: 'Port of FirefoxOS'
  })
  .option('logs', {
    flag: true,
    help: 'Print the console logs'
  })
  .option('errors', {
    flag: true,
    help: 'Print error logs'
  })
  .option('no-colors', {
    flag: true,
    help: 'No syntax highlighting please'
  })
  .option('console-stdout', {
    help: 'Write logs into an external file',
    metavar: '<stdout filepath>'
  })
  .option('json', {
    flag: true,
    help: 'Print logs in json'
  })
  .option('version', {
    flag: true,
    help: 'Print version and exit',
    callback: function() {
      fs.readFile(path.resolve(__dirname, '../package.json'), 'utf-8', function(err, file) {
        console.log(JSON.parse(file).version);
      });
    }
  })
  .parse();

if (!opts.manifestURL) {
  opts.manifestURL = path.resolve('./manifest.webapp');
}

function fxconsoleColors (string) {
  return fxconsole.prototype.writer.call({transformResult: transformResult}, string);
}

function JSONStringifyCache(data) {
  var cache = [];
  var string = JSON.stringify(data, function(key, value) {
    if (typeof value === 'object' && value !== null) {
      if (cache.indexOf(value) !== -1) {
        // Circular reference found, discard key
        return;
      }
      // Store value in our collection
      cache.push(value);
    }
    return value;
  });
  cache = null;
  return string;
}

opts.connect = true;
FXOSConnect(opts, function(err, sim) {
  if (err) {
    console.log("Error", err);
    return;
  }

  opts.client = sim.client;
  FXOSConsoleLogs(opts, function(err, logs) {
    var consoleLogs;

    if (opts.json) {
      consoleLogs = logs
        .pipe(es.map(function(data, cb) {
          cb(null, JSONStringifyCache(data));
        }));
    }
    else {
      consoleLogs = logs
        .pipe(es.map(function(data, cb) {
          var string = "";

          // Error
          if (data.errorMessage) {
            var filename = data.sourceName.replace(/^(.*)\//, '');
            var line = data.lineNumber;
            var error = !opts['no-colors'] ? data.errorMessage.red : data.errorMessage;
            string = "" + filename + ":" + line + " " + error + "\n";
          }
          // Log
          else {
            var filename = data.filename.replace(/^(.*)\//, '');
            var line = data.lineNumber;

            var args = data.arguments.map(function(d) {
              if (typeof d == 'object' &&
                  d.obj && d.obj.type == 'object') {
                var obj = d.obj.preview;
                obj.type = 'object';
                obj.ownProps = d.obj.preview.ownProperties;
                obj.class = d.obj.class;
                return obj;
              }
              return d;
            });
            if (!opts['no-colors']) args = args.map(fxconsoleColors);

            string = "" + filename + ":" + line + " " + args.join(' ') + "\n";
          }

          cb(null, string);

        }));
    }

    var stdout = opts['console-stdout'] ?
      fs.createWriteStream(opts['console-stdout']) : process.stdout;

    consoleLogs.pipe(stdout);
  });

});
