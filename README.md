# About

Javascript Peer implementation of the Jet Protocol. Visit the
[Jet homepage](http://jetbus.io.) for general information.

# API

## `peer = new jet.Peer(config)`

Creates and returns a new Jet Peer instance with the specified config.
The supported config fields are:

- `url`: {String} The Jet Daemon Websocket URL
- `onOpen`: {Function, Optional} Called when the connection to the Daemon has been established
- `onError`: {Function, Optional} Called on network or other error
- `onClose`: {Function, Optional} Called whenever the connection has been closed

```javascript
var peer = new jet.Peer({
  url: 'ws://jet.nodejitsu.com:80',
  onOpen: function() {
    console.log('connection to Daemon established');
  }
});
```

## `peer.close()`

Closes the connection to the Daemon.

## `fetch = peer.fetch(rule, fetchCb, [callbacks])`

Creates and return a Fetch instance. The supported fields of `rule` are:

- `path`: {Object, Optional} For path based fetches
- `value`: {Object, Optional} For value based fetches
- `valueField`: {Object, Optional} For valuefield based fetches
- `sort`: {Object, Optional} For sorted fetches

If `rule` is a empty Object, a "Fetch all" is set up.

```javascript
var fetchAll = peer.fetch({}, function(path, event, value) {
  console.log(path, event, value);
});
```

The `fetchCb` arguments for non-sorting fetches are:

- `path`: {String} The path of the State / Method which triggered the Fetch Notification
- `event`: {String} The event which triggered the Fetch Notification ('add', 'remove',
   'change')
- `value`: {Any | undefined} The current value of the State or `undefined` for Methods

```javascript
var fetchPerons = peer.fetch({
  path: {
    startsWith: 'persons/'
  }
}, function(path, event, value) {
  console.log(path, event, value);
}, {
  success: function() {
    console.log('fetch setup successfully');
  },
  error: function(e) {
    console.log('fetch setup failed', e);
  }
}});
```

The `fetchCb` argument for sorting fetches is an Object with:

- `n`: {Number} The number of matches within the given range (from-to)
- `changes`: {Array} The changes compared to the previous time the function was
  invoked:

  - `path`: {String} The path of the State / Method which triggered the Fetch Notification
  - `index`: {Number} The index / position within the range (from-to)
  - `value`: {Any | undefined} The current value of the State or `undefined` for Methods

```javascript
var sortedPersons = [];
var fetchPerons = peer.fetch({
  path: {
    startsWith: 'persons/'
  },
  sort: {
    from: 1,
    to: 10,
    byValueField: {
      age: 'number'
    }
  }
}, function(sorted) {
  sortedPersons.length = sorted.n;  
  sorted.changed.forEach(function(change) {
    // indices are 1 based (not 0 based).
    sortedPersons[change.index-1] = {
      name: change.value.name,
      age: change.value.age
    };
  });
});
```

## `method = peer.method(desc, [callbacks])`

Creates and returns a Jet Method given the information provided by `desc`.
The supported `desc` fields are:

- `path`: {String} The unique path of the Method
- `call`: {Function, Optional} The Function which "executes" the method (synchonous)
- `callAsync`: {Function, Optional} The Function which "executes" the method
  (asychronously)

Don't specify `call` and `callAsync` at the same time.

The arguments to the `call` Function are:

- An Object with the forwarded "args" field from of original "call" Request
- An unpacked Array, if the forwarded "args" of the original "call" Request
  field was an Array

The `call` method can return anything or throw an Error (String/JSON-RPC error)
if required.

```javascript
var greet = peer.method({
  path: `greet`,
  call: function(who) {
    if (who.first === 'John') {
      throw 'John is dismissed';
    }
    var greet = 'Hello Mr. ' + who.last;
    console.log(greet);
    return greet;
  }
})

var sum = peer.method({
  path: `sum`,
  call: function(a,b,c,d,e) {
    var sum = a + b +c + d + e;
    return sum;
  }
}, {
  success: function() {
    console.log('method added successfully');
  },
  error: function(e) {
    console.log('method adding failed', e);
  }
})
```

The arguments to the `callAsync` Function are:

- `reply`: {Function} Method for sending the result/error.
- An Object with the forwarded "args" field from of original "call" Request
- An unpacked Array, if the forwarded "args" of the original "call" Request
  field was an Array

The `callAsync` method can return anything or throw an Error (String/JSON-RPC error)
if required.

```javascript
var greet = peer.method({
  path: `greet`,
  callAsync: function(reply, who) {
    if (who.first === 'John') {
      throw 'John is dismissed';
    }
    setTimeout(function() {
      if (allOk) {
        var greet = 'Hello Mr. ' + who.last;
        console.log(greet);
        reply({
          result: greet
        });
      } else {
        reply({
          error: 'something went wrong'
        });
      }
    }, 100);
  }
})
```


## `state = peer.state(desc, [callbacks])`

Creates and returns a State given the information provided by `desc`.
The supported `desc` fields are:

- `path`: {String} The unique path of the State
- `value`: {Any} The initial value of the State
- `set`: {Function, Optional} The callback Function, that handles State "set"
  messages (synchronously)
- `setAsync`: {Function, Optional} The callback Function, that handles State "set"
  messages (asynchronously)

Don't specify `set` and `setAsync` at the same time.

The argument to the `set` is the requested `newValue`. The function is free to:

- return nothing, a State change is posted automatically with the `newValue`
- throw an Error, the Error should be a String or an Object with `code` and `message`
- return on Object with the supported fields:
  - `value`: {Any, Optional} the "real/adjusted" new value. This is posted as the
     new value.
  - `dontNotify`: {Boolean, Optional} Don't auto-send a change Notification


```javascript
var test = peer.state({
  path: 'test',
  value: 123,
  set: function(newValue) {
    if (newValue > 999999){
      throw 'too big';
    }
    setTest(newValue);
  }
},{
  success: function() {
    console.log('state added successfully');
  },
  error: function(e) {
    console.log('state adding failed', e);
  }
});

var testAdjust = peer.state({
  path: 'testAdjust',
  value: 123,
  set: function(newValue) {
    if (newValue > 999999){
      throw 'too big';
    } else if (newValue < 1000) {
      newValue = 1000; // adjust the request value
    }
    setTest(newValue);
    return {
      value: newValue
    };
  }
});
```

The arguments to the `setAsync` is a `reply` Function and the requested `newValue`.
The Function is free to:

- return nothing, the implementation MUST call the `reply` Function with
  - `result`: {Truish, Optional} Operation was success
  - `error`: {String/JSON-RPC Error, Optional} Operation failed
  - `dontNotify`: {Boolean, Optional} Don't auto-send a change Notification
- throw an Error, the Error should be a String or an Object with `code` and `message`

The `callbacks` object is optional. When specified, the supported fields are:

- `success`: {Function, Optional} Called, when adding the State to the Daemon was
  ok
- `error`: {Function, Optional} Called, when adding the State to the Daemon was not
  ok

```javascript
var testAsync = peer.state({
  path: 'testAsync',
  value: 123,
  setAsync: function(reply, newValue) {
    if (newValue > 999999){
      throw 'too big';
    }
    setTimeout(function() {
      if (allOk) {
        setTest(newValue);
        reply({
          result: true
        });
      } else {
        reply({
          error: 'something went wrong'
        });
      }
    },100);
  }
});

var testAsyncAdjust = peer.state({
  path: 'testAsyncAdjust',
  value: 123,
  setAsync: function(newValue) {
    if (newValue > 999999){
      throw 'too big';
    }
    setTimeout(function() {
      if (allOk) {
        if (newValue < 1000) {
          newValue = 1000;
        }
        setTest(newValue);
        reply({
          result: true,
          value: newValue
        });
      } else {
        reply({
          error: 'something went wrong'
        });
      }
    },100);
  }
});
```
