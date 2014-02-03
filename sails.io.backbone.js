/*!
 * Backbone SDK for Sails and Socket.io
 * (override for Backbone.sync and Backbone.Collection)
 *
 * c. 2013 @mikermcneil
 * MIT Licensed
 *
 *
 * Inspired by:
 * backbone.iobind - Backbone.sync replacement
 * Copyright(c) 2011 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

(function () {


	// The active `socket`
	var socket;



	// Also keep track of where it came from
	var socketSrc;



	// Used to simplify app-level connection logic-- i.e. so you don't
	// have to wait for the socket to be connected to start trying to 
	// synchronize data.
	var requestQueue = [];



	// A `setTimeout` that, if necessary, is used to check if the socket
	// is ready yet (polls).
	var socketTimer;



	/**
	 * _acquireSocket()
	 *
	 * Grab hold of our active socket object, set it on `socket` closure variable above.
	 * (if your connected socket exists on a non-standard variable, change here)
	 *
	 * @api private
	 */
	var _acquireSocket = function ( ) {
		if (socket) return;

		if (Backbone.socket) {
			socket = Backbone.socket;
			socketSrc = '`Backbone.socket`';
		}
		else if (window.socket) {
			socket = window.socket;
			socketSrc = '`window.socket`';
		}

		// The first time a socket is acquired, bind comet listener
		if (socket) _bindCometListener();
	};



	/**
	 * Checks if the socket is ready- if so, runs the request queue.
	 * If not, sets the timer again.
	 */
	var _keepTryingToRunRequestQueue = function ( ) {
		clearTimeout(socketTimer);

		// Check if socket is connected (synchronous)
		var socketIsConnected = socket.socket && socket.socket.connected;


		if (socketIsConnected) {
			
			// Run the request queue
			_.each(requestQueue, function (request) {
				Backbone.sync(request.method, request.model, request.options);
			});
		}
		else {

			// Reset the timer
			socketTimer = setTimeout(_keepTryingToRunRequestQueue, 250);

			// TODO:
			// After a configurable period of time, if the socket has still not connected,
			// throw an error, since the `socket` might be improperly configured.

			// throw new Error(
			// 	'\n' +
			// 	'Backbone is trying to communicate with the Sails server using '+ socketSrc +',\n'+
			// 	'but its `connected` property is still set to false.\n' +
			// 	'But maybe Socket.io just hasn\'t finished connecting yet?\n' +
			// 	'\n' +
			// 	'You might check to be sure you\'re waiting for `socket.on(\'connect\')`\n' +
			// 	'before using sync methods on your Backbone models and collections.'
			// );
		}
	};



	// Set up `async.until`-esque mechanism which will attempt to acquire a socket.
	var attempts = 0,
		maxAttempts = 3,
		interval = 1500,
		initialInterval = 250;



	var _attemptToAcquireSocket = function () {
		if ( socket ) return;
		attempts++;
		_acquireSocket();
		if (attempts >= maxAttempts) return;
		setTimeout(_attemptToAcquireSocket, interval);
	};



	// Attempt to acquire the socket more quickly the first time,
	// in case the user is on a fast connection and it's available.
	setTimeout(_attemptToAcquireSocket, initialInterval);







	/**
	 * Backbone.on('comet', ...)
	 *
	 * Since Backbone is already a listener (extends Backbone.Events)
	 * all we have to do is trigger the event on the Backbone global when
	 * we receive a new message from the server.
	 * 
	 * I realize this doesn't do a whole lot right now-- that's ok.
	 * Let's start light and layer on additional functionality carefully.
	 */
	var _bindCometListener = function socketAcquiredForFirstTime () {
		socket.on('message', function cometMessageReceived (message) {
			Backbone.trigger('comet', message);
		});
	};






	/**
	 * # Backbone.sync
	 *
	 * Replaces default Backbone.sync function with socket.io transport
	 *
	 * @param {String} method
	 * @param {Backbone.Model|Backbone.Collection} model
	 * @param {Object} options
	 *
	 * @name sync
	 */
	Backbone.sync = function (method, model, options) {

		// Clone options to avoid smashing anything unexpected
		options = _.extend({}, options);




		// If socket is not defined yet, try to grab it again.
		_acquireSocket();



		// Handle missing socket
		if (!socket) {
			throw new Error(
				'\n' +
				'Backbone cannot find a suitable `socket` object.\n' +
				'This SDK expects the active socket to be located at `window.socket`, '+
				'`Backbone.socket` or the `socket` property\n' +
				'of the Backbone model or collection attempting to communicate w/ the server.\n'
			);
		}



		// Ensures the socket is connected and able to communicate w/ the server.
		// 
		var socketIsConnected = socket.socket && socket.socket.connected;
		if ( !socketIsConnected ) {

			// If the socket is not connected, the request is queued
			// (so it can be replayed when the socket comes online.)
			requestQueue.push({
				method: method,
				model: model,
				options: options
			});


			// If we haven't already, start polling the socket to see if it's ready
			_keepTryingToRunRequestQueue();

			return;
		}




		// Get the actual URL (call `.url()` if it's a function)
		var url;
		if (options.url) {
			url = _.result(options, 'url');
		}
		else if (model.url) {
			url = _.result(model, 'url');
		}
		// Throw an error when a URL is needed, and none is supplied.
		// Copied from backbone.js#1558
		else throw new Error('A "url" property or function must be specified');



		// Build parameters to send to the server
		var params = {};

		if ( !options.data && model ) {
			params = options.attrs || model.toJSON(options) || {};
		}

		if (options.patch === true && options.data.id === null && model) {
			params.id = model.id;
		}


		// Map Backbone's concept of CRUD methods to HTTP verbs
		var verb;
		switch (method) {
			case 'create':
				verb = 'post';
				break;
			case 'read':
				verb = 'get';
				break;
			case 'update':
				verb = 'put';
				break;
			default:
				verb = method;
		}



		// Send a simulated HTTP request to Sails via Socket.io
		var simulatedXHR = 
			socket.request(url, params, function serverResponded ( response ) {
				if (options.success) options.success(response);
			}, verb);



		// Trigget the `request` event on the Backbone model
    model.trigger('request', model, simulatedXHR, options);


    
		return simulatedXHR;
	};






		




	/**
	 * TODO:
	 * Replace sails.io.js with `jQuery-to-sails.js`, which can be a prerequisite of 
	 * this SDK.
	 *
	 * Will allow for better client-side error handling, proper simulation of $.ajax,
	 * easier client-side support of headers, and overall a better experience.
	 */
	/*
	var simulatedXHR = $.Deferred();



	// Send a simulated HTTP request to Sails via Socket.io
	io.emit(verb, params, function serverResponded (err, response) {
		if (err) {
			if (options.error) options.error(err);
			simulatedXHR.reject();
			return;
		}

		if (options.success) options.success(response);
		simulatedXHR.resolve();
	});



	var promise = simulatedXHR.promise();



	// Trigger the model's `request` event
	model.trigger('request', model, promise, options);



	// Return a promise to allow chaining of sync methods.
	return promise;
	*/


})();
