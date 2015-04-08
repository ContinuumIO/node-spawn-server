var expect = require('chai').expect;
var spawnServer = require('./index');
var http = require('http');

describe('Spawn Server', function(){

  describe('#proxyError', function(){

  });

  describe('#WaitForServer', function(){
    it('should wait for a server to start', function(done){

      console.log(spawnServer.waitForServer);

      var server = http.createServer(function(req, res){res.end('ok');});
      server.listen(90909);

      server.on('listening', function(){
        spawnServer.waitForServer(new Date(), 50, 'http://127.0.0.1:90909', function(err){
          server.close();
          expect(!err).to.equal(true);
          done();
        });

      });

    });


    it('Should error if the server is not running after maxDelay ms', function(done){

      console.log(spawnServer.waitForServer);

      spawnServer.waitForServer(new Date(), 50, 'http://127.0.0.1:1', function(err){
        expect(!!err).to.equal(true);
        done();
      });


    });
  });



});