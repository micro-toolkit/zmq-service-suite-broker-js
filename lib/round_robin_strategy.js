(function() {

  var RoundRobinStrategy = function(){

    // store key:index
    var state = { };

    this.clear = function(key) {
      return delete state[key];
    };

    this.next = function(key, elements) {

      if(!elements || elements.length === 0){
        return null;
      }

      var nextIndex = state[key] !== undefined ? ++state[key] : 0;

      // go to begging when next index greater than elements
      if(nextIndex >= elements.length){
        nextIndex = 0;
      }

      state[key] = nextIndex;

      return elements[nextIndex];
    };
  };

  module.exports = RoundRobinStrategy;
})();
