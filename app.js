var http = require("http"),
    socketio = require("socket.io");

var server = http.Server().listen(3010),
    io = socketio.listen(server);

io.sockets.on("connection", function (socket) {
  socket.on("reservedSeat", function (data) {
    socket.broadcast.emit("reservedSeat", { seatId: data.seatId });
  });
});