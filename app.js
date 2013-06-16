var http = require("http"),
    socketio = require("socket.io"),
    fs = require("fs");

require("./extensions");    
var event = require("./event"),
    PushApi = require("./pushApi"),
    WebClient = require("./webClient"),
    RetailClient = require("./retailClient"),
    RetailCheckoutClient = require("./retailCheckoutClient");

var server = http.Server().listenToSocket("/tmp/FasT-node.sock");
    
var io = socketio.listen(server, {
  "transports": ["websocket", "xhr-polling"],
  "resource": "/node",
  "match origin protocol": true,
  "browser client minification": true
});

var clientClasses = { web: WebClient, retail: RetailClient, "retail-checkout": RetailCheckoutClient };
var clients = [];

function registerNamespace(namespace) {
  io.of("/" + namespace).on("connection", function (socket, data) {
    var client = new clientClasses[namespace](socket, event);
    clients.push(client);
  
    client.on("updatedSeats", function (dateId, updatedSeats) {
      clients.forEach(function (c) {
        if (typeof(c.updateSeats) == 'function') {
          c.updateSeats(dateId, updatedSeats);
        }
      });
    });
  
    client.on("destroyed", function () {
      clients.splice(clients.indexOf(client), 1);
    });
  });
}

for (var namespace in clientClasses) {
  registerNamespace(namespace);
}


var api = new PushApi(clients);