var http = require("http"),
    socketio = require("socket.io"),
    fs = require("fs");

require("./extensions");    
var seats = require("./seats"),
    api = require("./railsApi"),
    SeatingClient = require("./seatingClient");

var server = http.Server().listenToSocket("/tmp/FasT-node.sock");
    
var io = socketio(server, {
  "path": "/node"
});

var clientClasses = { "seating": SeatingClient };
var clients = [];

api.init(clients);
api.on("initSeatingSession", function (session, callback) {
  var client = initSession("seating", null, session);
  callback(client.id);
});

seats.on("updatedSeats", function (updatedSeats) {
  clients.forEach(function (c) {
    if (typeof(c.updateSeats) == 'function') {
      c.updateSeats(updatedSeats);
    }
  });
});

function initSession(type, socket, session) {
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
  if (data.seatingId) {
    var seatingClient;
    clients.forEach(function (client) {
      if (client instanceof SeatingClient && client.id == data.seatingId && !client.socket) {
        seatingClient = client;
        return;
      }
    });
    data.seatingClient = seatingClient;

    if (!seatingClient) {
      error = new Error("invalid seating id");
    }
  }
  next(error);
});
