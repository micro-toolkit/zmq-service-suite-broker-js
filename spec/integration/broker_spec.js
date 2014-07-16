
describe('Broker Integration', function(){

  var zmq = require('zmq'),
      _ = require('lodash'),
      Logger = require('logger-facade-nodejs'),
      LoggerConsolePlugin = require('logger-facade-console-plugin-nodejs'),
      Message = require('zmq-service-suite-message'),
      Broker = require('../../lib/broker');

  var IDENTITY_FRAME = 0,
      PROTOCOL_FRAME = 1,
      TYPE_FRAME     = 2,
      RID_FRAME      = 3,
      ADDRESS_FRAME  = 4,
      HEADERS_FRAME  = 5,
      STATUS_FRAME   = 6,
      PAYLOAD_FRAME  = 7;

  var target, config, serviceSocket, clientSocket;

  beforeEach(function(){

    jasmine.Clock.useMock();

    config = {
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

    target = new Broker(config);
    target.run();
  });

  afterEach(function(){
    target.stop();

    if(serviceSocket){
      serviceSocket.close();
      serviceSocket = null;
    }

    if(clientSocket){
      clientSocket.close();
      clientSocket = null;
    }
  });

  var server = function(callback){
    serviceSocket = zmq.socket('dealer');
    serviceSocket.identity = "service#1";
    serviceSocket.linger = 0;
    serviceSocket.on('message', callback);
    serviceSocket.connect(config.backend);
    return serviceSocket;
  };

  var runningServer = function(afterStart, onMessage){

    var service = server(function(){
      var frames = _.toArray(arguments);
      var msg = Message.parse(frames);

      if(msg.type === Message.Type.REP){
        afterStart();
      } else {
        onMessage(msg);
      }
    });

    var up = new Message("SMI", "UP");
    up.payload = "SERVICE";
    up.identity = service.identity;
    service.send(up.toFrames());

    return service;
  };

  var client = function(callback){
    clientSocket = zmq.socket('dealer');
    clientSocket.identity = "client#1";
    clientSocket.linger = 0;
    clientSocket.on('message', callback);
    clientSocket.connect(config.frontend);
    return clientSocket;
  };

  it('handles an SMI service request', function(done){
    var socket = server(function(){
      var frames = _.toArray(arguments);
      var msg = Message.parse(frames);
      expect(msg.status).toBe(200);
      done();
    });
    var msg = new Message("SMI", "UP");
    msg.payload = "SERVICE";
    msg.identity = socket.identity;
    socket.send(msg.toFrames());
  });

  it('handles a client request', function(done){
    var socket = client(function(){
      var frames = _.toArray(arguments);
      var msg = Message.parse(frames);
      expect(msg.status).toBe(404);
      done();
    });
    var msg = new Message("SID", "VERB");
    msg.payload = "data";
    var frames = msg.toFrames();
    // discard identity that will be send by socket
    frames.shift();
    socket.send(frames);
  });

  it('handles a client request with service reply', function(done){

    var afterServiceStart = function(){

      var clientSocket = client(function(){
        // handle ping response
        var frames = _.toArray(arguments);
        var msg = Message.parse(frames);
        expect(msg.status).toBe(200);
        expect(msg.payload).toBe("PONG");
        done();
      });

      // execute ping request
      var ping = new Message("SERVICE", "VERB");
      ping.payload = "ping";

      var frames = ping.toFrames();
      // discard identity that will be send by client
      frames.shift();
      clientSocket.send(frames);
    };

    var service = runningServer(afterServiceStart, function(msg){
      // handle server message
      msg.type = Message.Type.REP;
      msg.status = 200;
      msg.payload = "PONG";
      service.send(msg.toFrames());
    });
  });

});
