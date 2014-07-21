(function() {
  var zmq = require('zmq'),
      errors = require('../config/errors'),
      Logger = require('logger-facade-nodejs'),
      _ = require('lodash'),
      Message = require('zmq-service-suite-message'),
      msgpack = require('msgpack-js');

  var IDENTITY_FRAME = 0,
      PROTOCOL_FRAME = 1,
      TYPE_FRAME     = 2,
      RID_FRAME      = 3,
      ADDRESS_FRAME  = 4,
      HEADERS_FRAME  = 5,
      STATUS_FRAME   = 6,
      PAYLOAD_FRAME  = 7;

  var REPLY_FRAME_SIZE = 9;

  var Backend = function(configuration, smiService){

    var log = Logger.getLogger('Backend');

    var defaults = {
      backend: 'tcp://127.0.0.1:5559'
    };

    var config = _.defaults(configuration, defaults);
    var socket;

    var smiActions = _(['UP','DOWN','HEARTBEAT']);

    var reply = function(message){
      message.type = Message.Type.REP;

      if(message.address.sid === 'SMI') {

        log.debug("reply to: %s rid: %s with status: %s",
            message.identity, message.rid, message.status);
      } else {

          log.info("reply to: %s rid: %s with status: %s",
              message.identity, message.rid, message.status);
      }

      // TODO: log frames in debug mode
      // if(log.isDebug()){
      //   log.debug(message.toString());
      // }

      socket.send(message.toFrames());
    };

    var forward = function(frames){
      // on forward the frist frames is destination
      frames[TYPE_FRAME + 1] = Message.Type.REQ;

      log.info("forward request from: %s rid: %s to: %s",
        frames[IDENTITY_FRAME + 1], frames[RID_FRAME + 1], frames[IDENTITY_FRAME]);

      // TODO: log frames in debug mode
      // if(log.isDebug()){
      //   var message = Message.parse(frames);
      //   log.debug(message.toString());
      // }

      socket.send(frames);
    };

    var replyError = function(errorCode, message){
      var error = errors[errorCode.toString()];

      message.status = error.code;
      message.payload = error.body;

      reply(message);
    };

    var getSMIAction = function(address){
      var verb = address.verb.toUpperCase();

      if(!smiActions.contains(verb)){
        return null;
      }

      return smiService[verb.toLowerCase()];
    };

    var handleRequest = function(frames) {
      var message = Message.parse(frames);

      var isSMIRequest = message.address.sid === 'SMI';
      if(!isSMIRequest){
        log.error("doesn't respond to %s", message.address.sid);
      }

      var action = getSMIAction(message.address);
      if(action === null){
        log.error("SMI service doesn't respond to %s", message.address.verb);
      }

      if (isSMIRequest && action !== null){
        log.debug("routing from: %s rid: %s to SMI.%s request...",
          message.identity, message.rid, message.address.verb);
        message = action(message);
        if(message.status === 200) {
          reply(message);
          return;
        }

      } else {
        message.status = 500;
      }

      replyError(message.status, message);
    };

    var onMessage = function(){
      var frames = _.toArray(arguments);

      var from;
      // check if it is reply
      if(frames.length === REPLY_FRAME_SIZE){
        // remove worker identity and let client identity on position 0
        from = frames.shift();
      }

      log.debug("received from: %s rid: %s",
        from || frames[IDENTITY_FRAME], frames[RID_FRAME]);

      // TODO: log frames in debug mode
      // if(log.isDebug()) {
      //   var msg = Message.parse(frames);
      //   log.debug(msg.toString());
      // }

      var isRequest = frames[TYPE_FRAME].toString('utf8') === Message.Type.REQ;
      if (isRequest) {
        handleRequest(frames);
        return;
      }

      var to = frames[IDENTITY_FRAME];
      if(!to){
        log.error("invalid routing from: %s to: %s", from, to);
        return;
      }

      var status = frames[STATUS_FRAME];
      log.info("forward to frontend from: %s to: %s sending: %s", from, to, status);

      this.frontendSendCallback(frames);
    };

    var onError = function(error){
      // reply with error
      log.error("received zmq error => %s", error.stack);
    };

    // public methods

    this.frontendSendCallback = null;

    this.send = forward.bind(this);

    this.run = function(){
      log.info('connected to %s', config.backend);

      socket = zmq.socket('router');
      socket.on('message', onMessage.bind(this));
      socket.on('error', onError.bind(this));
      socket.bindSync(config.backend);
    };

    this.stop = function(){
      log.info('disconnected from %s', config.backend);
      socket.close();
    };

  };

  module.exports = Backend;
})();
