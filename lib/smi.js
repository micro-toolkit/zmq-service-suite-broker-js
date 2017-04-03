var Logger = require('logger-facade-nodejs'),
    util = require('util'),
    RoundRobinStrategy = require('./round_robin_strategy'),
    ServiceInfo = require('./service_info'),
    _ = require('lodash');

var log = Logger.getLogger('SMI');

// load balancing strategy
var strategy = new RoundRobinStrategy();

var defaults = {
  // heartbeat interval in ms
  heartbeat: 1000,
  // max ttl for a service in ms
  maxTTL: 1500,
  // refresh service ttl update interval in ms
  updateInterval: 100
};

function logInstance(instance){
  log.trace("\t\t%s\n", instance.toString());
}

function getInstances(services, sid){
  if (!services[sid]){
    services[sid] = [];
  }

  return services[sid];
}

function getInstance(services, sid){
  var instances = getInstances(services, sid.toUpperCase());
  var instance = strategy.next(sid.toUpperCase(), instances);
  return instance ? instance.identity : null;
}

function isDeadService(service){
  service.decrementTTL();
  var isDead = service.isDead();

  if (isDead) {
    log.info("SMI TTL unregister for sid: %s instance: %s!", service.sid, service.identity);
  }

  return isDead;
}

function refreshServiceCatalog(services) {
  log.trace("SMI refreshing services TTL...");

  for(var sid in services){
    _.remove(services[sid], isDeadService);
  }

  log.trace("SMI Service instances:");
  for(var id in services){
    log.trace("\t%s instances", id);
    services[id].forEach(logInstance);
  }
}

function serviceUp(config, services, msg) {
  var to = msg.payload.toUpperCase();
  var instances = getInstances(services, to);
  var isRegistered = _.some(instances, { identity: msg.identity });

  if(isRegistered){
    log.warn("SMI the service instance %s is already registered!", msg.identity);

    msg.status = 500;
    return msg;
  }

  instances.push(new ServiceInfo(config, to, msg.identity));

  log.info("SMI register for sid: %s instance: %s!", to, msg.identity);

  msg.status = 200;
  return msg;
}

function serviceDown(services, msg){
  var to = msg.payload.toUpperCase();
  var instances = getInstances(services, to);
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
}

function serviceHeartbeat(config, services, msg){
  var to = msg.payload.toUpperCase();
  var instances = getInstances(services, to);
  var instance = _.find(instances, { identity: msg.identity });

  if(!instance) { return serviceUp(config, services, msg); }

  instance.refreshTTL();

  log.trace("SMI refreshed service instance %s TTL!", msg.identity);

  msg.status = 200;
  return msg;
}

var ServiceManagementInterface = function(configuration) {
  var config = _.defaults(configuration, defaults);

  // dictionary with sid as key and ServiceInfo array as value
  var services = { };

  // store refresh interval object id
  var onRefreshServicesTTLIntervalObj;

  var onRefreshServicesTTL = function() { refreshServiceCatalog(services); };

  // public methods

  this.up = function(msg){
    return serviceUp(config, services, msg);
  };

  this.down = function(msg){
    return serviceDown(services, msg);
  };

  this.heartbeat = function(msg){
    return serviceHeartbeat(config, services, msg);
  };

  this.getInstance = function(sid){
    return getInstance(services, sid);
  };

  this.run = function(){
    log.debug("SMI Starting refesh routine to execute every %sms", config.updateInterval);
    onRefreshServicesTTLIntervalObj = setInterval(onRefreshServicesTTL, config.updateInterval);

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
