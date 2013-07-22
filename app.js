var http = require("http"),
    socketio = require("socket.io"),
    fs = require("fs");

require("./extensions");    
var seats = require("./seats"),
    api = require("./railsApi"),
    SeatingClient = require("./seatingClient"),
    RetailCheckoutClient = require("./retailCheckoutClient");

var server = http.Server().listenToSocket("/tmp/FasT-node.sock");
    
var io = socketio.listen(server, {
  "transports": ["websocket", "xhr-polling"],
  "resource": "/node",
  "match origin protocol": true,
  "browser client minification": true
});

var clientClasses = { "seating": SeatingClient, "retail-checkout": RetailCheckoutClient };
var clients = [];

api.init(clients);

seats.on("updatedSeats", function (updatedSeats) {
  clients.forEach(function (c) {
    if (typeof(c.updateSeats) == 'function') {
      c.updateSeats(updatedSeats);
    }
  });
});

function registerNamespace(namespace) {
  io.of("/" + namespace).on("connection", function (socket, data) {
    var client = new clientClasses[namespace](socket);
    clients.push(client);
  
    client.on("destroyed", function () {
      clients.splice(clients.indexOf(client), 1);
    });
  });
}

for (var namespace in clientClasses) {
  registerNamespace(namespace);
}