var http = require("http"),
    socketio = require("socket.io"),
    fs = require("fs");
    
var event = require("./event"),
    WebClient = require("./webClient"),
    RetailClient = require("./retailClient");

var sockPath = "/tmp/FasT-node.sock";
if (fs.existsSync(sockPath)) fs.unlinkSync(sockPath);

var server = http.Server().listen(sockPath);
fs.chmod(sockPath, "0777");
    
var io = socketio.listen(server, {
  "close timeout": 30,
  "heartbeat timeout": 30,
  "heartbeat interval": 15
});

var clientClasses = { web: WebClient, retail: RetailClient };
var clients = [];

function registerNamespace(namespace) {
  io.of("/" + namespace).on("connection", function (socket) {
    var client = new clientClasses[namespace](socket, event);
    clients.push(client);
  
    client.on("updatedSeats", function (dateId, updatedSeats) {
      clients.forEach(function (c) {
        c.updateSeats(dateId, updatedSeats);
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
