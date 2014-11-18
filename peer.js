/* global define, module, window */
(function (window) {
  'use strict';

  //- creates and returns an error table conforming to
  // JSON-RPC Invalid params.
  var invalidParams = function (data) {
    var err = {
      code: -32602,
      message: 'Invalid params',
      data: data
    };
    return err;
  };

  var methodNotFound = function (data) {
    return {
        message: 'Method not found',
        code: -32601,
        data: data
    };
  };

  var errorObject = function (err) {
    var data;
    if (typeof err === 'object' && isDef(err.code) && isDef(err.message)) {
      return err;
    } else {
      if (typeof err === 'object') {
        data = {};
        data.message = err.message;
        data.lineNumber = err.lineNumber;
        data.fileName = err.fileName;
      }
      return {
        code: -32602,
        message: 'Internal error',
        data: data || err
      };
    }
  };

  var noop = function () {};

  var isDef = function (x) {
    return typeof (x) !== 'undefined';
  };

  var isArr = function (x) {
    return x instanceof Array;
  };

  var create = function (config) {
    config = config || {};
    var log = config.log || noop;
    var url = config.url || 'ws://127.0.0.1:11123';
    var encode = JSON.stringify;
    var decode = JSON.parse;
    var WebSocket = window.WebSocket || window.MozWebSocket;
    var wsock = new WebSocket(url, 'jet');
    var messages = [];
    var closed = false;

    var queue = function (message) {
      messages.push(message);
    };

    var willFlush = true;
    var flush = function () {
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
        } else {
          log('invalid result:', encode(message));
        }
      } else {
        log('invalid result id:', mid, encode(message));
      }
    };

    // handles both method calls and fetchers (notifications)
    var dispatchRequest = function (message) {
      var dispatcher = requestDispatchers[message.method];
      var error;
      if (dispatcher) {
        try {
          dispatcher(message);
        } catch (err) {
          error = errorObject(err);
        }
      } else {
        error = methodNotFound(message.method);
        if (config.onNoDispatcher) {
          try {
            config.onNoDispatcher(message);
          } catch (e) {
            log(e);
          }
        }
      }
      var mid = message.id;
      if (error && isDef(mid)) {
        queue({
          id: mid,
          error: error
        });
      }
    };

    var dispatchSingleMessage = function (message) {
      if (message.method && message.params) {
        dispatchRequest(message);
      } else if (isDef(message.result) || isDef(message.error)) {
        dispatchResponse(message);
      } else {
        log('unhandled message', encode(message));
      }
    };

    var dispatchMessage = function (message) {
      var decoded;
      try {
        decoded = decode(message.data);
        willFlush = true;
        if (isArr(decoded)) {
          decoded.forEach(function (message) {
            dispatchSingleMessage(message);
          });
        } else {
          dispatchSingleMessage(decoded);
        }
      } catch (e) {
        log('decoding message failed', e);
        queue({
          error: {
            code: -32700,
            messsage: 'Parse error'
          }
        });
      }
      if (config.onReceive) {
        config.onReceive(message.data, decoded);
      }
      flush();
    };

    wsock.onmessage = dispatchMessage;

    var that = {};

    that.close = function () {
      closed = true;
      flush();
      wsock.close();
    };

    var id = 0;
    var service = function (method, params, complete, callbacks) {
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
        queue(message);
      } else {
        wsock.send(encode(message));
      }
    };

    that.batch = function (action) {
      willFlush = true;
      action();
      flush();
    };

    that.add = function (desc, dispatch, callbacks) {
      var path = desc.path;
      var assignDispatcher = function (success) {
        if (success) {
          requestDispatchers[path] = dispatch;
        }
      };
      var params = {
        path: path,
        value: desc.value
      };
      service('add', params, assignDispatcher, callbacks);
      var ref = {
        remove: function (callbacks) {
          if (ref.isAdded()) {
            that.remove(path, callbacks);
          } else {
            callbacks.success();
          }
        },
        isAdded: function () {
          return isDef(requestDispatchers[path]);
        },
        add: function (value, callbacks) {
          if (ref.isAdded()) {
            callbacks.success();
          }
          if (isDef(value)) {
            desc.value = value;
          }
          that.add(desc, dispatch, callbacks);
        },
        path: function () {
          return path;
        }
      };
      return ref;
    };

    that.remove = function (path, callbacks) {
      var params = {
        path: path
      };
      var removeDispatcher = function () {
        delete requestDispatchers[path];
      };
      service('remove', params, removeDispatcher, callbacks);
    };

    that.call = function (path, callparams, callbacks) {
      var params = {
        path: path,
        args: callparams || [],
        timeout: callbacks && callbacks.timeout // optional
      };
      service('call', params, null, callbacks);
    };

    that.config = function (params, callbacks) {
      service('config', params, null, callbacks);
    };

    that.set = function (path, value, callbacks) {
      var params = {
        path: path,
        value: value,
        valueAsResult: callbacks && callbacks.valueAsResult, // optional
        timeout: callbacks && callbacks.timeout // optional
      };
      service('set', params, null, callbacks);
    };

    var fetchId = 0;

    that.fetch = function (params, f, callbacks) {
      var id = '__f__' + fetchId;
      var sorting = params.sort;
      fetchId = fetchId + 1;
      var ref;
      var addFetcher = function () {
        requestDispatchers[id] = function (message) {
          var params = message.params;
          if (!isDef(sorting)) {
            f(params.path, params.event, params.value, ref);
          } else {
            f(params.changes, params.n, ref);
          }
        };
      };
      if (typeof (params) === 'string') {
        params = {
          path: {
            contains: params
          }
        };
      }
      params.id = id;
      service('fetch', params, addFetcher, callbacks);
      ref = {
        unfetch: function (callbacks) {
          var removeDispatcher = function () {
            delete requestDispatchers[id];
          };
          service('unfetch', {
            id: id
          }, removeDispatcher, callbacks);
        },
        isFetching: function () {
          return isDef(requestDispatchers[id]);
        },
        fetch: function (callbacks) {
          service('fetch', params, addFetcher, callbacks);
        }
      };
      return ref;
    };

    that.method = function (desc, addCallbacks) {
      var dispatch;
      if (desc.call) {
        dispatch = function (message) {
          var params = message.params;
          var result;
          var err;
          try {
            if (isArr(params) && params.length > 0) {
              result = desc.call.apply(undefined, params);
            } else {
              result = desc.call.call(undefined, params);
            }
          } catch (e) {
            err = e;
          }
          var mid = message.id;
          if (isDef(mid)) {
            if (!isDef(err)) {
              queue({
                id: mid,
                result: result || {}
              });
            } else {
              queue({
                id: mid,
                error: errorObject(err)
              });
            }
          }
        };
      } else if (desc.callAsync) {
        dispatch = function (message) {
          var reply = function (resp, dontFlush) {
            var mid = message.id;
            resp = resp || {};
            if (isDef(mid)) {
              var response = {
                id: mid
              };
              if (isDef(resp.result) && !isDef(resp.error)) {
                response.result = resp.result;
              } else if (isDef(resp.error)) {
                response.error = resp.error;
              } else {
                response.error = 'jet.peer Invalid async method response ' + desc.path;
              }
              queue(response);
              if (!willFlush && !dontFlush) {
                flush();
              }
            }
          };

          var params = message.params;

          try {
            if (isArr(params) && params.length > 0) {
              params.push(reply);
              desc.callAsync.apply(undefined, params);
            } else {
              desc.callAsync.call(undefined, params, reply);
            }
          } catch (err) {
            var mid = message.id;
            if (isDef(mid)) {
              queue({
                id: mid,
                error: errorObject(err)
              });
            }
          }
        };
      } else {
        throw 'invalid method desc' + (desc.path || '?');
      }
      var ref = that.add(desc, dispatch, addCallbacks);
      return ref;
    };

    that.state = function (desc, addCallbacks) {
      var dispatch;
      if (desc.set) {
        dispatch = function (message) {
          var value = message.params.value;
          try {
            var result = desc.set(value) || {};
            desc.value = result.value || value;
            var mid = message.id;
            if (isDef(mid)) {
              queue({
                id: mid,
                result: true
              });
            }
            if (!result.dontNotify) {
              queue({
                method: 'change',
                params: {
                  path: desc.path,
                  value: desc.value
                }
              });
            }
          } catch (err) {
            if (isDef(message.id)) {
              queue({
                id: message.id,
                error: errorObject(err)
              });
            }
          }
        };
      } else if (isDef(desc.setAsync)) {
        dispatch = function (message) {
          var value = message.params.value;
          var reply = function (resp) {
            var mid = message.id;
            resp = resp || {};
            resp.result = isDef(resp.result) || value;
            if (isDef(mid)) {
              var response = {
                id: mid
              };
              if (!isDef(resp.error)) {
                response.result = resp.result;
              } else {
                response.error = errorObject(resp.error);
              }
              queue(response);
            }
            if (isDef(resp.result) && !isDef(resp.dontNotify)) {
              if (isDef(resp.value)) {
                desc.value = resp.value;
              } else {
                desc.value = value;
              }
              queue({
                method: 'change',
                params: {
                  path: desc.path,
                  value: desc.value
                }
              });
            }
            if (!willFlush && !resp.dontFlush) {
              flush();
            }
          };
          try {
            desc.setAsync(value, reply);
          } catch (err) {
            var mid = message.id;
            if (isDef(mid)) {
              queue({
                id: mid,
                error: errorObject(err)
              });

            }
          }
        };
      } else {
        dispatch = function (message) {
          var mid = message.id;
          if (isDef(mid)) {
            queue({
              id: mid,
              error: invalidParams()
            });
          }
        };
      }
      var ref = that.add(desc, dispatch, addCallbacks);
      ref.value = function (value) {
        if (isDef(value)) {
          desc.value = value;
          queue({
            method: 'change',
            params: {
              path: desc.path,
              value: value
            }
          });
          if (!willFlush) {
            flush();
          }
        } else {
          return desc.value;
        }
      };
      return ref;
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

    wsock.onopen = function () {
      if (isDef(config.name)) {
        that.config({
          name: config.name
        }, {
          success: function () {
            flush();
            if (config.onOpen) {
              config.onOpen(that);
            }
          },
          error: function () {
            that.close();
          }
        });
      } else if (config.onOpen) {
        config.onOpen(that);
      }
      flush();
    };

    return that;
  };

  var jet = {
    Peer: create
  };

  /* istanbul ignore next */
  (function () {
    'use strict';
    if (typeof define === 'function' && define.amd) {
      define(jet);
    }
    /* istanbul ignore else if */
    else if (typeof module === 'object' && module.exports) {
      module.exports = jet;
    } else {
      window.jet = jet;
    }
  })();
})(window);
