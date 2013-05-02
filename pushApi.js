var http = require("http"),
    connect = require("connect"),
    util = require("util"),
    fs = require("fs"),
    EventEmitter = require("events").EventEmitter;

function PushApi(clients) {
  this.api = connect();
  this.clients = clients;
  
  this.init();
};

util.inherits(PushApi, EventEmitter);

PushApi.prototype.init = function () {
  var _this = this;
  
  this.api.use(connect.json());
  this.api.use(function (req, res, next) {
    res.setHeader("Content-Type", "application/json");
    next();
  });

  this.api.use("/push", function (req, res) {
    res.end();
    
    var params = req.body;
    _this.clients.forEach(function (client) {
      if (params.recipients.indexOf(client.type) != -1 && ((params.recipientId && params.recipientIds.indexOf(client.id) != -1) || !params.recipientId)) {
        client.push(params.action, params.info);
      }
    });
  });
  
  http.createServer(this.api).listenToSocket("/tmp/FasT-node-api.sock");
};

PushApi.prototype.sendOk = function (res) {
  this.sendJSON(res, {
    ok: true
  });
};

PushApi.prototype.sendJSON = function (res, data) {
  res.end(JSON.stringify(data));
};

module.exports = PushApi;