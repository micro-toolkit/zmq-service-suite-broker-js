(function() {
  var log = require('../../core/lib/logger'),
      util = require('util'),
      RoundRobinStrategy = require('./round_robin_strategy'),
      _ = require('lodash');

  var ServiceManagementInterface = function(configuration){

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
      log.info("refreshing services TTL...");

      var decrementAndRemove = function(service){
        service.decrementTTL();
        return service.isDead();
      };

      for(var sid in services){
        _.remove(services[sid], decrementAndRemove);
      }

      var logInstance = function(instance){
        log.info("\t\t%s\n", instance.toString());
      };

      log.info("Service instances:");
      for(var id in services){
        log.info("\t%s instances", id);
        services[id].forEach(logInstance);
      }
    };

    // public methods

    this.up = function(msg) {
      var to = msg.payload.toUpperCase();
      var instances = getInstances(to);
      var isRegistered = _.some(instances, { identity: msg.identity });

      if(isRegistered){
        log.warn("the service instance %s is already registered!", msg.identity);

        msg.status = 500;
        return msg;
      }

      instances.push(new ServiceInfo(to, msg.identity));

      log.info("register the service instance %s!", msg.identity);

      msg.status = 200;
      return msg;
    };

    this.down = function(msg){
      var to = msg.payload.toUpperCase();
      var instances = getInstances(to);
      var instanceIndex = _.findIndex(instances, { identity: msg.identity });

      if(instanceIndex === -1){
        log.warn("the service instance %s is not registered!", msg.identity);

        msg.status = 500;
        return msg;
      }

      instances.splice(instanceIndex, 1);

      log.info("unregister the service instance %s!", msg.identity);

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

      log.info("refreshed service instance %s TTL!", msg.identity);

      msg.status = 200;
      return msg;
    };

    this.getInstance = function(sid){
      var instances = getInstances(sid.toUpperCase());
      var instance = strategy.next(sid.toUpperCase(), instances);
      return instance ? instance.identity : null;
    };

    this.run = function(){
      log.debug("Starting SMI refesh routine to execute every %sms", config.updateInterval);
      onRefreshServicesTTLIntervalObj = setInterval(onRefreshServicesTTL.bind(this), config.updateInterval);

      log.info("SMI started");
    };

    this.stop = function(){
      log.debug("Stoping SMI refesh routine");
      clearInterval(onRefreshServicesTTLIntervalObj);
      onRefreshServicesTTLIntervalObj = null;

      log.info("SMI stoped...");
    };
  };

  module.exports = ServiceManagementInterface;
}());
