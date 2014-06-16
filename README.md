# About

Javascript Peer implementation of the Jet Protocol. Visit the
[Jet homepage](http://jetbus.io.) for general information.

# API

## `peer = new jet.peer(config)`

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

## `state = peer.state(desc, [callbacks])`

Creates a State given the information provided by `desc`. The supported `desc` fields
are:

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
