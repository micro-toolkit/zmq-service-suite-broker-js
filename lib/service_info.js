var util = require('util');

function ServiceInfo(config, sid, identity){
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
}

module.exports = ServiceInfo;
