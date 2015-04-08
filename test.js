var spawnServer = require('./index');
var express = require('express');

var app = express();

app.use(function(req, res, next){
  req.user = {username: 'sean'};
  next();
});

//require('longjohn');

app.use(spawnServer({alwaysSpawn: true}, function(username, done){
  var target = 'http://localhost:8015';
  done('node', ['./simple-server.js'], target);
}));


app.use(function(req, res){

  res.send('Did not proxy');

});

app.listen(8014);
