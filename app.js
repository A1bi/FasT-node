var http = require("http"),
    socketio = require("socket.io");

require("./extensions");    
var seats = require("./seats"),
    api = require("./railsApi"),
    SeatingClient = require("./seatingClient");

if (process.env.NODE_ENV == "production") {
  var dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log('error: missing ENV variable SENTRY_DSN');
    process.exit(1);
  }
  var Raven = require('raven');
  Raven.config(dsn).install();
}

var server = http.Server().listenToSocket("/tmp/FasT-node.sock");
    
var io = socketio(server, {
  "path": "/node"
});

var clientClasses = { "seating": SeatingClient };
var clients = [];

api.init(clients);

seats.on("updatedSeats", function (updatedSeats) {
  clients.forEach(function (c) {
    if (typeof(c.updateSeats) == 'function') {
      c.updateSeats(updatedSeats);
    }
  });
});

function initSession(type, socket) {
  var client = new clientClasses[type](socket);
  client.on("destroyed", function () {
    clients.splice(clients.indexOf(client), 1);
  });
  clients.push(client);
  return client;
}

function registerNamespace(namespace) {
  io.of("/" + namespace).on("connection", function (socket, data) {
    if (data && data.seatingClient) {
      data.seatingClient.setSocket(socket);
    } else {
      initSession(namespace, socket);
    }
  });
}

for (var namespace in clientClasses) {
  registerNamespace(namespace);
}

io.of("/seating").use(function (socket, next) {
  var error;
  var data = socket.request;
  if (data.socketId) {
    var seatingClient;
    clients.forEach(function (client) {
      if (client instanceof SeatingClient && client.id == data.socketId && !client.socket) {
        seatingClient = client;
        return;
      }
    });
    data.seatingClient = seatingClient;

    if (!seatingClient) {
      error = new Error("invalid socket id");
    }
  }
  next(error);
});
