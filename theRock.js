var Events = require('events').EventEmitter;
var util = require('util');
var request = require('request');
var async = require('async');
var _ = require('underscore')


	
function TheRock(id) {
	
	if (id) {
					this.username = id.username;
					this.password = id.password;
					this.api_key = id.api_key;
	}
	
	this.id =  this.api_key && this.username && this.password ? true:false
	
	this.apiURL = 'https://www.therocktrading.com/api/'
	

	this.offers = [];
	this.trades = [];
	this.funds = false;
	this.balance = {};
	
	this.reconnectINTERVAL = 5; //seconds       // time interval before trying to reconnect on start-up
	this.reconnectMAX = 5;								// max number of reconnections before emitting an error
	this.monitorINTERVAL = 2 //seconds				// monitoring rate
	this.monitorMAXerrors = 30;						// max number of monitor error before emitting an error
	this.tradesLength = 200;
	
	this.timeoutINTERVAL = 7;
	this.bookINTERVAL = 2;
	this.tradesINTERVAL = 2;	
	this.bookMAXerrors = 30;
	this.tradesMAXerrors = 30;

	
	this.reconnectTRY = 0;
	this.reconnectTRY_subscribe = 0;
	this.monitorErrors = 0;
	this.monitoring = false;
	this.periodic = true;
	
		
	_.bindAll(this,'privreq','pubreq','tickers', 'checkTrades', 'orderbook', 'getBalance','getOrders', 'placeOrder', 'cancelOrder' )
	_.bindAll(this,'start', 'stop', 'monitor', '_monitor','watch', 'set', 'subscribe', 'unsubscribe')
	
	var self = this

	this.on('start', function(){
		self.monitor();	
	})
	
	this.on('trade', function(trade){
		self.trades.push(trade)
		var inpiu = self.trades.length - self.tradesLength;
		if (inpiu > 0) self.trades.splice(0, inpiu)
	})
	
	this.on('orderCancelled', function(id){
		for (i=0; i<self.orders.length; i++) {
			if (self.offers[i].order_id == id) {
					self.offers.splice(i,1)			
			}		
		}	
	})	
	
	
	this.on('orderPlaced', function(params){
		self.offers.push({
			id: params.id,
			fund_name: params.fund_name,
			type: params.order_type,
			price: params.price,
			amountOpen: params.amount,
			amountUnfilled: params.amount
		})	
	})
	

}

util.inherits(TheRock, Events)

//------------------------------------------------------------------------------------------------------------------------		requests


TheRock.prototype.pubreq = function(path, cb) {																			// pubreq
		var trt = this
		var options = {
   			 url: trt.apiURL+path,
    			 headers: { 'Content-Type': 'application/json'	},
				 timeout: this.timeoutINTERVAL*1000
		};
		request(options, function(err, httpRes, body){
								if (err) {
										cb(err)								
								}
								else {
												try {
													body = JSON.parse(body)	
													cb(null, body)																					
												} catch(e) {
													cb(e)
												}				
								}
		})
}

TheRock.prototype.privreq = function(api, params, cb) {																//privreq
		var trt = this
		
		var options = {
   			 url: trt.apiURL+api,
    			 headers: { 'Content-Type': 'application/json'	},
    			 timeout: this.timeoutINTERVAL*1000
		};

		params.username = trt.username;
		params.password = trt.password;
		params.api_key = trt.api_key;
	
		
		request.post(options, callback).form(params)
		
		
		 function callback(err, res, body){
								if (err) {
										return cb(err)								
								}
								else {
												try {
													body = JSON.parse(body)	
																																	
												} catch(e) {
													return cb(e)
												}	
												return cb(null, body)				
								}
		}
}

//------------------------------------------------------------------------------------------------------------------------		public

TheRock.prototype.tickers = function(fund, cb) {
		var trt = this
		if ( typeof arguments[0] == 'string' ) {

							var path = 'ticker/'+arguments[0] ;
							cb = arguments[1]
				
		}	else 
		if ( typeof arguments[0] == 'function' ) {
						
							cb = arguments[0]
							var path = 'tickers';

		} 
		else throw new Error('tickers: bad arguments')
		
				trt.pubreq(path, function(err, res) {
						if (err) {
							cb(err)				
						} 
						else {
							cb(null, res)							
						}
				})
		
		
}

TheRock.prototype.checkTrades = function(fund, fromSecondsAgo, cb) {

	if ( typeof fund != 'string' )	throw new Error('checkTrades: bad arguments')
	
	var trt = this
	
	var timestamp = Math.floor(new Date().getTime()/1000)

	var path = 'trades/'+fund 
	
	if (typeof arguments[1] == 'number' && typeof arguments[2] == 'function') {
			path += '/?since='+(timestamp-fromSecondsAgo)
	} 
	else if ( typeof arguments[1] == 'function' ) {
			cb = arguments[1]

	} else throw new Error('checkTrades: bad arguments')
		
		trt.pubreq(path, function(err, res){
				cb(err, res)
		})																

}

TheRock.prototype.orderbook = function(fund, cb) {
	if ( typeof fund != 'string' )	throw new Error('orderbook: bad arguments')
	
	var path = 'orderbook/'+fund
	
	this.pubreq(path, function(err, res){
				cb(err, res)
	})	
	
}


//------------------------------------------------------------------------------------------------------------------------		subscribe

TheRock.prototype.subscribe = function(fund, option) {
	
		
		/*
				fund = the name of the fund you want to follow
				options = 'book'/'trades'/'all' --- defaults to 'all' if not specified
				
				emit 'subscribed'/'error' and then events 'fund' with the trades as arguments.
		*/
		
		
		if ( typeof fund != 'string' ) throw new Error('subscribe: bad argument: fund')		

		if (option ==  undefined ) option = 'all'
		else if (!( typeof option == 'string' || option == 'book' || option == 'trades' || option == 'all') ) throw new Error('subscribe: bad argument: option')
		

		
		var self = this;
		
		if ( typeof self.funds != 'object' ) {
				
				
				function tesst() {
					if (self.reconnectTRY_subscribe == self.reconnectMAX) {
											self.reconnectTRY_subscribe = 0;
											return false
					} 
					else return true
				}
				
				async.whilst(tesst, setFunds, function(via) {
				
						if (via) continiu();
						else {
							self.emit(fund, {type:'error', where:'subscribe'})							
						}
				
				} )
				
						
		} else {
			continiu()
		}
		
	
		

		
		function setFunds(cb) {
					self.funds = {};
				self.tickers(function(err, res){
							if (err) {
								self.reconnectTRY_subscribe++
								return setTimeout(cb, self.reconnectINTERVAL*1000) 																																			
							}
							else {
									if (res.result.errorCode == 'OK') {
														for (funx in res.result.tickers) {
																	if (!self.funds.hasOwnProperty(funx)) {
																					self.funds[funx] = {}	
																					self.funds[funx].name = funx
																	}
														}	
										return cb(true)			
									}
									else {
										self.reconnectTRY_subscribe++
										return setTimeout(cb, self.reconnectINTERVAL*1000) 																										
									}
							}	
					})
		}
		
		function continiu() {

			if (!self.funds.hasOwnProperty(fund))	throw new Error('wrong fund name')
			else {
				self.emit(fund, {type:'subscribed', to:option})
			}
										self.funds[fund].book = {};
										self.funds[fund].trades = [];
										self.funds[fund].periodicBOOK = 0;
										self.funds[fund].bookErrors = 0;
										self.funds[fund].periodicTRADES = 0;
										self.funds[fund].tradesErrors = 0;
										self.funds[fund].lastTradeID = 0;
										self.funds[fund].booking = false;
									   self.funds[fund].cb1 = _.bind(function(err, res) {  //trades
													//console.log('trades')
									   				if (err) {
																this.tradesErrors++
																//console.log('trades '+this.name+' error n. '+this.tradesErrors+'		errorType: '+err)
  																if (this.tradesErrors == self.tradesMAXerrors ) {
																		self.emit(this.name, {type:'error',where:'trades', info:'retrieving trades failed '+self.tradesMAXerrors+' times'})																										
																		}
														}
														else if (this.lastTradeID == 0) {
																	this.lastTradeID = self.findLastID(res) ? self.findLastID(res) : 0; 
														}	
														else {
																			this.tradesErrors = 0;
																			var newTrades = []
																			for (i=0; i<res.length; i++) {
																					if (res[i].tid > this.lastTradeID) {
																						newTrades.push(res[i])
																						self.emit(this.name, {type:'trade', trade:res[i]})																				
																					}
																			}															
																			this.trades = this.trades.concat(newTrades)
																			var inpiu = this.trades.length - 200;
																			if (inpiu > 0) this.trades.splice(0, inpiu)
																			
																			if ( newTrades.length>0 ) this.lastTradeID = self.findLastID(newTrades)
																			
														}										   	
										  }, self.funds[fund])
											   
									   self.funds[fund].cb2 = _.bind(function(err, res) { //book
									   				this.booking = false
									   				if (err) {
																this.bookErrors++
																//console.log('book '+this.name+' error n. '+this.bookErrors+'		errorType: '+err)
																if (this.bookErrors == self.bookMAXerrors ) {
																		self.emit(this.name, {type:'error',where:'book',info:'retrieving orderbook failed '+self.bookMAXerrors+ ' times'})																										
																}
														}
														if (!_.isEqual(res, this.book)){
															this.bookErrors = 0;
															this.book = res
															self.emit(this.name, {type:'book', book:this.book} )
														}								   
									   }, self.funds[fund])
									   self.funds[fund].checkTrades = _.partial(self.checkTrades,fund,self.tradesINTERVAL*self.tradesMAXerrors*100, self.funds[fund].cb1) ;	
									   
									   self.funds[fund]._checkBook = _.partial(self.orderbook, fund, self.funds[fund].cb2)
									   self.funds[fund].checkBook = _.bind(function(){
														
														if (!this.booking) {
																this.booking = true
																this._checkBook()
														} else {
																//console.log('chekBook: occupato!')
																this.bookErrors++
																//console.log('book '+this.name+' error n. '+this.bookErrors+'		errorType: last check still not finished')
																if (this.bookErrors == self.bookMAXerrors ) {
																		self.emit(this.name, {type:'error',where:'book',info:'retrieving orderbook failed '+self.bookMAXerrors+ ' times'})																										
																}														
														}											   
											   
											   
									   }, self.funds[fund])
											   
							
		
		switch (option) {
				case 'all':
					self.funds[fund].periodicTRADES = setInterval(self.funds[fund].checkTrades, self.tradesINTERVAL*1000)
					self.funds[fund].periodicBOOK = setInterval(self.funds[fund].checkBook, self.bookINTERVAL*1000)
					break;
				case 'trades':
					self.funds[fund].periodicTRADES = setInterval(self.funds[fund].checkTrades, self.tradesINTERVAL*1000)
					break;
				case 'book':
					self.funds[fund].periodicBOOK = setInterval(self.funds[fund].checkBook, self.bookINTERVAL*1000)
					break;
		}
		
		}	
			
}

TheRock.prototype.unsubscribe = function(fund, option) {
		var self = this
		
		if ( typeof fund != 'string' || !self.funds.hasOwnProperty(fund) ) throw new Error('subscribe: bad argument: fund')		

		if ( option ==  undefined ) option = 'all'
		else if (!( typeof option == 'string' || option == 'book' || option == 'trades' || option == 'all') ) throw new Error('subscribe: bad argument: option')
		
		switch (option) {
				case 'all':	
					clearInterval(self.funds[fund].periodicTRADES)
					clearInterval(self.funds[fund].periodicBOOK)
					self.emit(fund, {type:'unsubscribed', to:'all'})
					break;
				case 'trades':
					clearInterval(self.funds[fund].periodicTRADES)
					self.emit(fund, {type:'unsubscribed', to:'trades'})
					break;
				case 'book':
					clearInterval(self.funds[fund].periodicBOOK)
					self.emit(fund, {type:'unsubscribed', to:'book'})
					break;
		}



}




//------------------------------------------------------------------------------------------------------------------------		private


TheRock.prototype.getBalance = function(currency, cb) {
	
	var trt = this
	
	if (!trt.id) {
			throw new Error('You must provide username, password and api_key to retrieve your balance')	
	}	
	
	if ( typeof arguments[0] === 'string' && typeof arguments[1]=== 'function' ) {
							var params = { type_of_currency: currency }
							cb = arguments[1]
							continiu(params)			
		}	else 
	if ( typeof arguments[0] === 'function' ) {
			cb = arguments[0]
			var params = {}
			continiu(params)
	} else {
			throw new Error('getBalance: bad arguments')
	}
	

			function continiu(params) {
							var api = 'get_balance'
							trt.privreq(api, params, function(err, res) {
											if (err) {
												return cb(err,null)				
											} 
											else {
												return cb(null, res.result)																		
											}
							})
			}				


}


TheRock.prototype.getOrders = function(cb) {	
	var trt = this
	
	if (!trt.id) {
			throw new Error('You must provide username, password and api_key to do this')	
	}
	
							var api = 'get_orders';
							params = { };
							trt.privreq(api, params, function(err, res) {
											if (err) {
												return cb(err)				
											} 
											else {
												if (res.result.errorCode == 'OK') {
													return cb(null, res.result.orders)	
												}
												else {
													res = JSON.stringify(res)
													return cb(res)												
												}						
											}
							})		
}

TheRock.prototype.placeOrder = function(params, cb) {																
							
							/*params = { 
								fund_name - the string representation of the fund (e.g.: BTCEUR, BTCUSD, etc)
								order_type - B for Buy order or S for Sell order
								amount - the amount you want to Buy/Sell
								price - the price for your order to be filled
							
							};*/
							
							var trt = this
							if (!trt.id) {
										throw new Error('You must provide username, password and api_key for this')	
							}
							var api = 'place_order';
							
							
							trt.privreq(api, params, function(err, res) {
											if (err) {
												cb(err)				
											} 
											else {
												if (res.result[0].errorCode == 'OK') {
															params.id = res.result[0].order_id
															trt.emit('orderPlaced', params)
															cb(null, res.result[0].order_id)	
												} else {
															res = JSON.stringify(res)
															cb(res)												
												}								
											}
							})		
				

}
TheRock.prototype.cancelOrder = function(id, cb) {																
	var trt = this	
	if (!trt.id) {
			throw new Error('You must provide username, password and api_key for this')	
	}
	
	 
							if (typeof id != 'number') { return cb('cancelOrder: bad argument')}
								
							var api = 'cancel_order';
							var params = {
								order_id: id							
							}
							
							trt.privreq(api, params, function(err, res) {
											if (err) {
												cb(err)				
											} 
											else {
												if (res.result[0].errorCode == 'OK') {
															trt.emit('orderCancelled', id)
															cb(null, 'order n. '+id+' cancelled')	
												} else {
															res = JSON.stringify(res)
															cb(res)												
												}				
											}
							})		
							
}

//------------------------------------------------------------------------------------------------------------------------		start

TheRock.prototype.start = function() {

	var zolf = this;
	
	
	async.parallel([zolf.getOrders, zolf.getBalance], function(err, res){
		if (err) {
							//console.log(err);
							//console.log('reconnectTRY '+zolf.reconnectTRY+' try to reconnect in ' + zolf.reconnectINTERVAL+' seconds')
							if (zolf.reconnectTRY == zolf.reconnectMAX ) {
								zolf.reconnectTRY = 0;
								zolf.emit('abort')
							}
							else {
											zolf.reconnectTRY ++
											return setTimeout(zolf.start, zolf.reconnectINTERVAL*1000)
							}
		}
		else {
					zolf.reconnectTRY = 0;
					zolf.offers = res[0]
					for (i=0; i<res[1].length; i++) {
																if (	res[1][i].currency == 'DOGE' ) {res[1][i].currency = 'DOG'}
																zolf.balance[res[1][i].currency] = {};
																zolf.balance[res[1][i].currency].balance = res[1][i].balance;
																zolf.balance[res[1][i].currency].trading_balance = res[1][i].trading_balance
					}
					return zolf.emit('start')
		}
			
	})
	
}


TheRock.prototype.stop = function() {
			var trt = this;
			clearInterval(trt.periodic)	
			trt.periodic = true;
			trt.emit('stop')	
}

//------------------------------------------------------------------------------------------------------------------------		monitor

TheRock.prototype.monitor = function(){
	var zolf = this;
	zolf.periodic = setInterval(zolf._monitor, zolf.monitorINTERVAL*1000) 
}

TheRock.prototype._monitor = function() {

		var zolf = this;
		if (!zolf.monitoring) {
					zolf.monitoring = true
					async.parallel([zolf.getBalance, zolf.getOrders], function(err, res){
										zolf.monitoring = false
										if (err) {
													zolf.monitorErrors ++
													//console.log('monitor error n. '+zolf.monitorErrors+'		errorType: '+err)
													if (zolf.monitorErrors == zolf.monitorMAXerrors ) {
														zolf.monitorErrors = 0;
														zolf.emit('error')																										
													}
										}
										else {
													zolf.monitorErrors = 0;
													zolf.emit('up')
													zolf.watch(res[0],res[1])
										}
					})	

		}
		else {
				zolf.monitorErrors ++
				//console.log('monitor error n. '+zolf.monitorErrors+'		errorType: occup')
				if (zolf.monitorErrors == zolf.monitorMAXerrors ) {
									zolf.monitorErrors = 0;
									zolf.emit('error')																										
				}
		}
	
}

TheRock.prototype.watch = function(bal, ord) {

	var timestamp = Math.floor(new Date().getTime()/1000)	
	var trt = this;
	
																										// analisi dei bilanci

	
	var bought = [];
	var sold = [];
	
	for (i=0; i<bal.length; i++) {
			if (bal[i].currency == 'DOGE' ) {bal[i].currency = 'DOG'}
			
			var diff = trt.balance[bal[i].currency].balance - bal[i].balance

			
			if ( diff < 0  ) {
				bought.push({
					currency: bal[i].currency,
					amount: (-1)*diff		
				})
			} else
			if (diff > 0) {
				sold.push({
					currency: bal[i].currency,
					amount: diff		
				})
			}
	}

																														//analisi delle offerte
				
	
							//the following is ugly and inefficient, to improve
	var niu = _.clone(ord)
	var old = _.clone(trt.offers)

	var modified = []
	for (i=0; i<niu.length; i++) {				
		for (j=0; j<old.length; j++) {
			if (_.isEqual(niu[i],old[j])) {
							niu[i] = false; old[j] = false 
			} else
			if	( niu[i].id == old[j].id ) {
					modified.push({old:old[j],new:niu[i]})	
												niu[i] = false; old[j] = false 	
			}
		}			
	}		

	niu = _.compact(niu)
	old = _.compact(old)

	
	var changes = {}
	if (old.length > 0 || niu.length > 0 || modified.length > 0) {
				changes.offers = {
					cancelled: old,	
					created: niu,
					modified: modified
				}
	}
								
	
		
																														//eventi
																														
	if  (bought.length > 0 || sold.length  > 0 )  {
			var trade = {}
			trade.timestamp = timestamp
			trade.bought = bought;
			trade.sold = sold
			trt.emit('trade', trade)	
	} 
	 
	if (trade) changes.balances = trade
	
	 																				
	if (!_.isEqual(changes, {})) trt.emit('changes', changes)
	
	
	// alla fine aggiorno bilanci e offerte con i nuovi dati
	trt.offers = ord
	for (i=0; i<bal.length; i++) {
																if (	bal[i].currency == 'DOGE' ) {bal[i].currency = 'DOG'}
																trt.balance[bal[i].currency].balance = bal[i].balance;
																trt.balance[bal[i].currency].trading_balance = bal[i].trading_balance
	}
}

//------------------------------------------------------------------------------------------------------------------------		meta

TheRock.prototype.set = function(param, value) {
	
	if (!this.hasOwnProperty(param) && typeof this[param] == 'number') throw new Error('set: bad arguments')
	
	this[param] = value	

}



TheRock.prototype.findLastID = function(array) {
		var ID = false;		
		for (i=0; i<array.length; i++) {
			if (i==0)	 ID = array[0].tid
			else {
				if (array[i].tid > ID) {ID = array[i].tid}
			}					
		}
		return ID
}

exports.TheRock = TheRock

