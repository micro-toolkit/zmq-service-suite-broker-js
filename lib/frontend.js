(function() {
  var zmq = require('zmq'),
      errors = require('../../core/lib/errors'),
      Logger = require('logger-facade-nodejs'),
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

    var log = Logger.getLogger('Frontend');

    var defaults = {
      frontend: 'tcp://127.0.0.1:5560'
    };

    var config = _.defaults(configuration, defaults);
    var frontend;

    var reply = function(message){
      message.type = Message.Type.REP;

      log.info("frontend replied to: %s with status: %s for rid: %s", message.identity, message.status, message.rid);

      // TODO: log frames in debug mode
      // if(log.isDebug()) {
      //   //log.debug(message.toString());
      // }

      frontend.send(message.toFrames());
    };

    var replyFrames = function(frames){
      frames[TYPE_FRAME] = Message.Type.REP;
      var identity = frames[IDENTITY_FRAME];
      var status = frames[STATUS_FRAME];
      var rid = frames[RID_FRAME];

      log.info("frontend replied to: %s with status: %s for rid: %s", identity, status, rid);

      // TODO: log frames in debug mode
      // if(log.isDebug()) {
      //   var message = Message.parse(frames);
      //   log.debug(message.toString());
      // }

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

      try{

        var from = frames[IDENTITY_FRAME];
        var rid = frames[RID_FRAME];

        log.info("frontend received rid: %s from: %s", rid, from);

        // TODO: log frames in debug mode
        // if (log.isDebug()) {
        //   log.debug(Message.parse(frames).toString());
        // }

        // valid client identity
        if(!from){
          log.error("frontend received message without client identity for rid:", rid);
          msg = Message.parse(frames);
          replyError(500, msg);
          return;
        }

        // execute service name resolution
        var address = msgpack.decode(frames[ADDRESS_FRAME]);
        var to = smiService.getInstance(address.sid);

        // invalid address
        if (to === null) {
          msg = Message.parse(frames);
          // reply with error on invalid address
          log.error("frontend received an invalid address for rid: %s => %j", rid, msg.address);
          replyError(404, msg);
          return;
        }

        log.info("frontend routing rid: %s from: %s to: %s", rid, from, to);

        // append destination identity
        frames.unshift(to);

        this.backendSendCallback(frames);
      }
      catch(err){
        log.error('frontend terminated on error handling request: ', err.stack);
      }
    };

    var onError = function(error){
      // reply with error
      log.error("frontend received zmq error => %s", error.stack);
    };

    // public methods

    this.backendSendCallback = null;

    this.send = replyFrames.bind(this);

    this.run = function(){
      log.info('  Frontend connected to %s', config.frontend);

      frontend = zmq.socket('router');
      frontend.on('message', onMessage.bind(this));
      frontend.on('error', onError.bind(this));
      frontend.bindSync(config.frontend);
    };

    this.stop = function(){
      log.info('  Frontend disconnected from %s', config.frontend);
      frontend.close();
    };

  };

  module.exports = Frontend;
})();
