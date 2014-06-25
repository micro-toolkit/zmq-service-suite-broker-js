(function() {
  var log = require('../../core/lib/logger'),
      _ = require('lodash'),
      SMI = require('./smi'),
      Backend = require('./backend'),
      Frontend = require('./frontend');

  var Broker = function(configuration, smiService, frontend, backend){
    var defaults = {
      version: '0.0',
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

    // public methods

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

      log.info("Waiting for messages...");
    };

    this.stop = function(){
      log.info("Async Broker disconnecting...");

      smiService.stop();
      frontend.stop();
      backend.stop();
    };

  };

  module.exports = Broker;
})();
