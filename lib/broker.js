(function() {
  var Logger = require('logger-facade-nodejs'),
      _ = require('lodash'),
      SMI = require('./smi'),
      Backend = require('./backend'),
      Frontend = require('./frontend'),
      packageJson = require('../package.json');

  var Broker = function(configuration, smiService, frontend, backend){
    var defaults = {
      frontend: 'tcp://127.0.0.1:5560',
      backend: 'tcp://127.0.0.1:5559',
      smi: {
        // heartbeat interval in ms
        heartbeat: 1000,
        // max ttl for a service in ms
        maxTTL: 1500,
        // refresh service ttl update interval in ms
        updateInterval: 100
      }
    };

    var config = _.defaults(configuration, defaults);

    // alway override version
    config.version = packageJson.version;

    var log = Logger.getLogger('Broker');

    // public methods

    this.version = config.version;

    this.run = function(){
      log.info("Async Broker v%s", config.version);

      smiService = smiService || new SMI(config.smi);
      smiService.run(config.smi);

      backend =  backend || new Backend({ backend: config.backend }, smiService);
      frontend = frontend || new Frontend({ frontend: config.frontend }, smiService);

      backend.frontendSendCallback = frontend.send;
      frontend.backendSendCallback = backend.send;

      backend.run();
      frontend.run();

      log.info("Async Broker is waiting for messages...\n");
    };

    this.stop = function(){
      log.info("\nAsync Broker disconnecting...");

      smiService.stop();
      frontend.stop();
      backend.stop();
    };

  };

  module.exports = Broker;
})();
