# towtruck

Experimental actor model for Node.js, attempting to build a high-scale low latency system, by maintaining a pool of in-memory objects (actors).

## Installation

```
npm install towtruck
```

## Usage

```js
// create an instance of towtruck, and choose a port number
var towtruck = require('towtruck');
towtruck(createActor).listen(8080);

// you need to supply a function which will create actors (objects)
function createActor(id, client){
  return {
    // the object can have methods, which can be called over http, or from other actors
    hello: function(data, cb){
	  cb(null, {hello: "from actor " + id});
	}
  }
}
```

When the application is running, you access actors over http:

```
http://localhost:8080/invoke/1/hello

{"hello":"from actor 1"}
```
Any JSON that you post in the body will appear as the `data` argument.

Actors are created when they are requested, and will stay in memory until they are garbage collected. The GC interval can be controlled with configuration.

Other commands are available over http.

```
Register another towtruck instance (this must be reciprocated):
http://localhost:8080/addserver/localhost:9090

Query the registered servers:
http://localhost:8080/getservers

Remove a server:
http://localhost:8080/removeserver/localhost:9090

Get the health of a server:
http://localhost:8080/health
```

Calling other actors from inside an actor:

```js
// the client function allows you to make calls from within twotruck
function createActor(id, client){
  return {
    hello: function(data, cb){

	  // this will invoke the goodbye function on actor 1
	  client.invoke(1, "goodbye", { data:"to send"}, function(err, dataBack){
		cb(null, {"hello from bar": dataBack});
	  });
	},
	goodbye: function(data, cb){
	  cb(err, {farewell: true});
	}
  }
}
```

## TODO

* ~~Support all HTTP verbs on cluster (everything is post)~~
* ~~Forward request body to cluster~~
* ~~Implement bloom filters~~
* ~~Write some documentation~~
* Think about clustering a bit more
* Optimise
* Test at scale
* Support node failure
* Vastly improve error reporting

