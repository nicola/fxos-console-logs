var FindApp = require('fxos-findapp');
var repl = require("repl");
var FirefoxREPL = require('fxconsole');
var Q = require('q');
var stream = require('stream')

module.exports = Console;

function Console(opts, callback) {
  opts = opts || {};

  if (!opts.errors && !opts.logs) {
    opts.errors = true;
    opts.logs = true;
  }
    
  return FindApp(opts)
    .then(function(app) {

      var logs = new stream.Readable({objectMode: true});
      logs._read = function() {}
      
      app.Console.startListening(function(err) {
        if (err) return logs.push('');

        if (opts.errors) {
          app.Console.on("page-error", function(event) {
            logs.push(event);
          });
        }
    
        if (opts.logs) {
          app.Console.on("console-api-call", function(event) {
            logs.push(event);
          });
        }
    
      });

      return logs;

    })
    .nodeify(callback);
}