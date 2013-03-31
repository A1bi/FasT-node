var http = require("http"),
    socketio = require("socket.io"),
    fs = require("fs");
    
var seats = require("./seats");

var sockPath = "/tmp/FasT-node.sock";
if (fs.existsSync(sockPath)) fs.unlinkSync(sockPath);

var server = http.Server().listen(sockPath),
    io = socketio.listen(server);
fs.chmod(sockPath, "0777");
    
var date = 1;

io.sockets.on("connection", function (socket) {
  socket.on("reserveSeat", function (data) {
    var seat = seats.dates[date][data.seatId];
    var ok = false;
    if (seat) {
      ok = seat.reserve();
    }
  
    console.log("Seat reserved...");
    socket.emit("reservedSeat", { ok: ok, seatId: data.seatId });
  });

  socket.emit("updateSeats", {
    dateId: date,
    seats: seats.getAllOnDate(date)
  });
});