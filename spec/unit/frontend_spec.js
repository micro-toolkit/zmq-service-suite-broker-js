describe('Frontend', function(){

  var log = require('../../../core/lib/logger'),
      Message = require('../../../core/lib/message'),
      zmq = require('zmq'),
      msgpack = require('msgpack-js'),
      Frontend = require('../../lib/frontend'),
      SMI = require('../../lib/smi');


  var IDENTITY_FRAME = 0,
      PROTOCOL_FRAME = 1,
      TYPE_FRAME     = 2,
      RID_FRAME      = 3,
      ADDRESS_FRAME  = 4,
      HEADERS_FRAME  = 5,
      STATUS_FRAME   = 6,
      PAYLOAD_FRAME  = 7;

  var config, target, socketMock, smi;

  beforeEach(function(){
    spyOn(log, 'trace').andReturn(Function.apply());
    spyOn(log, 'debug').andReturn(Function.apply());
    spyOn(log, 'info').andReturn(Function.apply());
    spyOn(log, 'warn').andReturn(Function.apply());
    spyOn(log, 'error').andReturn(Function.apply());

    log.level = log.INFO_LEVEL;

    jasmine.Clock.useMock();

    config = {
      frontend: 'tcp://127.0.0.1:5560',
      smi: {
        heartbeat: 1000,
        maxTTL: 1500,
        updateInterval: 100
      }
    };

    socketMock = {
      send: Function.apply(),
      bindSync: Function.apply(),
      on: Function.apply(),
      close: Function.apply()
    };

    smi = new SMI(config.smi);
    target = new Frontend(config, smi);
  });

  describe("#run", function(){

    describe("starts frontend activity", function(){

      beforeEach(function(){

        spyOn(zmq, 'socket').andReturn(socketMock);
      });

      it('opening router socket for clients', function(){
        spyOn(socketMock, 'bindSync');
        target.run();

        expect(zmq.socket).toHaveBeenCalledWith('router');
        expect(socketMock.bindSync).toHaveBeenCalledWith(config.frontend);
      });

      it('logging starting activity', function(){
        log.info.reset();
        target.run();

        expect(log.info).toHaveBeenCalled();
      });

    });

    describe("starts handling client requests", function() {
      var frames;

      beforeEach(function(){

        var address = {
          sid: "test-zmq",
          sversion: "*",
          verb: "ping"
        };

        frames = [
          "identity",
          "ZSS:0.0",
          "REQ",
          "RID",
          msgpack.encode(address),
          msgpack.encode({}),
          null,
          msgpack.encode("data")
        ];
      });
      describe('with error', function(){

        describe('on zmq error', function(){

          it('logs an error', function(){
            log.error.reset();
            socketMock.on = function(type, callback){
              if(type === 'error'){
                callback(new Error("zmq"));
              }
            };

            spyOn(zmq, 'socket').andReturn(socketMock);

            target.run();

            expect(log.error).toHaveBeenCalled();
          });
        });

        it('logs debug message with frames on reply', function(){
          log.level = log.DEBUG_LEVEL;

          spyOn(Message, 'parse').andReturn({
            toString: function(){ return "message"; },
            toFrames: Function.apply()
          });

          frames[IDENTITY_FRAME] = null;

          socketMock.on = function(type, callback){
            if(type === 'message'){
              callback.apply(null, frames);
            }
          };

          spyOn(zmq, 'socket').andReturn(socketMock);

          log.debug.reset();
          target.run();

          expect(log.debug).toHaveBeenCalledWith("message");
        });

        describe('when without identity', function(){

          it('returns status 500', function(done){
            frames[IDENTITY_FRAME] = null;

            socketMock.on = function(type, callback){
              if(type === 'message'){
                callback.apply(null, frames);
              }
            };

            socketMock.send = function(frames){
              expect(frames[STATUS_FRAME]).toBe(500);
              done();
            };

            spyOn(zmq, 'socket').andReturn(socketMock);

            target.run();
          });

          it('logs an error', function(){
            frames[IDENTITY_FRAME] = null;

            socketMock.on = function(type, callback){
              if(type === 'message'){
                callback.apply(null, frames);
              }
            };

            spyOn(zmq, 'socket').andReturn(socketMock);
            log.error.reset();

            target.run();

            expect(log.error).toHaveBeenCalled();
          });
        });

        describe('when address is invalid', function(){

          it('returns status 404', function(done){
            socketMock.on = function(type, callback){
              if(type === 'message'){
                callback.apply(null, frames);
              }
            };
            socketMock.send = function(frames){
              expect(frames[STATUS_FRAME]).toBe(404);
              done();
            };

            spyOn(zmq, 'socket').andReturn(socketMock);

            target.run();
          });

          it('logs an error', function(){
            log.error.reset();
            socketMock.on = function(type, callback){
              if(type === 'message'){
                callback.apply(null, frames);
              }
            };

            spyOn(zmq, 'socket').andReturn(socketMock);

            target.run();

            expect(log.error).toHaveBeenCalled();
          });
        });

      });

      it('routes to service on valid address', function() {
        socketMock.on = function(type, callback){
          if(type === 'message'){
            callback.apply(null, frames);
          }
        };

        spyOn(zmq, 'socket').andReturn(socketMock);
        spyOn(smi, 'getInstance').andReturn('id');
        var backendCallbackSpy = jasmine.createSpy('backendCallback');

        target.backendSendCallback = backendCallbackSpy;
        target.run();
        frames.unshift("id");
        expect(backendCallbackSpy).toHaveBeenCalledWith(frames);
      });
    });

  });

  describe("#stop", function(){

    describe("stop broker activity", function(){

      beforeEach(function(){
        spyOn(zmq, 'socket').andReturn(socketMock);
        target.run();
      });

      it('closing frontend router socket for clients', function(){
        spyOn(socketMock, 'close');
        target.stop();
        expect(socketMock.close).toHaveBeenCalled();
      });

      it('logging stoping activity', function(){
        log.info.reset();
        target.stop();
        expect(log.info).toHaveBeenCalled();
      });

    });

  });

  describe("#send", function(){

    var frames;

    beforeEach(function(){
      frames = [
        null,
        null,
        "REQ",
        null,
        null,
        null,
        null,
        null
      ];

      spyOn(zmq, 'socket').andReturn(socketMock);
      spyOn(socketMock, 'send');
      spyOn(Message, 'parse').andReturn({
        toString: function(){ return "message"; }
      });

      target.run();
    });

    it('sends reply to socket', function(){
      target.send(frames);

      var expected = [
        null,
        null,
        "REP",
        null,
        null,
        null,
        null,
        null
      ];
      expect(socketMock.send).toHaveBeenCalledWith(expected);
    });

    it('logs reply info', function(){
      target.send(frames);
      expect(log.info).toHaveBeenCalled();
    });

    it('logs debug message with frames', function(){
      log.level = log.DEBUG_LEVEL;
      target.send(frames);
      expect(log.debug).toHaveBeenCalledWith("message");
    });

  });
});
