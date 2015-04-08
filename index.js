/*
Spawn and proxy a child server process,

This Spawns a new child process for each `req.user.username`
and proxies every request by that user to that process.

Known issues: If the server is restarted, the first request must be a GET request.
a POST request will result in a 500 error.
*/
var path = require('path');
var http = require('http');
var child_process = require('child_process');
var util = require('util');
var url = require('url');

var pwuid = require('pwuid');
var uidNumber = require("uid-number");
var httpProxy = require("http-proxy");

var debug = require('debug')('spawn-server');


function SpawnServer(options, createArgs){

  if (!createArgs){
    createArgs = options;
    options = {};
  }

  var maxDelay = options.maxDelay || 3000;

  if (typeof createArgs != 'function'){
    throw new Error("argument createArgs must be a function");
  }

  var running = {};

  function create_proxy(uid, callback){

    var userInfo = pwuid(uid);

    createArgs(userInfo.name, function(command, args, target){

      var spawn_options = {
        uid: uid,
        gid: userInfo.gid,
        env: {
          HOME: userInfo.dir,
          USER: userInfo.name,
          PATH: process.env.PATH,
          SHELL: userInfo.shell
        }
      };

      debug("launching command: " + command);

      var child = child_process.spawn(command, args, spawn_options);
      child._start_time = new Date();

      child.on('close', function(){
        debug('child closed');
        child._closed = true;
      });

      child.on('error', function(){
        debug('child error');
      });

      var proxy = running[uid] = httpProxy.createProxyServer({target: target});
      proxy._child = child;

      function waitForServer(target, callback){

        debug("waitForServer");
        http.get(target, function(res) {
          debug("waitForServer Got response: " + res.statusCode);
          callback();
        }).on('error', function(err) {
          debug("waitForServer Got error: " + err);
          if (err.code == 'ECONNREFUSED'){
            var currTime = new Date();
            if ((currTime - child._start_time) > maxDelay){
              return callback(err);
            }

            setTimeout(waitForServer, 100, target, callback);
            return;

          } else {
            return callback(err);
          }

        });
      }

      waitForServer(target, function(err){
        callback(err, proxy);
      });


    });

  }


  function su(req, res, next){

    var username = req.user && req.user.username;
    if (!username){
      debug("User not logged in");
      return next();
    }

    uidNumber(username, function(err, uid){

      debug("process-uid=" + process.getuid() + " target-uid=" + uid);

      if (process.getuid() == uid){
        if (!options.alwaysSpawn){
          debug("process uid is the same as the target uid. Not proxying");
          return next();
        } else {
          debug("process uid is the same as the target uid but alwaysSpawn is true. proxying");
        }
      }

      var proxy = running[uid];


      function proxyError(err){

        var currTime = new Date();
        var upTime = currTime - proxy._child._start_time;

        debug("proxy error child-pid:" + proxy._child.pid + " upTime:" + upTime + "ms closed:" + proxy._child._closed);
        err.SPAWN_SERVER_PID = proxy._child.pid;
        // Remove pid from running process map and start it again

        if (proxy._child._closed && (upTime > maxDelay)){
          debug("Child process has exited after " + upTime + "ms. Restarting process")
          delete running[uid];
          return su(req, res, next);
        }

        next(err);

      }

      if (!proxy){

        create_proxy(uid, function(err, proxy){
          if (err) return next(err);
          debug("proxy to web child pid:" + proxy._child.pid + " target:" + JSON.stringify(proxy.options.target));
          proxy.web(req, res, null, proxyError);

        });

        return;
      }

      debug("proxy to web child pid:" + proxy._child.pid + " target:" + JSON.stringify(proxy.options.target));
      proxy.web(req, res, null, proxyError);

    });

  }

  su.upgrade = function(req, socket, head){

    var proxy = running[uid];
    if (proxy){
      proxy.ws(req, socket, head);
    }
  };

  return su;

}


module.exports = SpawnServer;
