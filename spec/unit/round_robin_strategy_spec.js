var RoundRobinStrategy = require('../../lib/round_robin_strategy');

describe("RoundRobinStrategy", function(){
  var target;

  beforeEach(function(){
    target = new RoundRobinStrategy();
  });

  describe("#next", function(){

    describe("with null elements", function(){
      it("returns null", function(){
        expect(target.next('key', null)).toBe(null);
      });
    });

    describe("with empty elements", function(){
      it("returns null", function(){
        expect(target.next('key', [])).toBe(null);
      });
    });

    describe("with single value", function(){
      it("returns the always the same", function(){
        expect(target.next('key',[1])).toBe(target.next('key',[1]));
      });
    });

    describe("with multiple values", function(){

      it("returns the first value on first call", function(){
        expect(target.next('key',[1,2])).toBe(1);
      });

      it("returns values using round robin algorithm", function(){
        target.next('key',[1,2]);
        expect(target.next('key',[1,2])).toBe(2);
      });

      it("returns first value when next index greater then element length", function(){
        target.next('key',[1,2]);
        target.next('key',[1,2]);
        expect(target.next('key',[1,2])).toBe(1);
      });

    });
  });

  describe("#clear", function(){
    it("returns if operation was successful", function(){
      expect(target.clear('key')).toBe(true);
    });

    it("deletes key from internal state", function(){
      target.next('key',[1,2]);
      target.clear('key');
      expect(target.next('key',[1,2])).toBe(1);
    });

  });
});
