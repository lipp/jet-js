describe('Jet module', function() {
  it('jet is an Object', function() {
    expect(jet).to.be.an.object;
  });

  it('jet.Peer is a Function', function() {
    expect(jet).to.be.a.function;
  });

  it('a jet peer can connect to the jet daemon', function(done) {
    var peer = new jet.Peer({
      url: 'ws://localhost:11123',
      onOpen: function() {
        done()
      }
    });
  });

  describe('a connected jet peer', function() {
    var peer;

    var randomPath = function() {
      return window.navigator.userAgent + Math.random() + '' + new Date();
    };

    before(function(done) {
      peer = new jet.Peer({
        url: 'ws://localhost:11123',
        name: 'test-peer',
        onOpen: function() {
          done();
        }
      });
    });

    it('can set a state', function(done) {
      peer.set('acceptAll',18372, {
        success: function(result) {
          expect(result).to.be.true;
          done();
        }
      });
    });

    it('can set a state and get the value as result', function(done) {
      peer.set('acceptAll', false, {
        valueAsResult: true,
        success: function(result) {
          expect(result).to.be.false;
          done();
        }
      });
    });

    it('can set a state and errors get propagated', function(done) {
      peer.set('acceptOnlyNumbers', 'hello', {
        error: function(err) {
          expect(err).to.be.an.object;
          expect(err.code).to.be.a.number;
          expect(err.message).to.be.a.string;
          done();
        }
      });
    });

    it('can add, fetch and set a state', function(done) {
      var random = randomPath();
      var state = peer.state({
        path: random,
        value: 123,
        set: function(newval) {
          expect(newval).to.equal(876);
          done();
        }
      });
      peer.fetch(random, function(path, event, value) {
        expect(path).to.equal(random);
        expect(event).to.equal('add');
        expect(value).to.equal(123);
        peer.set(random, 876);
      });
    });

    it('can add a read-only state and setting it fails', function(done) {
      var random = randomPath();
      var state = peer.state({
        path: random,
        value: 123
      });
      peer.set(random, 6237, {
        error: function(err) {
          expect(err).to.be.an.object;
          done();
        }
      });
    });

    it('can add, fetch and set a state with setAsync', function(done) {
      var random = randomPath();
      var state = peer.state({
        path: random,
        value: 123,
        setAsync: function(newval, reply) {
          setTimeout(function() {
            expect(newval).to.equal(876);
            reply();
          },10);
        }
      });
      peer.fetch(random, function(path, event, value) {
        expect(path).to.equal(random);
        expect(event).to.equal('add');
        expect(value).to.equal(123);
        peer.set(random, 876, {
          success: function() {
            done();
          }
        });
      });
    });

    it('can add and set a state with setAsync (setAsync is "safe")', function(done) {
      var random = randomPath();
      var state = peer.state({
        path: random,
        value: 123,
        setAsync: function(newval, reply) {
          throw new Error();
        }
      });
      peer.set(random, 876, {
          error: function(err) {
            expect(err).to.be.an.object;
            done();
          }
      });
    });



    it('can add and remove a state', function(done) {
      var random = randomPath();
      var state = peer.state({
        path: random,
        value: 'asd'
      });
      state.remove({
        success: function() {
          done();
        }
      });
    });

    it('can add and remove and add a state again', function(done) {
      var random = randomPath();
      var state = peer.state({
        path: random,
        value: 'asd'
      });
      state.remove();
      state.add(123, {
        success: function() {
          peer.fetch(random, function(path, event, value) {
            expect(value).to.equal(123);
            done();
          });
        }
      });
    });

    it('can add a state and post a state change', function(done) {
      var random = randomPath();
      var state;
      peer.fetch(random, function(path, event, value) {
        if (event === 'change') {
          expect(value).to.equal('foobar');
          expect(state.value()).to.equal('foobar');
          done();
        }
      });
      state = peer.state({
        path: random,
        value: 675
      });
      setTimeout(function() {
        expect(state.value()).to.equal(675);
        state.value('foobar');
      },10);
    });

    it('can batch', function(done) {
      peer.batch(function() {
        var random = randomPath();
        var state = peer.state({
          path: random,
          value: 'asd'
        });
        state.remove({
          success: function() {
            done();
          }
        });
      });
    });

    it('can add and call a method', function(done) {
      var path = randomPath();
      var m = peer.method({
        path: path,
        call: function(arg1, arg2, arg3) {
          expect(arg1).to.equal(1);
          expect(arg2).to.equal(2);
          expect(arg3).to.be.false;
          return arg1 + arg2;
        }
      });

      peer.call(path,[1,2,false], {
        success: function(result) {
          expect(result).to.equal(3);
          done();
        }
      });
    });

    it('can add and call a method (call impl is "safe")', function(done) {
      var path = randomPath();
      var m = peer.method({
        path: path,
        call: function(arg1, arg2, arg3) {
          throw new Error("argh");
        }
      });

      peer.call(path,[1,2,false], {
        error: function(err) {
          expect(err).to.be.an.object;
          expect(err.data.message).to.equal('argh');
          done();
        }
      });
    });


    it('can add and call a method with callAsync', function(done) {
      var path = randomPath();
      var m = peer.method({
        path: path,
        callAsync: function(arg1, arg2, arg3, reply) {
          expect(arg1).to.equal(1);
          expect(arg2).to.equal(2);
          expect(arg3).to.be.false;
          setTimeout(function() {
            reply({
              result: arg1 + arg2
            });
          },10);
        }
      });

      peer.call(path,[1,2,false], {
        success: function(result) {
          expect(result).to.equal(3);
          done();
        }
      });
    });

    it('callAsync is "safe"', function(done) {
      var path = randomPath();
      var m = peer.method({
        path: path,
        callAsync: function(arg1, arg2, arg3, reply) {
          throw new Error('argh');
        }
      });

      peer.call(path,[1,2,false], {
        error: function(err) {
          expect(err).to.be.an.object;
          done();
        }
      });
    });

    it('cannot add the same state twice', function(done) {
      var path = randomPath();
      peer.state({
        path: path,
        value: 123
      });
      peer.state({
        path: path,
        value: 222
      },{
        error: function(err) {
          expect(err).to.be.an.object;
          expect(err.message).to.equal('Invalid params');
          expect(err.code).to.equal(-32602);
          expect(err.data.pathAlreadyExists).to.equal(path);
          done();
        }
      });
    });

    it('can fetch and unfetch', function(done) {
      var fetcher = peer.fetch('bla', function(){});
      fetcher.unfetch({
        success: function() {
          fetcher.fetch({
            success: function() {
              done();
            }
          });
        }
      });
    });

  })
});
