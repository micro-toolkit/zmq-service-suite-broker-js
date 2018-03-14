var _ = require('lodash');
var moment = require('moment');
var framesHelper = require('./frames');
var Logger = require('logger-facade-nodejs');
var log = Logger.getLogger('micro.metric.broker');
var msgpack = require('msgpack-js');
var util = require('util');
var Message = require('zmq-service-suite-message');

function encode(frames, id, val) {
  frames[id] = msgpack.encode(val);
  return frames;
}

// Add Test: Add proper test to ensure the format of the metric, mocking logger was giving troubles
function metric(name, val, message) {
  // val is not a NaN should log the metric
  if (isNaN(val)) { return message; }

  var metadata = _.pick(message, ['type', 'rid', 'address', 'status', 'client', 'clientId', 'transaction']);
  metadata['micrometric'] = { name: name, value: val };
  log.info(metadata, 'Publishing metric "%s":%sms', name, val);
  return metadata;
}

function feStart(frames) {
  var now = moment().valueOf();
  var message = Message.parse(frames, true);

  // add the micro broker frontend receive timestamp
  message.headers = _.defaults(message.headers, {'micro.bfer': now});
  metric('micro.bfer', now, message);

  var cs = message.headers['micro.cs'];
  metric('micro.cb.span', now - cs, message);

  return encode(frames, framesHelper.HEADERS_FRAME, message.headers);
}

function beStart(frames) {
  var now = moment().valueOf();

  //TODO: document this
  var identity = frames.shift();
  var message = Message.parse(frames, true);

  // add the micro broker frontend receive timestamp
  message.headers = _.defaults(message.headers, {'micro.bbes': now});
  metric('micro.bbes', now, message);

  var bfer = message.headers['micro.bfer'];
  metric('micro.bfe.span', now - bfer, message);

  frames = encode(frames, framesHelper.HEADERS_FRAME, message.headers);

  //TODO: document
  frames.unshift(identity);
  return frames;
}

function beEnd(frames) {
  var now = moment().valueOf();
  var message = Message.parse(frames);

  // add the micro broker frontend receive timestamp
  message.headers = _.defaults(message.headers, {'micro.bber': now});
  metric('micro.bber', now, message);

  var ss = message.headers['micro.ss'];
  metric('micro.sb.span', now - ss, message);

  return encode(frames, framesHelper.HEADERS_FRAME, message.headers);
}

function feEnd(arg) {
  var now = moment().valueOf();

  var isFrames = _.isArray(arg);
  var message = isFrames ? Message.parse(arg) : arg;

  // add the micro broker frontend receive timestamp
  message.headers = _.defaults(message.headers, {'micro.bfes': now});
  metric('micro.bfes', now, message);

  var bber = message.headers['micro.bber'];
  metric('micro.bbe.span', now - bber, message);

  if (!isFrames) { return message; }
  return encode(arg, framesHelper.HEADERS_FRAME, message.headers);
}

module.exports = {
  feStart: feStart,
  beStart: beStart,
  beEnd: beEnd,
  feEnd: feEnd,
};
