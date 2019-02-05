[![Build Status](https://travis-ci.org/micro-toolkit/zmq-service-suite-broker-js.svg?branch=master)](https://travis-ci.org/micro-toolkit/zmq-service-suite-broker-js)
[![Maintainability](https://api.codeclimate.com/v1/badges/1db88a3fbf23c7377653/maintainability)](https://codeclimate.com/github/micro-toolkit/zmq-service-suite-broker-js/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/1db88a3fbf23c7377653/test_coverage)](https://codeclimate.com/github/micro-toolkit/zmq-service-suite-broker-js/test_coverage)

## ZMQ Service Oriented Suite - Node-js Broker

[![NPM version](https://badge.fury.io/js/zmq-service-suite-broker.svg)](http://badge.fury.io/js/zmq-service-suite-broker)

This project is a node-js broker implementation for [Micro toolkit](http://micro-toolkit.github.io/info/) and it respects with the [zss specification](http://micro-toolkit.github.io/zmq-service-suite-specs/).

The broker is slipt in three main components:
* backend: Receives requests and replies from services;
* frontend: Receives requests and replies from clients;
* smi: Service management interface, it handles service lifecycle with smi requests: up, down, heartbeat.

## Running Broker

**ZeroMQ Install**

You need to have [0MQ installed](http://zeromq.org/area:download).

If you use MacOS just do

    $ brew install zeromq

**ZSS Broker Execution**

    $ npm install
    $ npm start

# Environment variables

The broker binary can be configured with some environment variables:

MICRO_BROKER_LOG_LEVEL - Specifies the log level used, defaults to 'info'
MICRO_BROKER_LOG_TIMEFORMAT - Specifies the log time format used, defaults to 'YYYY-MM-DD HH:mm:ss.SSS'
MICRO_BROKER_LOG_JSON - Specifies if json log format is used, defaults to false
MICRO_BROKER_BE_ADDR - Specifies the broker backend socket address, defaults to 'tcp://0.0.0.0:7776'
MICRO_BROKER_FE_ADDR - Specifies the broker frontend socket address, defaults to 'tcp://0.0.0.0:7777'
MICRO_BROKER_HEARTBEAT - Specifies the broker heartbeat interval used by services, defaults to 1000
MICRO_BROKER_MAX_TTL - Specifies the broker max ttl for each service optimal is 2xHEARTBEAT, defaults to 2000
MICRO_BROKER_UPDATE_INT - Specifies the broker update interval to check service ttl, defaults to 500

## System Metrics

The library publishes some log events related with metrics of the system and some headers are added to the response along the way to identify the timestamp of the different events. with the timestamp in milliseconds.

The following sigles are used for each component identification:
* `c` - stands for client
* `s` - stands for service
* `bfe` - stands for broker frontend
* `bbe` - stands for broker backend
* `b` - stands for broker

The following sigles are used for each socket event:
* `s` - stands for message sent
* `r` - stands for message receive

The following spans are used to identify the different component traces:

* `micro.cb.span`: Identifies the time it takes since the client sent the request until the broker receives it (`micro.cs - micro.bfer`).
* `micro.bfe.span`: Identifies the time it takes since the broker receives the request until it processes it to send through the backend (internal broker actions) (`micro.bbes - micro.bfer`).
* `micro.bs.span`: Identifies the time it takes since the broker sends the request until it is received in the service (`micro.sr - micro.bbes`).
* `micro.s.span`: Identifies the time it takes since the service received the request until the response is sent (`micro.ss - micro.sr`).
* `micro.sb.span`: Identifies the time it takes since the service sent the response until the response is received in the broker (`micro.bber - micro.ss`).
* `micro.bbe.span`: Identifies the time it takes since the broker received the response until the response is sent through the broker frontend (internal broker actions) (`micro.bfes - micro.bber`).
* `micro.bc.span`: Identifies the time it takes since the broker sent the response until the response is received in the client (`micro.cr - micro.bfes`).
* `micro.c.span`: Identifies the time it takes since the client sent the request until the response is received in the client (`micro.cr - micro.cs`).

The following headers are added by the broker to calculate the metrics:

* When receiving a new request on the broker frontend `micro.bfer` contains the request receive time.
* When sending a new request on the broker backend `micro.bbes` contains the request sent time.
* When receiving the response on the broker backend `micro.bber` contains the response receive time.
* When sending athe response on the broker frontend `micro.bbes` contains the response sent time.

The following metrics are calculated when the request is received and response is sent:

* `micro.cb.span`: Identifies the time it takes since the client sent the request until the it is received in the broker (`micro.cs - micro.bfer`).

* `micro.bfe.span`: Identifies the time it takes since the broker received the request until the it is sent to the service (`micro.bfer - micro.bbes`).

* `micro.sb.span`: Identifies the time it takes since the service send the response until the it is received in the broker (`micro.bber - micro.ss`).

* `micro.bbe.span`: Identifies the time it takes since the broker receive the response until the it is sent to the client (`micro.bfes - micro.bber`).

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request

## Bump versioning

We use [grunt bump package](https://www.npmjs.org/package/grunt-bump) to control package versioning.

Bump Patch version

    $ grunt bump

Bump Minor version

    $ grunt bump:minor

Bump Major version

    $ grunt bump:major

## Running Specs

    $ npm test

## Coverage Report

We aim for 100% coverage and we hope it keeps that way! :)
We use pre-commit and pre-push hooks and CI to accomplish this, so don't mess with our build! :P

Check the report after running npm test.

    $ open ./coverage/lcov-report/index.html
