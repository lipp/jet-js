'use strict';

var jet = window.jet = window.jet || {};

jet.JsonRPC = function(config) {
  var encode = JSON.stringify;
  var decode = JSON.parse;
  var WebSocket = window.WebSocket || window.MozWebSocket;
  var url = config.url || 'ws://127.0.0.1:11123';
  var wsock = new WebSocket(url, 'jet');
  var messages = [];
  var isDef = jet.util.isDef;
  var isArr = jet.util.isArr;
  var invalidParams = jet.util.invalidParams;
  var errorObject = jet.util.errorObject;
  var closed;
  var that = this;

  this.queue = function (message) {
    messages.push(message);
  };

  var willFlush = true;
  this.flush = function () {
    var encoded;
    if (messages.length === 1) {
      encoded = encode(messages[0]);
    } else if (messages.length > 1) {
      encoded = encode(messages);
    }
    if (encoded) {
      if (config.onSend) {
        config.onSend(encoded, messages);
      }
      wsock.send(encoded);
      messages.length = 0;
    }
    willFlush = false;
  };

  var requestDispatchers = {};
  var responseDispatchers = {};

  this.addRequestDispatcher = function(id, dispatch) {
    requestDispatchers[id] = dispatch;
  };

  this.removeRequestDispatcher = function(id) {
    delete requestDispatchers[id];
  };

  this.hasRequestDispatcher = function(id) {
    return isDef(requestDispatchers[id]);
  };

  var dispatchResponse = function (message) {
    var mid = message.id;
    var callbacks = responseDispatchers[mid];
    delete responseDispatchers[mid];
    if (callbacks) {
      if (isDef(message.result)) {
        if (callbacks.success) {
          callbacks.success(message.result);
        }
      } else if (isDef(message.error)) {
        if (callbacks.error) {
          callbacks.error(message.error);
        }
      }
    }
  };

  // handles both method calls and fetchers (notifications)
  var dispatchRequest = function (message) {
    var dispatcher = requestDispatchers[message.method];
    try {
      dispatcher(message);
    } catch (err) {
      if (isDef(message.id)) {
        that.queue({
          id: message.id,
          error: errorObject(err)
        });
      }
    }
  };

  var dispatchSingleMessage = function (message) {
    if (message.method && message.params) {
      dispatchRequest(message);
    } else if (isDef(message.result) || isDef(message.error)) {
      dispatchResponse(message);
    }
  };

  var dispatchMessage = function (message) {
    var decoded = decode(message.data);
    willFlush = true;
    if (config.onReceive) {
      config.onReceive(message.data, decoded);
    }
    if (isArr(decoded)) {
      decoded.forEach(function (message) {
        dispatchSingleMessage(message);
      });
    } else {
      dispatchSingleMessage(decoded);
    }
    that.flush();
  };

  wsock.onmessage = dispatchMessage;

  var id = 0;
  this.service = function (method, params, complete, callbacks) {
    var rpcId;
    if (closed) {
      throw new Error('Jet Websocket connection is closed');
    }
    // Only make a Request, if callbacks are specified.
    // Make complete call in case of success.
    // If no id is specified in the message, no Response
    // is expected, aka Notification.
    if (callbacks) {
      params.timeout = callbacks.timeout;
      id = id + 1;
      rpcId = id;
      if (complete) {
        if (callbacks.success) {
          var success = callbacks.success;
          callbacks.success = function (result) {
            complete(true);
            success(result);
          };
        } else {
          callbacks.success = function () {
            complete(true);
          };
        }

        if (callbacks.error) {
          var error = callbacks.error;
          callbacks.error = function (result) {
            complete(false);
            error(result);
          };
        } else {
          callbacks.error = function () {
            complete(false);
          };
        }
      }
      responseDispatchers[id] = callbacks;
    } else {
      // There will be no response, so call complete either way
      // and hope everything is ok
      if (complete) {
        complete(true);
      }
    }
    var message = {
      id: rpcId,
      method: method,
      params: params
    };
    if (willFlush) {
      that.queue(message);
    } else {
      wsock.send(encode(message));
    }
  };

  this.batch = function (action) {
    willFlush = true;
    action();
    that.flush();
  };

  this.close = function () {
    closed = true;
    that.flush();
    wsock.close();
  };

  wsock.onclose = function () {
    closed = true;
    if (config.onClose) {
      config.onClose();
    }
  };

  wsock.onerror = function (err) {
    closed = true;
    if (config.onError) {
      config.onError(err);
    }
  };

  that.config = function (params, callbacks) {
    that.service('config', params, null, callbacks);
  };

  wsock.onopen = function () {
    if (isDef(config.name)) {
      that.config({
        name: config.name
      }, {
        success: function () {
          that.flush();
          if (config.onOpen) {
            config.onOpen();
          }
        },
        error: function () {
          that.close();
        }
      });
    } else if (config.onOpen) {
      config.onOpen(that);
    }
    that.flush();
  };
  return this;

};
