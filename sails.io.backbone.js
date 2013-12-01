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



		// If socket is not defined yet, try to grab it
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



		// Ensure the socket is connected and able to communicate w/ the server.
		if ( !socket.socket || !socket.socket.connected ) throw new Error(
			'\n' +
			'Backbone is trying to communicate with the Sails server using '+ socketSrc +',\n'+
			'but it\'s `connected` property is still set to false.\n' +
			'But maybe Socket.io just hasn\'t finished connecting yet?\n' +
			'\n' +
			'You might check to be sure you\'re waiting for `socket.on(\'connect\')`\n' +
			'before using sync methods on your Backbone models and collections.'
		);



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
