(function() {
  var zmq = require('zmq'),
      errors = require('../../core/lib/errors'),
      log = require('../../core/lib/logger'),
      _ = require('lodash'),
      Message = require('../../core/lib/message'),
      msgpack = require('msgpack-js');

  var IDENTITY_FRAME = 0,
      PROTOCOL_FRAME = 1,
      TYPE_FRAME     = 2,
      RID_FRAME      = 3,
      ADDRESS_FRAME  = 4,
      HEADERS_FRAME  = 5,
      STATUS_FRAME   = 6,
      PAYLOAD_FRAME  = 7;

  var Frontend = function(configuration, smiService){
    var defaults = {
      frontend: 'tcp://127.0.0.1:5560'
    };

    var config = _.defaults(configuration, defaults);
    var frontend;

    var reply = function(message){
      message.type = Message.Type.REP;

      log.info("frontend reply to: %s with status: %s", message.identity, message.status);

      if(log.isDebug()) {
        log.debug(message.toString());
      }

      frontend.send(message.toFrames());
    };

    var replyFrames = function(frames){
      frames[TYPE_FRAME] = Message.Type.REP;
      var identity = frames[IDENTITY_FRAME];
      var status = frames[STATUS_FRAME];

      log.info("frontend reply to: %s with status: %s", identity, status);

      if(log.isDebug()) {
        var message = Message.parse(frames);
        log.debug(message.toString());
      }

      frontend.send(frames);
    };

    var replyError = function(errorCode, message){
      var error = errors[errorCode.toString()];

      message.status = error.code;
      message.payload = error.body;

      reply(message);
    };

    var onMessage = function(){
      var msg;
      var frames = _.toArray(arguments);

      log.debug("frontend received: %s", frames);

      var from = frames[IDENTITY_FRAME];
      if(!from){
        log.error("frontend received message without client identity");
        msg = Message.parse(frames);
        replyError(500, msg);
        return;
      }

      // execute service name resolution
      var address = msgpack.decode(frames[ADDRESS_FRAME]);
      var to = smiService.getInstance(address.sid);

      if (to === null) {
        msg = Message.parse(frames);
        // reply with error on invalid address
        log.error("Invalid address => %j", msg.address);
        replyError(404, msg);
        return;
      }

      log.info("frontend routing from: %s to: %s", from, to);

      // append destination identity
      frames.unshift(to);

      this.backendSendCallback(frames);
    };

    var onError = function(error){
      // reply with error
      log.error("Received zmq error => %s", error.stack);
    };

    // public methods

    this.backendSendCallback = null;

    this.send = replyFrames.bind(this);

    this.run = function(){
      log.info('\tFrontend connected to %s', config.frontend);

      frontend = zmq.socket('router');
      frontend.on('message', onMessage.bind(this));
      frontend.on('error', onError.bind(this));
      frontend.bindSync(config.frontend);
    };

    this.stop = function(){
      log.info('\tFrontend disconnected from %s', config.frontend);
      frontend.close();
    };

  };

  module.exports = Frontend;
})();
