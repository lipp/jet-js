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
});
