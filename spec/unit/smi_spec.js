describe("ServiceManagementInterface", function(){

  var Logger = require('logger-facade-nodejs'),
      Message = require('zmq-service-suite-message'),
      uuid = require('uuid'),
      SMI = require('../../lib/smi');

  var target;

  var config = {
    // heartbeat interval in ms
    heartbeat: 100,
    // max ttl for a service in ms
    maxTTL: 200,
    // refresh service ttl update interval in ms
    updateInterval: 100
  };

  var heartbeat, up, down, log;

  beforeEach(function(){
    spyOn(uuid, 'v1').andReturn("uuid");
    log = Logger.getLogger('SMISpec');
    spyOn(Logger, 'getLogger').andReturn(log);

    // TODO: set on helpers for all tests
    // issue with clearTimeout/clearInterval: https://github.com/mhevery/jasmine-node/issues/276
    // spyOn(global, 'clearTimeout').andCallFake(function() {
    //   return jasmine.Clock.installed.clearTimeout.apply(this, arguments);
    // });

    spyOn(global, 'clearInterval').andCallFake(function() {
      return jasmine.Clock.installed.clearInterval.apply(this, arguments);
    });

    up = new Message("SMI", "UP");
    up.identity = "service";
    up.payload = "service-sid";

    down = new Message("SMI", "DOWN");
    down.identity = "service";
    down.payload = "service-sid";

    heartbeat = new Message("SMI", "HEARTBEAT");
    heartbeat.identity = "service";
    heartbeat.payload = "service-sid";

    jasmine.Clock.useMock();

    target = new SMI(config);
  });

  describe('#run', function(){

    it('logs start info', function(){

      spyOn(log, 'info');
      target.run();
      expect(log.info).toHaveBeenCalled();
    });

    it('register interval based execution of service refresh', function(){

      target.run();
      target.up(up);

      // trigger first ttl services refresh
      jasmine.Clock.tick(config.updateInterval);
      // trigger second ttl services refresh
      jasmine.Clock.tick(config.updateInterval);

      // service should not be registered
      var result = target.down(down);
      expect(result.status).toBe(500);
    });
  });

  describe('#stop', function(){

    beforeEach(function(){
      target.run();
    });

    it('logs stop info', function(){
      spyOn(log, 'info');
      target.stop();
      expect(log.info).toHaveBeenCalled();
    });

    it('unregister interval based execution of service refresh', function(){
      spyOn(jasmine.Clock.installed, 'clearInterval');
      target.stop(up);
      // trigger first ttl services refresh
      jasmine.Clock.tick(config.updateInterval);

      expect(jasmine.Clock.installed.clearInterval).toHaveBeenCalled();
    });
  });

  describe('#up', function(){

    describe('register the service instance', function() {

      describe('with success', function(){

        it('returns 200', function() {
          var result = target.up(up);
          expect(result.status).toBe(200);
        });
      });

      describe('with error', function(){

        it('returns 500 when instance is registered', function() {
          target.up(up);

          var result = target.up(up);
          expect(result.status).toBe(500);
        });

        it('logs warning info when service is registered', function(){
          target.up(up);
          spyOn(log, 'warn');
          target.up(up);
          expect(log.warn).toHaveBeenCalled();
        });

      });
    });
  });

  describe('#down', function(){

    beforeEach(function(){
      target.up(up);
    });

    describe('unregister the service instance', function() {

      describe('with success', function(){

        it('returns 200', function() {
          var result = target.down(down);
          expect(result.status).toBe(200);
        });
      });

      describe('with error', function(){

        it('returns 500 when instance is not registered', function() {
          target.down(down);

          var result = target.down(down);
          expect(result.status).toBe(500);
        });

        it('logs warning when service is not registered', function(){
          target.down(down);
          spyOn(log, 'warn');
          target.down(down);

          expect(log.warn).toHaveBeenCalled();
        });

      });
    });
  });

  describe('#heartbeat', function(){

    beforeEach(function(){
      target.run();
    });

    it('returns sucessfully even when called from different context', function() {
      var result = target.heartbeat.call(null, heartbeat);
      expect(result.status).toBe(200);
    });

    describe('when instance not registered execute registration', function() {

      describe('with success', function(){

        it('returns 200', function() {
          var result = target.heartbeat(heartbeat);
          expect(result.status).toBe(200);
        });

        it('logs info about service registration', function(){
          spyOn(log, 'info');
          target.heartbeat(heartbeat);
          expect(log.info).toHaveBeenCalled();
        });
      });

    });

    describe('refresh the service instance', function() {
      beforeEach(function(){
        target.up(up);
      });

      describe('with success', function(){

        it('returns 200', function() {
          var result = target.heartbeat(heartbeat);
          expect(result.status).toBe(200);
        });

        it('updates service instance ttl', function() {
          // trigger first ttl services refresh to reduce ttl
          jasmine.Clock.tick(config.updateInterval);
          // refresh ttl
          target.heartbeat(heartbeat);
          // trigger second ttl services refresh to reduce ttl
          jasmine.Clock.tick(config.updateInterval);
          // service should be registered
          expect(target.up(up).status).toBe(500);
        });

        it('twice does not invalidate next heartbeat from being send', function() {
          target.heartbeat(heartbeat);
          target.heartbeat(heartbeat);

          // trigger first ttl services refresh
          jasmine.Clock.tick(config.updateInterval);
          // trigger second ttl services refresh
          jasmine.Clock.tick(config.updateInterval);

          var result = target.down(down);
          expect(result.status).toBe(500);
        });
      });

    });

  });

  describe("#getInstance", function(){

    describe("with single instance registered", function(){
      it("returns the same", function(){
        target.up(up);
        var result = target.getInstance(up.payload);
        expect(result).toBe(up.identity);
      });
    });

    describe("with multiple instances registered", function(){
      var instance1, instance2;

      beforeEach(function(){
        instance1 = up.identity;
        target.up(up);
        instance2 = up.identity + "2";
        up.identity = instance2;
        target.up(up);
      });

      it("returns the first instance", function(){
        var result = target.getInstance(up.payload);
        expect(result).toBe(instance1);
      });

      it("returns instance using load balancing algorithm", function(){
        expect(target.getInstance(up.payload)).not
          .toBe(target.getInstance(up.payload));
      });

    });

    describe("with unregistered instances for sid", function(){
      it("returns null", function(){
        var result = target.getInstance(up.payload);
        expect(result).toBe(null);
      });
    });
  });

});
