# theRock.js

This is a simple node.js library to interact with www.therocktrading.com. It may be simply used as an API wrapper but it contains 
some additional asynchronous methods which could be helpful to automate some operations: look at [start](#start) and [subscribe](#subscribe)
if interested.
x
Tips are very much appreciated: 18s8sDkWsnp9F91CaGpb8o4SoRKT351iRW

## Doc 

All callbacks should follow node's standard `callback = function(error, result)`

### Public Methods

* [tickers](#tickers)
* [checkTrades](#checkTrades)
* [orderbook](#orderbook)
* [subscribe](#subscribe)
* [unsubscribe](#unsubscribe)


### Private Methods

* [getBalance](#getBalance)
* [getOrders](#getOrders)
* [placeOrder](#placeOrder)
* [cancelOrder](#cancelOrder)
* [start](#start)
* [stop](#stop)

### Meta

* [set](#set)

### Events

* [fund](#fund)
* [orderPlaced](#orderPlaced)
* [orderCancelled](#orderCancelled)
* [start](#Estart)
* [stop](#Estop)
* [abort](#Eabort)
* [error](#Eerror)
* [up](#Eup)
* [changes](#Echanges)
* [trade](#Etrade)


## Quick Examples

### subscribe (public)
```javascript
var TheRock = require('./theRock.js').TheRock
	
var trt = new TheRock()

trt.subscribe('BTCEUR')

trt.on('BTCEUR', function(obj){
	console.log(obj)
})

```

### start (private)
```javascript

var id = {							
	username: 'yourUserName',
	password: 'yourPassword',
	api_key: 'yourAPIKEY'
}
	
var trt = new TheRock(id)

trt.start()

trt.on('changes', function(changes){
	console.log(changes)
})

trt.on('start', function(){
	console.log('started!')
	
	console.log(trt.balance)
	console.log(trt.offers)
	console.log(trt.trades)
})

```


#	Public Methods 

<a name="tickers">
###tickers(fund, callback)</a>
The API call to obtain market ticker for a specific fund. If `fund` is not specified, it returns all market tickers at once.

* `fund` [optional] the string representation of the fund (e.g.: BTCEUR, BTCUSD, etc);
			
<a name="checkTrades">
###checkTrades(fund, interval, callback)</a>
The API call to obtain latest market trades.


* `fund` the string representation of the fund (e.g.: BTCEUR, BTCUSD, etc)
* `interval` get only trades executed in the last 'interval' of time (seconds)

<a name="orderbook">
###orderbook(fund, callback)</a>

Get the full orderbook for a currency pair.

* `fund` the string representation of the fund (e.g.: BTCEUR, BTCUSD, etc)


<a name="subscribe">
###subscribe(fund, options) </a>

This method periodically checks if changes occur in the specified fund. The orderbook and trade history are checked every 2 seconds, you can change this
number using [set](#set) with `bookINTERVAL` or `tradesINTERVAL` as parameter. (Remember that doing more than 5 api calls per second may
result in a temporary ban from the server)

* `fund` the string representation of the fund (e.g.: BTCEUR, BTCUSD, etc)
* `options`
  * `'book'`	to be notified if the orderbook changes
  * `'trades'`	to be notified if some trades has occurred
  * `'all'`  the sum of the above [default]
 
It emits only one kind of event: <a name="fund">`'fund'`</a> (for example, 'PPCEUR'), which transmits an object to the callback: 

* `{type: 'subscribed', to:'trades'/'book'/'all'}`
* `{type: 'trade', trade: [object]}`
* `{type: 'book', book: [object]}`
* `{type: 'error', where: 'subscribe'/'trades'/'book', info: textual description of the error}`	
  * `'subscribe'` this one occurs on start-up, when the app tries to retrieve the list of funds. If there are errors, it tries to reconnect 5 times, every 5 seconds (use [set](#set) 
  on 'reconnectMAX' or 'reconnectINTERVAL' to change those values) and then emits the error and gives up. 
  * `'trades'/'book'`this one occurs when the client tries to check orderbook or 
trade history more than 30 times without success. You can change this number using [set](#set) with `bookMAXerrors` or `tradesMAXerrors` as parameter.




<a name="unsubscribe">
###unsubscribe(fund, options) </a>

Same options of [subscribe](#subscribe).
It emits an event <a name="fund">`'fund'`</a> which transmits an object to the callback:

* `{type: 'unsubscribed', to:'trades'/'book'/'all'}`








#	Private Methods

<a name="getBalance">
###getBalance(currency, callback)</a>

* `currency` the ISO-code of the currency of which you want to know the balance. If not specified, the method retrieves all balances at once.

<a name="getOrders">
###getOrders(callback)</a>

It retrieves the full list of open orders of your account.


<a name="placeOrder">
###placeOrder(params,callback)</a>

The API call to place a new order.

* `params` must be an object with the following properties:
  * fund_name - the string representation of the fund (e.g.: BTCEUR, BTCUSD, etc)
  * order_type - B for Buy order or S for Sell order
  * amount - the amount you want to Buy/Sell
  * price - the price for your order to be filled
 
It returns an error message on failure, the ID of the newly placed order on success. Furthermore, on success it emits an <a name= "orderPlaced">`orderPlaced`</a> event which transmits all sensitive data of the newly created order.

 
 <a name="cancelOrder">
###cancelOrder(id,callback)</a>

The API call to cancel an active order of an account:

* `id` the id of the order you want to cancel

It returns an error/success message. If success it emits an <a name= "orderCancelled">`orderCancelled`</a>
event which transmits the id of the deleted order.



 <a name="start">
###start()</a>

This method periodically check open orders and balances. When a change occurs, it emits one or more events.
Balances and open orders are checked every 2 seconds, you can change this
number using [set](#set) with `monitorINTERVAL` as parameter. (Remember that doing more than 5 api calls per second may
result in a temporary ban from the server)

Events

* <a name="Estart"> `start` </a> emitted when the initial phase is over and the app start to monitor offers and balances.
* <a name="Eabort"> `abort` </a> emitted if the inital phase had a failure. It won't monitor the account after this event. If there are errors,
 it tries to reconnect 5 times, every 5 seconds (use [set](#set) on `reconnectMAX` or `reconnectINTERVAL` to change those values) 
 and then emits the error and gives up
* <a name="Eerror"> `error` </a> this one occurs when the client tries to check balances and open orders
 more than 30 times in a row without success. You can change this number using [set](#set) with `monitorMAXerrors` as parameter.
* <a name="Eup"> `up`</a> emitted every time that a successfull update operation is finished.
* <a name="Echanges"> `changes`</a> emitted every time that some changes occurs in balances and/or open orders. It carries an object with
detailed informations about what changed.
* <a name="Etrade"> `trade`</a> for simplicity, this event notifies only changes in balances. N.B.: the event
can't be put in one-to-one corrispondence with finalized trades happened in the market, i.e. you can receive an event with "bought" property but an empty
"sold" property and after some seconds receive another message with the "sold" part; this is due to the structure of the API and I'm actually 
thinking about some workarounds to improve it. Furthermore, if two or more trades happens simultaneously (i.e., between two update requests)
it's quite difficult to determine in a biunique way what trades have really happened (given that there are not api for stocks and fees). 
Suggestions are very welcomed! 


After the `start` event, some properties are available to check in every moment: `trt.balances` and `trt.offers` shows,
respectively, all balances and all open orders; `trt.trades` show a list of the last trades (collected from the `trade` event), 
use [set](#set) with 'tradesLength' to change the number of trades to store - default to 200).






 <a name="stop">
###stop()</a>

it stops the app from monitoring account's data.

Events

* <a name="Estop"> `stop` </a> when successfully stopped.

# Meta

<a name="set">
###set(param, value) </a>

Use it to modify the value of some parameter you'd like to change.

[[list of parameters here]]

