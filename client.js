var util = require("util"),
    EventEmitter = require("events").EventEmitter;

function Client(socket, clientType) {
  this.socket = socket;
  this.id = socket.id;
  this.type = clientType || null;

  this.registerEvents();

  console.log(`New client with id ${this.id}.`);
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
  console.log(`Client ${this.id} disconnected.`);
};


module.exports = Client;
