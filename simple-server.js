var spawnServer = require('./index');
var express = require('express');

var app = express();

app.use(function(req, res, next){
  res.send("simple server!");
});

app.listen(8015);
