var http = require("http"),
    connect = require("connect"),
    bodyParser = require("body-parser"),
    util = require("util"),
    EventEmitter = require("events").EventEmitter;

var sockets = {
  "node": "/tmp/FasT-node.sock",
  "rails": "/tmp/unicorn.FasT.sock"
};


http.ServerResponse.prototype.sendJSONResponse = function () {
  this.end(JSON.stringify(this.response));
};


var instance = null;

function RailsApi() {
  this.api = connect();
};

util.inherits(RailsApi, EventEmitter);

RailsApi.prototype.init = function (clients) {
  var _this = this;
  this.clients = clients;

  this.api.use(bodyParser.json());
  this.api.use(function (req, res, next) {
    res.setHeader("Content-Type", "application/json");
    res.response = { ok: true };
    next();
  });

  this.api.use("/seating", function (req, res) {
    var params = req.body, client;

    if (params.socketId) {
      _this.clients.forEach(function (c) {
        if (c.type == "seating" && params.socketId == c.id) {
          client = c;
          return;
        }
      });
      
      if (!client) {
        res.response.ok = false;
        res.response.error = "unknown client";
      }
    }
    
    if (res.response.ok) {
      if (params.action == "getChosenSeats") {
        res.response.seats = client.getChosenSeats();

      } else if (params.action == "addExclusiveSeats") {
        client.addExclusiveSeats(params.seats);
        
      } else if (params.action == "removeExclusiveSeats") {
        client.removeExclusiveSeats(params.seats);
        
      } else if (params.action == "setExclusiveSeats") {
        client.setExclusiveSeats(params.seats);
        
      } else if (params.action == "setOriginalSeats") {
        client.setOriginalSeats(params.seats);
      
      } else if (params.action == "updateSeats") {
        console.log("Received seat update from Rails.");
        _this.emit("updateSeats", params.seats);

      } else {
        res.response.ok = false;
        res.response.error = "unknown action";
      }
    }
    
    res.sendJSONResponse();
  });

  this.server = http.createServer(this.api).listenToSocket(sockets.node);
};

RailsApi.prototype.get = function (resource, action, callback) {
  this.requestOnResource(resource, action, "GET", null, callback);
};

RailsApi.prototype.post = function (resource, action, data, callback) {
  this.requestOnResource(resource, action, "POST", data, callback);
};

RailsApi.prototype.requestOnResource = function (resource, action, method, data, callback) {
  this.request(resource + ((action) ? "/" + action : ""), method, data, function (data) {
    callback(data);
  });
};

RailsApi.prototype.request = function (path, method, data, callback) {
  var body = JSON.stringify(data || {});
  
  var options = {
    method: method,
    path: "/api/" + path,
    rejectUnauthorized: false,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body)
    } 
  };

  if (process.env.NODE_ENV == "production") {
    options['socketPath'] = sockets.rails;
  } else {
    options['hostname'] = "localhost";
    options['port'] = 4000;
  }

  var req = http.request(options, function (res) {
    var data = "";
    
    res.on("data", function (d) {
      data += d;
    });
    
    res.on("end", function () {
      try {
        callback(JSON.parse(data));
      } catch (error) {
        console.log(error);
        callback({});
      }
    });
  
  }).on("error", function (error) {
    console.log(error);      
  });
  
  req.write(body);
  
  req.end();
};

module.exports = function () {
  if (!instance) instance = new RailsApi();
  return instance;
}();