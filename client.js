var util = require("util"),
    EventEmitter = require("events").EventEmitter;

function Client(socket, clientType, clientId) {
  this.socket = socket;
  this.type = clientType || null;
  this.id = clientId || null;
  
  console.log("new client of type '" + clientType + "'");
};

util.inherits(Client, EventEmitter);

Client.prototype.push = function (action, data) {
  this.socket.emit(action, data);
};


module.exports = Client;