var http = require("http"),
    socketio = require("socket.io"),
    fs = require("fs");
    
var event = require("./event"),
    Order = require("./order"),
    Purchase = require("./purchase");

var sockPath = "/tmp/FasT-node.sock";
if (fs.existsSync(sockPath)) fs.unlinkSync(sockPath);

var server = http.Server().listen(sockPath);
fs.chmod(sockPath, "0777");
    
var io = socketio.listen(server, {
  "close timeout": 30,
  "heartbeat timeout": 30,
  "heartbeat interval": 15
});

var clients = [];

function registerNamespace(namespace) {
  io.of("/" + namespace).on("connection", function (socket) {
    var clientClass;
    switch (namespace) {
      case "order":
      clientClass = Order;
      break;
    
      case "purchase":
      clientClass = Purchase;
      break;
    
      default:
      console.log("invalid namespace");
      socket.disconnect();
      return;
    }
  
    var client = new clientClass(socket, event);
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

["order", "purchase"].forEach(function (namespace) {
  registerNamespace(namespace);
});