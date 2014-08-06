describe('Broker', function(){

  var Logger = require('logger-facade-nodejs'),
      Broker = require('../../lib/broker');

  var config, target, smiMock, frontendMock, backendMock, log;

  beforeEach(function(){
    log = Logger.getLogger('Broker');
    spyOn(Logger, 'getLogger').andReturn(log);

    jasmine.Clock.useMock();

    config = {
      version: '0.0'
    };
    frontendMock = {
      run: Function.apply(),
      stop: Function.apply()
    };
    backendMock = {
      run: Function.apply(),
      stop: Function.apply()
    };
    smiMock = {
      run: Function.apply(),
      stop: Function.apply()
    };
    target = new Broker(config, smiMock, frontendMock, backendMock);
  });

  describe("#version", function(){

    it('returns package version', function(){
      var packageJson = require('../../package');
      expect(target.version).toEqual(packageJson.version);
    });

  });

  describe("#run", function(){

    it('starts broker without service dependencies', function(){

      target = new Broker(config);
      target.run();
      target.stop();
    });

    it('starts frontend for clients', function(){
      spyOn(frontendMock, 'run');
      target.run();
      expect(frontendMock.run).toHaveBeenCalled();
    });

    it('starts backend for services', function(){
      spyOn(backendMock, 'run');
      target.run();
      expect(backendMock.run).toHaveBeenCalled();
    });

    it('starts SMI', function(){
      spyOn(smiMock, 'run');
      target.run();
      expect(smiMock.run).toHaveBeenCalled();
    });

    it('logging starting activity', function(){
      spyOn(log, 'info');
      target.run();
      expect(log.info).toHaveBeenCalledWith(jasmine.any(String), config.version);
    });
  });

  describe("#stop", function(){

    describe("stop broker activity", function(){

      it('stoping frontend from clients', function(){
        spyOn(frontendMock, 'stop');
        target.run();
        target.stop();
        expect(frontendMock.stop).toHaveBeenCalled();
      });

      it('stoping backend from services', function(){
        spyOn(backendMock, 'stop');
        target.run();
        target.stop();
        expect(backendMock.stop).toHaveBeenCalled();
      });

      it('stoping SMI', function() {
        spyOn(smiMock, 'stop');
        target.run();
        target.stop();
        expect(smiMock.stop).toHaveBeenCalled();
      });

      it('logging stoping activity', function(){
        target.run();
        spyOn(log, 'info');
        target.stop();
        expect(log.info).toHaveBeenCalled();
      });

    });

  });
});
