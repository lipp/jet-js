! function () {
    var create = function (wsURL, callbacks) {
        callbacks = callbacks || {};
        wsURL = wsURL || ('ws://' + (window.document.domain || 'localhost') + ':11123');
        var newWebsocket = function (url, protocol) {
            if (navigator.userAgent.search("Firefox") != -1) {
                try {
                    return new WebSocket(url, protocol);
                } catch (e) {
                    return new MozWebSocket(url, protocol);
                }
            } else {
                return new WebSocket(url, protocol);
            }
        };
        var ws = newWebsocket(wsURL, 'jet');
        var encode = JSON.stringify;
        var decode = JSON.parse;
        var preConnectQueue = [];

        callbacks.onopen = callbacks.onopen || function () {
            console.log('jet open', wsURL);
        };
        callbacks.onerror = callbacks.onerror || function (e) {
            console.log('jet error', e);
        };
        callbacks.onclose = callbacks.onclose || function (code, reason) {
            console.log('jet close', code, reason);
        };
        ws.onopen = function () {
            preConnectQueue.forEach(function (message) {
                ws.send(encode(message));
            });
            callbacks.onopen();
        };
        ws.onclose = callbacks.onclose;
        ws.onerror = callbacks.onerror;

        var dispatchers = {};
        var id = 0;
        var isDefined = function (x) {
            return typeof x !== 'undefined' && x !== null;
        };
        var dispatchSingleMessage = function (message) {
            var dispatch;
            try {
                if (isDefined(message.id)) {
                    dispatch = dispatchers[message.id];
                    dispatch(message.error, message.result);
                    delete dispatchers[message.id];
                } else {
                    dispatch = dispatchers[message.method];
                    dispatch(message.params);
                }
            } catch (e) {
                callbacks.onerror('Dispatching message failed', message, e);
            }
        };
        ws.onmessage = function (wsMessage) {
            var i;
            var messageObject;
            try {
                messageObject = decode(wsMessage.data);
            } catch (e) {
                console.log('Message is no valid JSON', wsMessage.data, e);
                return;
            }
            if ($.isArray(messageObject)) {
                for (i = 0; i < messageObject.length; ++i) {
                    dispatchSingleMessage(messageObject[i]);
                }
            } else {
                dispatchSingleMessage(messageObject);
            }
        };

        var queue = [];

        var request = function (method, params, callback) {
            var request = {
                method: method,
                params: params
            };
            if (callback) {
                id += 1;
                request.id = id;
                dispatchers[id] = callback;
            }
            if (ws.readyState === ws.OPEN) {
                ws.send(encode(request));
            } else {
                preConnectQueue.push(request);
            }
        };

        var fetchId = 0;

        var instance = {
            set: function (path, val, callback) {
                request('set', {
                    path: path,
                    value: val
                }, callback);
            },
            call: function (path, args, callback) {
                request('call', {
                    path: path,
                    args: args
                }, callback);
            },
            setEncoding: function (enc, callback) {
                if (enc !== 'msgpack' || !isDefined(window.msgpack)) {
                    throw 'encoding unsupported';
                }
                request('config', {
                    encoding: 'msgpack'
                }, function (err, result) {
                    if (!isDefined(err)) {
                        encode = msgpack.encode;
                        decode = msgpack.decode;
                        ws.binaryType = 'arraybuffer';
                    }
                    if (isDefined(callback)) {
                        callback(err, result);
                    }
                });
            },
            fetch: function (expression, fetchcb, callback) {
                var unfetch;
                var id = 'f' + fetchId++;
                // poor man's deep copy.
                // not expected to be called often
                var params = JSON.parse(JSON.stringify(expression));
                params.id = id;
                dispatchers[id] = fetchcb;
                request('fetch', params, callback);
                unfetch = function (callback) {
                    request('unfetch', {
                        id: id
                    }, function (err, res) {
                        delete dispatchers[id];
                        if (callback) {
                            callback(err, res);
                        }
                    });
                };
                return unfetch;
            },
            close: function () {
                ws.onclose = null;
                ws.close();
                callbacks.onclose();
            }
        };

        return instance;
    };

    var jet = {
        Peer: create
    };
    if (typeof define === "function" && define.amd) {
        define(jet);
    } else if (typeof module === "object" && module.exports) {
        module.exports = jet;
    } else {
        this.jet = jet;
    }
}();
