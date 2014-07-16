describe('Backend', function(){

  var Logger = require('logger-facade-nodejs'),
      Message = require('zmq-service-suite-message'),
      zmq = require('zmq'),
      Buffer = require('buffer').Buffer,
      msgpack = require('msgpack-js'),
      Backend = require('../../lib/backend'),
      SMI = require('../../lib/smi');


  var IDENTITY_FRAME = 0,
      PROTOCOL_FRAME = 1,
      TYPE_FRAME     = 2,
      RID_FRAME      = 3,
      ADDRESS_FRAME  = 4,
      HEADERS_FRAME  = 5,
      STATUS_FRAME   = 6,
      PAYLOAD_FRAME  = 7;

  var config, target, socketMock, smi, log;

  beforeEach(function(){
    log = Logger.getLogger('BackendSpec');
    spyOn(Logger, 'getLogger').andReturn(log);

    jasmine.Clock.useMock();

    config = {
      backend: 'tcp://127.0.0.1:5559',
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
    target = new Backend(config, smi);
  });

  describe("#run", function(){

    describe("starts broker activity", function(){

      beforeEach(function(){

        spyOn(zmq, 'socket').andReturn(socketMock);
      });

      it('opening router socket for services', function(){
        spyOn(socketMock, 'bindSync');

        target.run();

        expect(zmq.socket).toHaveBeenCalledWith('router');
        expect(socketMock.bindSync).toHaveBeenCalledWith(config.backend);
      });

      it('logging starting activity', function(){
        spyOn(log,'info');
        target.run();
        expect(log.info).toHaveBeenCalledWith(jasmine.any(String), config.backend);
      });

    });

    describe("starts handling service requests", function() {

      describe('on zmq error', function(){

        it('logs an error', function(){
          spyOn(log,'error');
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

      describe('for SMI', function(){

        var up, down, heartbeat;

        beforeEach(function(){

          up = new Message("SMI", "UP");
          up.identity = "service";
          up.payload = "service-sid";

          down = new Message("SMI", "DOWN");
          down.identity = "service";
          down.payload = "service-sid";

          heartbeat = new Message("SMI", "HEARTBEAT");
          heartbeat.identity = "service";
          heartbeat.payload = "service-sid";
        });

        describe('on invalid verb', function(done){

          var msg;

          beforeEach(function(){

            msg = new Message("SMI", "ACTION");
            msg.identity = "service";

            socketMock.on = function(type, callback){
              if(type === 'message'){
                callback.apply(null, msg.toFrames());
              }
            };
          });

          it('returns 500', function(done){

            socketMock.send = function(frames){
              expect(frames[STATUS_FRAME]).toBe(500);
              done();
            };

            spyOn(zmq, 'socket').andReturn(socketMock);

            target.run();
          });

          it('returns reply message', function(done){

            socketMock.send = function(frames){
              expect(frames[TYPE_FRAME]).toBe(Message.Type.REP);
              done();
            };

            spyOn(zmq, 'socket').andReturn(socketMock);

            target.run();
          });

          it('logs an error message', function(){
            spyOn(log, 'error');
            spyOn(zmq, 'socket').andReturn(socketMock);
            target.run();
            expect(log.error).toHaveBeenCalled();
          });
        });

        it('returns service error', function(done){
          spyOn(smi, 'up').andCallFake(function(msg){
            msg.status = 404;
            return msg;
          });
          socketMock.on = function(type, callback){
            if(type === 'message'){
              callback.apply(null, up.toFrames());
            }
          };
          socketMock.send = function(frames){
            expect(frames[STATUS_FRAME]).toBe(404);
            done();
          };

          spyOn(zmq, 'socket').andReturn(socketMock);
          target.run();
        });

        it('returns a reply message', function(done){

          spyOn(smi, 'up').andCallFake(function(msg){
            msg.status = 200;
            return msg;
          });
          socketMock.on = function(type, callback){
            if(type === 'message'){
              var frames = up.toFrames();
              // emulate nodejs zeromq send
              frames[TYPE_FRAME] = new Buffer(String(frames[TYPE_FRAME], 'utf8'));
              callback.apply(null, frames);
            }
          };
          socketMock.send = function(frames){
            expect(frames[TYPE_FRAME]).toBe(Message.Type.REP);
            done();
          };

          spyOn(zmq, 'socket').andReturn(socketMock);
          target.run();
        });

        describe('on UP', function(){

          beforeEach(function(){

            socketMock.on = function(type, callback){
              if(type === 'message'){
                callback.apply(null, up.toFrames());
              }
            };
          });

          it('returns 200', function(done){

            spyOn(smi, 'up').andCallFake(function(msg){
              msg.status = 200;
              return msg;
            });
            socketMock.send = function(frames){
              expect(frames[STATUS_FRAME]).toBe(200);
              done();
            };

            spyOn(zmq, 'socket').andReturn(socketMock);
            target.run();
          });

        });

        describe('on DOWN', function(){

          beforeEach(function(){

            socketMock.on = function(type, callback){
              if(type === 'message'){
                callback.apply(null, down.toFrames());
              }
            };
          });

          it('returns 200', function(done){

            spyOn(smi, 'down').andCallFake(function(msg){
              msg.status = 200;
              return msg;
            });
            socketMock.send = function(frames){
              expect(frames[STATUS_FRAME]).toBe(200);
              done();
            };

            spyOn(zmq, 'socket').andReturn(socketMock);
            target.run();
          });

        });

        describe('on HEARTBEAT', function(){

          beforeEach(function(){

            socketMock.on = function(type, callback){
              if(type === 'message'){
                callback.apply(null, heartbeat.toFrames());
              }
            };
          });

          it('returns 200', function(done){

            spyOn(smi, 'heartbeat').andCallFake(function(msg){
              msg.status = 200;
              return msg;
            });
            socketMock.send = function(frames){
              expect(frames[STATUS_FRAME]).toBe(200);
              done();
            };

            spyOn(zmq, 'socket').andReturn(socketMock);
            target.run();
          });

        });

      });

      describe('for sid different from SMI', function(done){

        var msg;

        beforeEach(function(){

          msg = new Message("OTHER", "ACTION");
          msg.identity = "service";

          socketMock.on = function(type, callback){
            if(type === 'message'){
              callback.apply(null, msg.toFrames());
            }
          };
        });

        it('returns 500', function(done){

          socketMock.send = function(frames){
            expect(frames[STATUS_FRAME]).toBe(500);
            done();
          };

          spyOn(zmq, 'socket').andReturn(socketMock);

          target.run();
        });

        it('returns reply message', function(done){

          socketMock.send = function(frames){
            expect(frames[TYPE_FRAME]).toBe(Message.Type.REP);
            done();
          };

          spyOn(zmq, 'socket').andReturn(socketMock);

          target.run();
        });

        it('logs an error message', function(){
          spyOn(zmq, 'socket').andReturn(socketMock);
          spyOn(log, 'error');
          target.run();
          expect(log.error).toHaveBeenCalled();
        });

      });

    });

    describe("starts handling service replies", function() {

      var msg, frontendSendCallbackSpy;

      beforeEach(function(){

        msg = new Message("SID", "VERB");
        msg.type = Message.Type.REP;

        socketMock.on = function(type, callback){
          if(type === 'message'){
            var frames = msg.toFrames();
            frames.unshift("service");
            callback.apply(null, frames);
          }
        };

        frontendSendCallbackSpy = jasmine.createSpy('frontendCallback');
        target.frontendSendCallback = frontendSendCallbackSpy;

        spyOn(zmq, 'socket').andReturn(socketMock);
      });

      it('logs an error when client identity is not valid', function(){

        spyOn(log, 'error');
        target.run();
        expect(log.error).toHaveBeenCalled();
      });

      it('routes to client on valid client identity', function(done){

        msg.identity = "client";
        frontendSendCallbackSpy.andCallFake(function(frames){
          expect(frames[IDENTITY_FRAME]).toBe("client");
          done();
        });
        target.run();
      });

    });

  });

  describe("#stop", function(){

    describe("stop broker activity", function(){

      beforeEach(function(){
        spyOn(zmq, 'socket').andReturn(socketMock);
        target.run();
      });

      it('closing socket', function(){
        spyOn(socketMock, 'close');
        target.stop();
        expect(socketMock.close).toHaveBeenCalled();
      });

      it('logging stoping activity', function(){
        spyOn(log, 'info');
        target.stop();
        expect(log.info).toHaveBeenCalledWith(jasmine.any(String), config.backend);
      });

    });

  });

  describe("#send", function(){

    var frames;

    beforeEach(function(){
      // on send we need the routing frame on 0
      frames = [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null
      ];

      spyOn(zmq, 'socket').andReturn(socketMock);
      spyOn(socketMock, 'send');

      target.run();
    });

    it('sends request to socket', function(){
      target.send(frames);

      var expected = [
        null,
        null,
        null,
        "REQ",
        null,
        null,
        null,
        null,
        null
      ];
      expect(socketMock.send).toHaveBeenCalledWith(expected);
    });

    it('logs request info', function(){
      spyOn(log, 'info');
      target.send(frames);
      expect(log.info).toHaveBeenCalled();
    });

  });
});
