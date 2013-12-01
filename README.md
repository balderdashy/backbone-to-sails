backbone-to-sails
=================

Backbone SDK for communicating with Sails.js over Socket.io.


### Background

This has been a long time coming.

Our team has been using this kind of setup with Sails on top of Backbone for almost two years, and I've made plenty of mistakes along the way.  So this time, with the first open-source version, I wanted to start small--  keep it simple and clean, without touching more of the Backbone core than absolutely necessary.

So currently, this SDK just replaces the default Backbone.sync function with a Sails.js-flavored socket.io transport.  That may change in the future, but any extensions to this functionality will be configurable and opt-in.  


### Installation

Copy `sails.io.backbone.js` into your project and set it up to load in your HTML file.
It should be included after `jQuery`, `_`, `backbone`, `socket.io.js`, and `sails.io.js`.
That's it!


### Usage


##### Sending messages to the server (i.e. ajax)
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

##### Receiving messages from the server (i.e. comet)


> NOTE
> You'll receive comet messages any time an update is published to a model instance,
> but only if you're subscribed to it.
>
> If you're new to pubsub in Sails, or for a refresher on server-side usage,
> check out the docs on the Sails website:
> http://sailsjs.com/#!documentation/sockets


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

	// Here's an example:

	switch (message.model) {
		case 'user': 
			break;

		case 'pet':
			switch (message.method) {
				case 'create': Pets.add(message.data); break;
			}
			break;
	}
})`
```









### How Does It Work?

###### Talking to the Server (i.e. ajax)
todo

###### Listening to the Server (i.e. comet)
todo



### Roadmap

 +	Build `sails.io.$.js` as a replacement for `sails.io.js` and make it a dependency of this library.  This allows us to do a better job at simulating an XHR object, and should make it possible for other folks to rapidly integrate other jQuery-dependent frameworks as needed.

 +	Built-in auto-synchronization for Backbone.Collection and Backbone.Models, accomplished by expecting a standard CRUD-compatible format in the published messages from the server.  Figuring out that format, and making it reasonably configurable, is the real challenge here.

 +	Ability to pass in a connected socket as an option to fetch/save/etc. as an alternative to stuffing it in a conventional place (i.e. `window.socket`, `Backbone.socket`, etc.)

 +	If Backbone tries to talk to the server and the socket is missing or disconnected, fall back to `$.ajax`.  Should be configurable, with at least three distinct possibilities:
 	+ Throw a fatal error .
 	+ Fall back to `$.ajax`, but log a warning.
 	+ Fall back to `$.ajax` silently (production)
 
