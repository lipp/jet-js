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

  })
});
