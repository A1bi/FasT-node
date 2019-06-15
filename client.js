var util = require("util"),
    EventEmitter = require("events").EventEmitter;

Client.connectionTimeout = 30000;

function Client(socket, clientType) {
  this.id;
  this.type = clientType || null;
  this.socket;
  this.connectionTimeoutTimer;

  this.setSocket(socket);

  console.log(`New client with id ${this.id}.`);
};

util.inherits(Client, EventEmitter);

Client.prototype.registerSocketEvents = function () {
  this.socket.on("disconnect", function () {
    this.connectionTimeoutTimer = setTimeout(this.destroy.bind(this), Client.connectionTimeout);
    console.log(`Client ${this.id} disconnected.`);
  }.bind(this));
};

Client.prototype.detachSocket = function () {
  this.socket.removeAllListeners();
  this.socket.disconnect();
};

Client.prototype.disconnect = function () {
  this.detachSocket();
  this.destroy();
};

Client.prototype.destroy = function () {
  this.emit("destroyed");
  console.log(`Client ${this.id} destroyed.`);
};

Client.prototype.setSocket = function (socket) {
  if (this.socket) {
    clearTimeout(this.connectionTimeoutTimer);

    this.detachSocket();

    console.log(`Client ${this.id} reconnected.`);

  } else {
    this.id = socket.id;
  }

  this.socket = socket;
  this.registerSocketEvents();
};


module.exports = Client;
