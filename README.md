backbone-to-sails
=================

Backbone SDK for communicating with Sails.js over Socket.io.


### Background

This has been a long time coming.

Our team has been using this kind of setup with Sails on top of Backbone for almost two years, and I've made plenty of mistakes along the way.  So this time, with the first open-source version, I wanted to start small--  keep it simple and clean, without touching more of the Backbone core than absolutely necessary.

So currently, this SDK just replaces the default Backbone.sync function with a Sails.js-flavored socket.io transport.  That may change in the future, but any extensions to this functionality will be configurable and opt-in.  


## Installation

Copy `sails.io.backbone.js` into your project and set it up to load in your HTML file.
It should be included after `jQuery`, `_`, `backbone`, `socket.io.js`, and `sails.io.js`.
That's it!


## Usage


#### Sending messages to the server (i.e. ajax)
There is no special usage for sending requests-- everything works just like you would normally with Backbone via HTTP.
Just be sure and wait for the socket to be connected first!  Otherwise you'll see an ugly, but hopefully descriptive) error message.

For example:

```javascript

socket.on('connect', function socketReady() {

	var Twinkies = Backbone.Collection.extend({ url: '/twinkie '});
	var someTwinkies = new Twinkies();

	someTwinkies.fetch();

	someTwinkies.on('sync', function () {
		var myTwinkie = someTwinkies.get(1);
		myTwinkie.wasEaten = true;
		myTwinkie.save();

		// If there are two many twinkies, throw one away... :\
		// What if they're multiplying?!
		if (someTwinkies.length > 5) {
			var suspiciousTwinkie = someTwinkies.get(2);
			suspiciousTwinkie.destroy();
		}
	});
})
```

#### Receiving messages from the server (i.e. comet)

This SDK adds a `comet` event to the global `Backbone` object:

```javascript
Backbone.on('comet', function ( message ) {
	
	// You'll want to do different stuff depending on what's in `message`.

	// The structure of `message` is very important.  It can vary, depending on
	// how you choose to implement your backend, but it should always be an object.
	//
	// Currently in Sails v0.9.x, if you are using publishCreate(), publishUpdate(), etc. 
	// the top-level of message has a predefined format.
	//
	// In Sails v0.10, the format of `message` will be completely up to you.
})`
```


#### Using Basic Pubsub with Sails / Backbone

In Sails, subscription happens on the server.  **This is the only way to securely implement realtime updates.**

In order for your socket to receive published messages at all, you must first send a request **using the socket** to an endpoint (i.e. route, url, pick your favorite term) which subscribes to one or more model instances.

> If you're new to pubsub in Sails, or for a refresher on server-side usage,
> check out the docs on the Sails website:
> http://sailsjs.com/#!documentation/sockets
>
> And the screencasts here:
> http://irlnathan.github.io/sailscasts/blog/2013/09/15/episode-20-adding-real-time-events-to-models-in-4-lines-of-code/

Let's say we have a little something-something on the backend reachable at `GET /twinkie/subscribe`.

On the server, `GET /twinkie/subscribe` might look like:
```javascript
// TwinkieController.js in Sails
// ...
subscribe: function (req, res) {
  Twinkie.subscribe(req.socket, req.param('id'));
  res.json({ success: true });
}
// ...
```

On the client, we'll send a request to the endpoint which subscribes us. (**using the socket!**)
```javascript
// On the client:
socket.get('/user/subscribe', { id: 7 }, function (response) {
  // cool now we're subscribed to the twinkie #7.
  // That means we can receive comet events whenever the server publishes anything to twinkie #7!
  
  Backbone.on('comet', function ( message ) {
    console.log('Got the latest on our twinkie:', message);
  });
});
```



#### Even Easier-- Backbone + Comet + Sails Blueprints

The built-in API blueprints in Sails automatically manage publish and subscribe on the server for you.  All you have to do to subscribe to a model is call the `find` blueprint.  I'll extend our twinkie example:

```javascript

// Define our collection
var Twinkies = Backbone.Collection.extend({ url: '/twinkie '});

// Instantiate our collection
var someTwinkies = new Twinkies();

socket.on('connect', function socketReady() {

	// Initiate the first fetch of twinkies
	// Since we're using the Sails blueprints, we'll also be subscribed 
	// to each of the twinkies that are returned, as well as the Twinkie class room itself.
	someTwinkies.fetch();

	someTwinkies.on('sync', function () {
		var myTwinkie = someTwinkies.get(1);
		myTwinkie.wasEaten = true;
		
		// Updates the twinkie
		//
		// And since we're using blueprints, publishes a message about the update 
		// to anyone subscribed to the twinkie.
		//
		// This also works if this save() resulted in a create-- it just uses the class room
		// instead of the instance room.  See the Sails docs for more on that-- it's going 
		// to change in v0.10.
		myTwinkie.save();

		// If there are two many twinkies, throw one away... :\
		// What if they're multiplying?!
		if (someTwinkies.length > 5) {
			var suspiciousTwinkie = someTwinkies.get(2);
			
			// Destroys the suspcious twinkie
			// And since we're using blueprints, it also unsubscribes us from the twinkie,
			// which means we won't hear any future updates about it
			// (not that there should be any-- this is mainly for efficiency)
			//
			// The blueprints also publishing a message indicating that the twinkie 
			// was deleted so that any other sockets subscribed can update their UI 
			// accordingly.
			suspiciousTwinkie.destroy();
		}
	});
});


// Listen for updates from the server
Backbone.on('comet', function ( message ) {
	
	if ( message.model !== 'twinkie' ) {
		console.error(
			'Unrecognized comet message received from server-- ' +
			'I only know how to handle Twinkies!!!'
		);
	}
	
	switch (message.method) {
		case 'create': Twinkies.add(message.data); break;
		case 'update': Twinkies.get(message.id).set(message.changes); break;
		case 'destroy': Twinkies.remove(Twinkes.get(message.id)); break;
	}
})`
```













## How does this SDK work?


###### Connecting
> i.e. How does this connect to the Sails server?

Currently, this SDK expects active socket to be located at
`window.socket`, `Backbone.socket` or the `socket` property on 
the instance of the specific model/collection communicating w/
the server.  See inline comments if you want to change it.



###### Talking to the Server
> i.e. How does this send messages to the Sails server?

This client will emit socket requests to URLs, which will be 
interpreted and routed by Sails accordingly, whether they are
to custom URLs in your routes.js file or automatic API blueprints.

e.g. if your Backbone collection's URL is '/todo', calling `fetch()`
will still contact the Sails backend at `GET /todo`-- but now it will
use Socket.io to emit a packet on the connected socket instead of 
sending an HTTP request.


###### Listening to the Server
> i.e. What happens when comet messages arrive?

When your Sails publishes a message using `Foo.publish`, the name of
the socket event is always 'message'. This SDK examines all incoming
messages from Sails, then triggers a `comet` event on the `Backbone` 
global.




## Roadmap

 +	Build `sails.io.$.js` as a replacement for `sails.io.js` and make it a dependency of this library.  This allows us to do a better job at simulating an XHR object, and should make it possible for other folks to rapidly integrate other jQuery-dependent frameworks as needed.

 +	Built-in auto-synchronization for Backbone.Collection and Backbone.Models, accomplished by expecting a standard CRUD-compatible format in the published messages from the server.  Figuring out that format, and making it reasonably configurable, is the real challenge here.

 +	Ability to pass in a connected socket as an option to fetch/save/etc. as an alternative to stuffing it in a conventional place (i.e. `window.socket`, `Backbone.socket`, etc.)

 +	If Backbone tries to talk to the server and the socket is missing or disconnected, fall back to `$.ajax`.  Should be configurable, with at least three distinct possibilities:
 	+ Throw a fatal error .
 	+ Fall back to `$.ajax`, but log a warning.
 	+ Fall back to `$.ajax` silently (production)

 +	Somewhere (but probably in the aforementioned `sails.io.$.js` or `sails.io.js`) create a queue which tracks requests intended for the server that were sent before the socket connects.  If the queue gets too large, or the socket hasn't connected after 10-15 seconds, give up and release the simulated XHR objects with errors explaining the situation.  This lets us ignore connection/disconnection logic, which should dramatically simplify things for beginners.

## License

MIT bro
 
