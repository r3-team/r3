let wsHub = {
	blockingCount:0, // how many blocking transactions are active?
	callbacks:{},    // outside callback functions, defined on open()
	debug:false,     // if true, prints debug messages to console.log
	transactions:{}, // active transactions: key = transaction number
	ws:null,         // websocket connection, null if not opened
	
	// open websocket connection to defined URL with optional event callbacks
	open:function(url,callbackOpen,callbackBlocking,callbackUnrequested,callbackClose) {
		
		this.callbacks.blocking    = callbackBlocking;    // blocking change
		this.callbacks.close       = callbackClose;       // connection closed
		this.callbacks.open        = callbackOpen;        // connection opened
		this.callbacks.unrequested = callbackUnrequested; // received unrequested message
		
		this.ws = new WebSocket(url);
		this.ws.onopen    = ()  => { this.callback('open');  };
		this.ws.onclose   = ()  => { this.callback('close'); };
		this.ws.onerror   = ()  => { this.callback('close'); };
		this.ws.onmessage = (e) => {
			let json = JSON.parse(e.data);
			
			if(this.debug) {
				console.log('<-- Transaction incoming');
				console.log(json);
			}
			this.transactionResponse(json);
		};
	},
	callback:function(name,argument) {
		if(typeof this.callbacks[name] !== 'undefined')
			this.callbacks[name](argument);
	},
	close:function() {
		if(this.ws !== null) {
			// https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code
			this.ws.close(1000); // code 1000: Normal Closure
			this.ws = null;
		}
		this.closeTransactions(); // kill active transactions
		this.callback('close');   // execute last, close callback
		this.callbacks = {};      // reset callbacks
	},
	closeTransactions:function() {
		this.blockingCount = 0;
		this.transactions  = {};
		this.callback('blocking',false);
	},
	setDebug:function(state) {
		this.debug = state;
	}
};

// transaction object
// handles a transaction both for sending requests and retrieving responses
// use add() to add requests and send() to send the transaction via websocket
wsHub.transaction = function(name) {
	if(wsHub.ws === null)
		return false;
	
	this.transactionNr = 0;  // unique transaction number
	this.requests      = []; // list of all requests
	this.callback;           // callback function to execute once transaction finishes
	                         // delivers response & request payload and stored data
	this.callbackError;      // callback function to execute in case of error
							 // delivers request payload and error message
	this.callbackStore = {}; // general data to be stored for use after callback
	                         // set when transaction is sent, to be used after it finishes
	this.blocking = false;   // is this transaction blocking?
	
	// register transaction with an unique number between 100000-499999
	do{
		this.transactionNr = Math.floor(Math.random() * 399999) + 100000;
	}
	while(typeof wsHub.transactions[this.transactionNr] !== 'undefined');
	
	wsHub.transactions[this.transactionNr] = this;
	return this;
};
wsHub.transaction.prototype.add = function(ressource,action,payload,callback) {
	this.requests.push({
		ressource:ressource, // what ressource to use
		action:action,       // what to do: CREATE, DELETE, OPEN, RETRIEVE, UPDATE
		payload:payload,     // action meta data
		callback:callback,   // callback function for response
                             // delivers response & request payload
	});
}
wsHub.transaction.prototype.send = function(callbackError,callback,callbackStore) {
	
	// kill transaction if requests are empty or the websocket connection is blocked already
	if(this.requests.length === 0) {
		delete wsHub.transactions[this.transactionNr];
		return false;
	}
	
	// build transaction JSON
	let trans = {
		transactionNr:this.transactionNr,
		requests:this.requests
	};
	if(wsHub.debug) {
		console.log('<-- Transaction outgoing');
		console.log(trans);
	}
	
	wsHub.ws.send(JSON.stringify(trans));
	
	// callbacks for finished transaction
	this.callback      = callback;
	this.callbackError = callbackError;
	
	// data to be used with finished transaction callback
	// in addition to data that is part of either payload (req/res)
	this.callbackStore = callbackStore;
	
	// block entire websocket connection, if transaction is blocking
	if(this.blocking) {
		wsHub.blockingCount++;
		
		// only use callback on initial blocking transaction
		if(wsHub.blockingCount === 1)
			wsHub.callback('blocking',true);
	}
}

// transaction object that blocks execution of other transactions
wsHub.transactionBlocking = function() {
	let trans = new wsHub.transaction();
	trans.blocking = true;
	return trans;
};

// handle return of a transaction from a websocket channel
wsHub.transactionResponse = function(input) {
	
	// handle unrequested response
	if(input.transactionNr === 0)
		return wsHub.callback('unrequested',input.responses[0]);
	
	let transactionNr = input.transactionNr;
	let transaction   = wsHub.transactions[transactionNr];
	
	// transaction does not exist anymore, discard
	if(typeof transaction === 'undefined')
		return false;
	
	let responses = input.responses;
	let requests  = transaction.requests;
	
	// execute error callback in case of error
	if(input.error !== '') {
		if(typeof transaction.callbackError !== 'undefined')
			transaction.callbackError(requests,input.error);
	}
	else {
		// execute request callbacks for all responses
		for(let i = 0, j = responses.length; i < j; i++) {
			
			if(typeof requests[i].callback !== 'undefined')
				requests[i].callback(responses[i],requests[i]);
		}
		
		// execute callback for transaction if available
		if(typeof transaction.callback !== 'undefined')
			transaction.callback(responses,requests,transaction.callbackStore);
	}
	
	// unblock, if blocking transaction has been active
	if(transaction.blocking) {
		wsHub.blockingCount--;
		
		if(wsHub.blockingCount < 1) {
			wsHub.blockingCount = 0;
			wsHub.callback('blocking',false);
		}
	}
	delete wsHub.transactions[transactionNr];
};