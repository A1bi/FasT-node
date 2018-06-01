var util = require("util"),
    EventEmitter = require("events").EventEmitter;

function Client(socket, clientType, clientId) {
  this.socket = socket;
  this.type = clientType || null;
  this.id = clientId || null;
  
  this.registerEvents();
  
  console.log("New client of type '" + clientType + "'");
};

util.inherits(Client, EventEmitter);

Client.prototype.registerEvents = function () {
  var _this = this;
  this.socket.on("disconnect", function () {
    _this.destroy();
  });
};

Client.prototype.destroy = function () {
  this.emit("destroyed");
  console.log("Client disconnected");
};


module.exports = Client;