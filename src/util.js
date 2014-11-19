/* global window */

'use-strict';

var jet = window.jet = window.jet || {};
jet.util = {};

//- creates and returns an error table conforming to
// JSON-RPC Invalid params.
window.jet.util.invalidParams = function (data) {
  var err = {
    code: -32602,
    message: 'Invalid params',
    data: data
  };
  return err;
};

window.jet.util.errorObject = function (err) {
  var data;
  var isDef = window.jet.util.isDef ;
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

window.jet.util.isDef = function (x) {
  return typeof (x) !== 'undefined';
};

window.jet.util.isArr = function (x) {
  return x instanceof Array;
};
