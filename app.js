var http = require("http"),
    socketio = require("socket.io"),
    fs = require("fs");
    
var seats = require("./seats"),
    Order = require("./order");

var sockPath = "/tmp/FasT-node.sock";
if (fs.existsSync(sockPath)) fs.unlinkSync(sockPath);

var server = http.Server().listen(sockPath);
fs.chmod(sockPath, "0777");
    
var io = socketio.listen(server, {
  "close timeout": 30,
  "heartbeat timeout": 30,
  "heartbeat interval": 15
});

var orders = [];

io.sockets.on("connection", function (socket) {
  var order = new Order(socket, seats);
  orders.push(order);
  
  order.on("updatedSeats", function () {
    orders.forEach(function (o) {
      if (o == order) return;
      o.updateSeats(order.date);
    });
  });
  
  order.on("destroyed", function () {
    orders.splice(orders.indexOf(order), 1);
  });
});