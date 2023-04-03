let ws = {
	blockingCount:0, // how many blocking transactions are active?
	callbacks:{},    // outside callback functions, defined on open()
	conn:null,       // websocket connection, null if not opened
	debug:false,     // if true, prints transactions to console.log
	transactions:{}, // active transactions: key = transaction number
	
	// open websocket connection to defined URL with optional event callbacks
	open(url,callbackOpen,callbackBlocking,callbackUnrequested,callbackClose) {
		this.callbacks.blocking    = callbackBlocking;    // blocking change
		this.callbacks.close       = callbackClose;       // connection closed
		this.callbacks.open        = callbackOpen;        // connection opened
		this.callbacks.unrequested = callbackUnrequested; // received unrequested message
		
		this.conn = new WebSocket(url);
		this.conn.onclose   = ()  => { this.event('close'); };
		this.conn.onerror   = ()  => { this.event('close'); };
		this.conn.onmessage = (e) => { this.received(JSON.parse(e.data)); };
		this.conn.onopen    = ()  => { this.event('open');  };
	},
	
	// clear running transactions
	clear() {
		this.blockingCount = 0;
		this.transactions  = {};
		this.event('blocking',false);
	},
	
	// close websocket connection
	close() {
		if(this.conn !== null) {
			this.conn.close(1000); // code 1000: Normal Closure
			this.conn = null;
		}
		this.clear();        // kill active transactions
		this.event('close'); // close callback
		this.callbacks = {}; // reset event callbacks
	},
	
	// trigger websocket event, executes registered callback
	event(name,argument) {
		if(typeof this.callbacks[name] !== 'undefined')
			this.callbacks[name](argument);
	},
	
	// prepares a request object for sending
	prepare(ressource,action,payload) {
		return {
			ressource:ressource,
			action:action,
			payload:payload
		};
	},
	
	// receives messages from websocket channel
	received(msg) {
		if(this.debug)
			console.log('WebSocket <-', msg);
		
		if(msg.transactionNr === 0)
			return this.event('unrequested',msg.responses[0]);
		
		let trans = this.transactions[msg.transactionNr];
		
		// transaction does not exist, discard
		if(typeof trans === 'undefined')
			return false;
		
		// unblock, if blocking transaction has been active
		if(trans.blocking) {
			this.blockingCount--;
			
			if(this.blockingCount < 1) {
				this.blockingCount = 0;
				this.event('blocking',false);
			}
		}
		
		// delete transaction reference
		delete this.transactions[msg.transactionNr];
		
		// resolve promise
		if(msg.error !== '')
			return trans.reject(msg.error);
		
		trans.resolve(trans.singleResponse ? msg.responses[0] : msg.responses);
	},
	
	// send requests message over websocket channel
	// can optionally trigger block event
	send(ressource,action,payload,blocking) {
		return this.sendMultiple([this.prepare(ressource,action,payload)],blocking,true);
	},
	sendMultiple(requests,blocking,singleResponse) {
		return new Promise((resolve,reject) => {
			if(this.conn === null)
				return reject('websocket connection not open');
			
			if(!Array.isArray(requests) || requests.length === 0)
				return reject('need non-empty requests array');
			
			if(typeof blocking === 'undefined')
				blocking = false;
			
			if(typeof singleResponse === 'undefined')
				singleResponse = false;
			
			// get unique transaction number
			let transactionNr = 0;
			do{ transactionNr = Math.floor(Math.random() * 399999) + 100000; }
			while(typeof this.transactions[transactionNr] !== 'undefined');
			
			// store transaction for response matching
			this.transactions[transactionNr] = {
				blocking:blocking,
				reject:reject,
				resolve:resolve,
				singleResponse:singleResponse
			};
			
			if(this.debug)
				console.log('WebSocket ->', {
					transactionNr:transactionNr,
					requests:requests
				});
			
			this.conn.send(JSON.stringify({
				transactionNr:transactionNr,
				requests:requests
			}));
			
			// block entire websocket connection, if transaction is blocking
			if(blocking) {
				this.blockingCount++;
				
				// only use callback on initial blocking transaction
				if(this.blockingCount === 1)
					this.event('blocking',true);
			}
		});
	}
};