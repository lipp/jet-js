  function() {

      //- creates and returns an error table conforming to
      // JSON-RPC Invalid params.
      var invalidParams = function(data) {
              var err = {
                  code: -32602,
                  message: 'Invalid params',
                  data: data
              };
              return err;
          };

      // creates and returns an error table conforming to
      // JSON-RPC Response Timeout.
      var responseTimeout = function(data) {
              var err = {
                  code: -32001,
                  message: 'Response Timeout',
                  data: data
              };
              return err;
          };

      //- creates and returns an error table conforming to
      // JSON-RPC Internal Error.
      var internalError = function(data) {
              var err = {
                  code: -32603,
                  message: 'Internal error',
                  data: data,
              };
              return err;
          };

      //- creates and returns an error table conforming to
      // JSON-RPC Parse Error.
      var parseError = function(data) {
              var err = {
                  code: -32700,
                  message: 'Parse error',
                  data: data
              };
              return err;
          };

      //- creates and returns an error table conforming to
      // JSON-RPC Method not Found.
      var methodNotFound = function(method) {
              var err = {
                  code: -32601,
                  message: 'Method not found',
                  data: method
              };
              return err;
          };

      //- creates and returns an error table conforming to
      // JSON-RPC Invalid request.
      var invalidRequest = function(data) {
              var err = {
                  code: -32600,
                  message: 'Invalid Request',
                  data: data
              };
              return err;
          };

      var errorObject = function(err) {
              var error;
              if(typeof(err) == 'object' && err.code && err.message) {
                  error = err;
              } else {
                  error = internal_error(err);
              }
              return error;
          };

      var noop = function() {};

      var isDef = function(x) {
              return typeof(x) !== 'undefined';
          };

      var isArr = function(x) {
              return x instanceof Array;
          };

      var create = function(config) {
              config = config || {};
              var log = config.log || noop;
              var url = config.url || 'ws://127.0.0.1:11123';
              var encode = JSON.stringify;
              var decode = JSON.parse;
              var Websocket = Websocket || MozWebSocket;
              var wsock = new Websocket(url, 'jet');
              var messages = [];

              var queue = function(message) {
                      messages.push(message);
                  };

              var willFlush = true;
              var flush = function(reason) {
                      if(messages.length === 1) {
                          wsock.send(encode(messages[1]));
                      } else if(message.length > 1) {
                          wsock.send(encode(messages));
                      }
                      messages.length = 0;
                      willFlush = false;
                  };

              var requestDispatchers = {};
              var responseDispatchers = {};

              var dispatchResponse = function(message) {
                      var mid = message.id;
                      var callbacks = responseDispatchers[mid];
                      delete responseDispatchers[mid];
                      if(callbacks) {
                          if(isDef(message.result)) {
                              if(callbacks.success) {
                                  callbacks.success(message.result);
                              }
                          } else if(isDef(message.error)) {
                              if(callbacks.error) {
                                  callbacks.error(message.error);
                              }
                          } else {
                              log('invalid result:', cjson.encode(message));
                          }
                      } else {
                          log('invalid result id:', mid, cjson.encode(message));
                      }
                  };

              var onNoDispatcher;
              // handles both method calls and fetchers (notifications)
              var dispatchRequest = function(message) {
                      var dispatcher = requestDispatchers[message.method];
                      var error;
                      if(dispatcher) {
                          try {
                              dispatcher(message);
                          } catch(e) {
                              error = errorObject(err);
                          }
                      } else {
                          error = methodNotFound(message.method);
                          if(onNoDispatcher) {
                              try {
                                  onNoDispatcher(message);
                              } catch(e) {
                                  log(e);
                              }
                          }
                      }
                      var mid = message.id;
                      if(error && isDef(mid)) {
                          queue({
                              id: mid,
                              error: error
                          });
                      }
                  };

              var dispatchSingleMessage = function(message) {
                      if(message.method && message.params) {
                          dispatchRequest(message);
                      } else if(isDef(message.result) || isDef(message.error)) {
                          dispatchResponse(self, message);
                      } else {
                          log('unhandled message', encode(message));
                      }
                  };

              var dispatchMessage = function(message) {
                      try {
                          message = decode(message);
                          willFlush = true;
                          if(typeof(message) === 'object' && message.length > 0) {
                              message.forEach(function(message) {
                                  dispatchSingleMessage(message);
                              });
                          } else {
                              dispatchSingleMessage(message);
                          }
                      } catch(e) {
                          log('decoding message failed', e);
                          queue({
                              error: {
                                  code: -32700,
                                  messsage: 'Parse error'
                              }
                          });
                      }
                      flush('dispatchMessage');
                  };

              wsock.onmessage = dispatchMessage;
              wsock.onerror = log;
              wsock.onclose = config.onclose;

              var j = {};

              j.onnodispatcher = function(f) {
                  onNoDispatcher = f;
              };

              j.close = function() {
                  flush('close');
                  wsock.close();
              };

              var id = 0;
              var service = function(method, params, complete, callbacks) {
                      var rpcId;
                      // Only make a Request, if callbacks are specified.
                      // Make complete call in case of success.
                      // If no id is specified in the message, no Response
                      // is expected, aka Notification.
                      if(callbacks) {
                          params.timeout = callbacks.timeout;
                          id = id + 1;
                          rpcId = id;
                          if(complete) {
                              if(callbacks.success) {
                                  var success = callbacks.success;
                                  callbacks.success = function(result) {
                                      complete(true);
                                      success();
                                  };
                              } else {
                                  callbacks.success = function() {
                                      complete(true);
                                  };
                              }

                              if(callbacks.error) {
                                  var error = callbacks.error;
                                  callbacks.error = function(result) {
                                      complete(false);
                                      error();
                                  };
                              } else {
                                  callbacks.error = function() {
                                      complete(false);
                                  };
                              }
                          }
                          responseDispatchers[id] = callbacks;
                      } else {
                          // There will be no response, so call complete either way
                          // and hope everything is ok
                          if(complete) {
                              complete(true);
                          }
                      }
                      var message = {
                          id: rpcId,
                          method: method,
                          params: params
                      };
                      if(willFlush) {
                          queue(message);
                      } else {
                          wsock.send(encode(message));
                      }
                  };

              j.batch = function(action) {
                  willFlush = true;
                  action();
                  flush('batch');
              };

              j.add = function(desc, dispatch, callbacks) {
                  var path = desc.path;
                  var assignDispatcher = function(success) {
                          if(success) {
                              requestDispatchers[path] = dispatch;
                          }
                      };
                  var params = {
                      path: path,
                      value: desc.value
                  };
                  service('add', params, assignDispatcher, callbacks);
                  var ref = {
                      remove: function(callbacks) {
                          if(ref.isAdded()) {
                              j.remove(path, callbacks);
                          } else {
                              callbacks.success();
                          }
                      },
                      isAdded: function() {
                          return isDef(requestDispatchers[path]);
                      },
                      add: function(value, callbacks) {
                          if(ref.isAdded()) {
                              callbacks.success();
                          }
                          if(isDef(value)) {
                              desc.value = value;
                          }
                          j.add(desc, dispatch, callbacks);
                      },
                      path: function() {
                          return path;
                      }
                  };
                  return ref;
              };

              j.remove = function(path, callbacks) {
                  var params = {
                      path: path
                  };
                  var removeDispatcher = function(success) {
                          delete request_dispatchers[path];
                      };
                  service('remove', params, remove_dispatcher, callbacks);
              };

              j.call = function(path, callparams, callbacks) {
                  var params = {
                      path: path,
                      args: callparams || []
                  };
                  service('call', params, null, callbacks);
              };

              j.config = function(params, callbacks) {
                  service('config', params, null, callbacks);
              };

              j.set = function(path, value, callbacks) {
                  var params = {
                      path: path,
                      value: value
                  };
                  service('set', params, null, callbacks);
              };

              var fetchId = 0;

              j.fetch = function(params, f, callbacks) {
                  var id = '__f__' + fetchId;
                  var sorting = params.sort;
                  fetchId = fetchId + 1;
                  var ref;
                  var addFetcher = function() {
                          requestDispatchers[id] = function(message) {
                              var params = message.params;
                              if(!isDef(sorting)) {
                                  f(params.path, params.event, params.value, ref);
                              } else {
                                  f(params.changes, params.n, ref);
                              }
                          };
                      };
                  if(typeof(params) === 'string') {
                      params = {
                          path: {
                              contains: params
                          }
                      };
                  }
                  params.id = id;
                  service('fetch', params, add_fetcher, callbacks);
                  ref = {
                      unfetch: function(callbacks) {
                          var removeDispatcher = function() {
                                  delete requestDispatchers[id];
                              };
                          service('unfetch', {
                              id: id
                          }, removeDispatcher, callbacks);
                      },
                      isFetching: function() {
                          return isDef(requestDispatchers[id]);
                      },
                      fetch: function(callbacks) {
                          service('fetch', params, add_fetcher, callbacks);
                      }
                  };
                  return ref;
              };

              j.method = function(desc, addCallbacks) {
                  var dispatch;
                  if(desc.call) {
                      dispatch = function(message) {
                          var params = message.params;
                          var result;
                          var err;
                          try {
                              if(isArr(params) && params.length > 0) {
                                  result = desc.call.apply(undefined, params);
                              } else {
                                  result = desc.call.call(undefined, params);
                              }
                          } catch(e) {
                              err = e;
                          }
                          var mid = message.id;
                          if(isDef(mid)) {
                              if(ok) {
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
                  } else if(desc.callAsync) {
                      dispatch = function(message) {
                          var reply = function(resp, dontFlush) {
                                  var mid = message.id;
                                  if(isDef(mid)) {
                                      var response = {
                                          id: mid
                                      };
                                      if(isDef(resp.result) && !isDef(resp.error)) {
                                          response.result = resp.result;
                                      } else if(isDef(resp.error)) {
                                          response.error = resp.error;
                                      } else {
                                          response.error = 'jet.peer Invalid async method response ' + desc.path;
                                      }
                                      queue(response);
                                      if(!willFlush && !dontFlush) {
                                          flush('call_async');
                                      }
                                  }
                              };

                          var params = message.params;
                          var err;

                          try {
                              if(isArr(params) && params.length > 0) {
                                  desc.callAsync.apply(undefined, reply, params);
                              } else {
                                  desc.callAsync.call(undefined, reply, params);
                              }
                          } catch(e) {
                              var mid = message.id;
                              if(isDef(mid)) {
                                  queue({
                                      id: mid,
                                      error: errorObject(result)
                                  });
                              }
                          }
                      };
                  } else {
                      throw 'invalid method desc' + (desc.path || '?');
                  }
                  var ref = self.add(desc, dispatch, add_callbacks);
                  return ref;
              };


              j.state = function(desc, add_callbacks) {
                  var dispatch;
                  if(desc.set) {
                      dispatch = function(message) {
                          var value = message.params.value;
                          try {
                              var result = desc.set(value) || {};
                              desc.value = result.value || value;
                              var mid = message.id;
                              if(isDef(mid)) {
                                  queue({
                                      id: mid,
                                      result: true
                                  });
                              }
                              if(!result.dontNotify) {
                                  queue({
                                      method: 'change',
                                      params: {
                                          path: desc.path,
                                          value: desc.value
                                      }
                                  });
                              }
                          } catch(err) {
                              if(isDef(message.id)) {
                                  queue({
                                      id: message.id,
                                      error: errorObject(err)
                                  });
                              }
                          }
                      };
                  } else if(isDef(desc.setAsync)) {
                      dispatch = function(message) {
                          var value = message.params.value;
                          var reply = function(resp) {
                                  var mid = message.id;
                                  if(isDef(mid)) {
                                      var response = {
                                          id: mid
                                      };
                                      if(isDef(resp.result) && !isDef(resp.error)) {
                                          response.result = resp.result;
                                      } else if(isDef(resp.error)) {
                                          response.error = errorObject(resp.error);
                                      } else {
                                          response.error = 'jet.peer Invalid async state response ' + desc.path;
                                      }
                                      queue(response);
                                  }
                                  if(isDef(resp.result) && !isDef(resp.dontNotify)) {
                                      if(isDef(resp.value)) {
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
                                  if(!willFlush && !resp.dontFlush) {
                                      flush('set_aync');
                                  }
                              };
                          try {
                              desc.setAsync(reply, value);
                          } catch(err) {
                              var mid = message.id;
                              if(isDef(mid)) {
                                  queue({
                                      id: mid,
                                      error: errorObject(result)
                                  });

                              }
                          }
                      };
                  } else {
                      dispatch = function(message) {
                          var mid = message.id;
                          if(isDef(mid)) {
                              queue({
                                  id: mid,
                                  error: invalidParams()
                              });
                          }
                      };
                  }
                  var ref = j.add(desc, dispatch, addCallbacks);
                  ref.value = function(value) {
                      if(isDef(value)) {
                          desc.value = value;
                          queue({
                              method: 'change',
                              params: {
                                  path: desc.path,
                                  value: value
                              }
                          });
                          if(!willFlush) {
                              flush();
                          }
                      } else {
                          return desc.value;
                      }
                  };
                  return ref;
              };

              wsock.onconnect = function() {
                  if(isDef(config.name)) {
                      j.config({
                          name: config.name
                      }, {
                          success: function() {
                              flush('config');
                              if(config.onconnect) {
                                  config.onconnect(j);
                              }
                          },
                          error: function(err) {
                              j.close();
                          }
                      });
                  } else if(config.onconnect) {
                      config.onconnect(j);
                  }
                  flush('on_connect');
              };

              return j;
          };

      var jet = {
          Peer: create
      };

      if(typeof define === 'function' && define.amd) {
          define(jet);
      } else if(typeof module === 'object' && module.exports) {
          module.exports = jet;
      } else {
          this.jet = jet;
      }
  }();