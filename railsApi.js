var http = require("http"),
    https = require("https"),
    connect = require("connect"),
    util = require("util"),
    fs = require("fs"),
    EventEmitter = require("events").EventEmitter,
    apn = require("apn");

var sockets = {
  "node": "/tmp/FasT-node-api.sock",
  "rails": "/tmp/unicorn.FasT.production.sock"
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
  
  this.api.use(connect.json());
  this.api.use(function (req, res, next) {
    res.setHeader("Content-Type", "application/json");
    res.response = { ok: true };
    next();
  });

  this.api.use("/push", function (req, res) {
    res.sendJSONResponse();
    
    var params = req.body;
    var clientsPushedTo = 0;
    _this.clients.forEach(function (client) {
      if (params.recipients.indexOf(client.type) != -1 && ((params.recipientIds && params.recipientIds.indexOf(client.id) != -1) || !params.recipientIds)) {
        client.push(params.action, params.info);
        clientsPushedTo++;
      }
    });
    
    console.log("Pushed message with action '" + params.action + "' to " + clientsPushedTo + " clients");
  });
  
  this.api.use("/pushToApp", function (req, res) {
    res.sendJSONResponse();
    
    var params = req.body;
    var conn = _this.apnConnections[params.app];
    if (!conn) return;
    var note = new apn.Notification(params.notification);
    conn.pushNotification(note, params.tokens);
    
    console.log("Pushed app notification for app '" + params.app + "' to " + params.tokens.length + " devices");
  });
  
  this.api.use("/seating", function (req, res) {
    var params = req.body, client;
    
    if (params.clientId) {
      _this.clients.forEach(function (c) {
        if (c.type == "seating" && params.clientId == c.id) {
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
        
      } else if (params.action == "setChosenSeats") {
        
      
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
      
      } else if (params.action == "initSeatingSession") {
        _this.emit("initSeatingSession", params.session, function (seatingId) {
          res.response.seatingId = seatingId;
        });
      
      } else {
        res.response.ok = false;
        res.response.error = "unknown action";
      }
    }
    
    res.sendJSONResponse();
  });
  
  http.createServer(this.api).listenToSocket(sockets.node);
  
  var isProduction = process.env.NODE_ENV == "production";
  var certsPath = "/usr/local/etc/ssl/private/";
  var certs = {
    stats: {
      file: "push.de.theater-kaisersesch.stats.p12",
      productionRequired: false
    },
    passbook: {
      file: "pass.de.theater-kaisersesch.FasT.p12",
      productionRequired: true
    }
  };
  
  this.apnConnections = {};
  for (var app in certs) {
    var options = {
      pfx: certsPath + certs[app].file, production: isProduction || certs[app].productionRequired,
      batchFeedback: true,
      interval: 1800
    };
    
    var conn = new apn.Connection(options);
    conn.on("transmissionError", function (errorCode, notification, device) {
      var token = !!device ? device.token : "(unknown token)";
      errorCode = errorCode || "unknown error";
      console.log("Failed to deliver push notification for device '" + token + "' with error: " + errorCode);
    });
    _this.apnConnections[app] = conn;
    console.log("Created APNS connection for app '" + app + "'");
    
    var feedback = new apn.Feedback(options);
    feedback.on("feedback", function (devices) {
      devices.forEach(function (item) {
        console.log("Device no longer available: " + item.device);
      });
    });
  }
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
  
  var protocol = http;
  if (process.env.NODE_ENV == "production") {
    options['socketPath'] = sockets.rails;
  } else {
    options['hostname'] = "localhost";
    options['port'] = 4000;
  }
  
  var req = protocol.request(options, function (res) {
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