(function() {
  var Logger = require('logger-facade-nodejs'),
      util = require('util'),
      RoundRobinStrategy = require('./round_robin_strategy'),
      _ = require('lodash');

  var ServiceManagementInterface = function(configuration){

    var log = Logger.getLogger('SMI');

    var defaults = {
      // heartbeat interval in ms
      heartbeat: 1000,
      // max ttl for a service in ms
      maxTTL: 1500,
      // refresh service ttl update interval in ms
      updateInterval: 100
    };
    var config = _.defaults(configuration, defaults);

    // dictionary with sid as key and ServiceInfo array as value
    var services = { };

    // store refresh interval object id
    var onRefreshServicesTTLIntervalObj;

    // load balancing strategy
    var strategy = new RoundRobinStrategy();

    // this class is used to represent service instance info
    var ServiceInfo = function(sid, identity){
      this.sid = sid;
      this.identity = identity;
      this.ttl = config.maxTTL;

      ServiceInfo.prototype.refreshTTL = function(){
        var newTTL = this.ttl + config.heartbeat;
        this.ttl = newTTL > config.maxTTL ? config.maxTTL : newTTL;
      };

      ServiceInfo.prototype.decrementTTL = function(){
        this.ttl = this.ttl - config.updateInterval;
        return this.ttl;
      };

      ServiceInfo.prototype.isDead = function(){
        return this.ttl < 1;
      };

      ServiceInfo.prototype.toString = function(){
        return util.format("identity: %s TTL: %sms", this.identity, this.ttl);
      };
    };

    var getInstances = function(sid){
      if (!services[sid]){
        services[sid] = [];
      }

      return services[sid];
    };

    var onRefreshServicesTTL = function() {
      log.trace("SMI refreshing services TTL...");

      var decrementAndRemove = function(service){
        service.decrementTTL();
        var isDead = service.isDead();

        if (isDead) {
          log.info("SMI TTL unregister for sid: %s instance: %s!", service.sid, service.identity);
        }

        return isDead;
      };

      for(var sid in services){
        _.remove(services[sid], decrementAndRemove);
      }

      var logInstance = function(instance){
        log.trace("\t\t%s\n", instance.toString());
      };

      log.trace("SMI Service instances:");
      for(var id in services){
        log.trace("\t%s instances", id);
        services[id].forEach(logInstance);
      }
    };

    // public methods

    this.up = function(msg) {
      var to = msg.payload.toUpperCase();
      var instances = getInstances(to);
      var isRegistered = _.some(instances, { identity: msg.identity });

      if(isRegistered){
        log.warn("SMI the service instance %s is already registered!", msg.identity);

        msg.status = 500;
        return msg;
      }

      instances.push(new ServiceInfo(to, msg.identity));

      log.info("SMI register for sid: %s instance: %s!", to, msg.identity);

      msg.status = 200;
      return msg;
    };

    this.down = function(msg){
      var to = msg.payload.toUpperCase();
      var instances = getInstances(to);
      var instanceIndex = _.findIndex(instances, { identity: msg.identity });

      if(instanceIndex === -1){
        log.warn("SMI the service instance %s is not registered!", msg.identity);

        msg.status = 500;
        return msg;
      }

      instances.splice(instanceIndex, 1);

      log.info("SMI unregister for sid: %s instance %s!", to, msg.identity);

      msg.status = 200;
      return msg;
    };

    this.heartbeat = function(msg){
      var to = msg.payload.toUpperCase();
      var instances = getInstances(to);
      var instance = _.find(instances, { identity: msg.identity });

      if(!instance){
        return this.up(msg);
      }

      instance.refreshTTL();

      log.trace("SMI refreshed service instance %s TTL!", msg.identity);

      msg.status = 200;
      return msg;
    }.bind(this);

    this.getInstance = function(sid){
      var instances = getInstances(sid.toUpperCase());
      var instance = strategy.next(sid.toUpperCase(), instances);
      return instance ? instance.identity : null;
    };

    this.run = function(){
      log.debug("SMI Starting refesh routine to execute every %sms", config.updateInterval);
      onRefreshServicesTTLIntervalObj = setInterval(onRefreshServicesTTL.bind(this), config.updateInterval);

      log.info("started...");
    };

    this.stop = function(){
      log.debug("SMI Stoping refesh routine");
      clearInterval(onRefreshServicesTTLIntervalObj);
      onRefreshServicesTTLIntervalObj = null;

      log.info("stoped...");
    };
  };

  module.exports = ServiceManagementInterface;
}());
