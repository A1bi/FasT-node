function Order(socket, seats) {
  this.socket = socket;
  this.seats = seats;
  this.reservedSeats = [];
  this.date = null;
  this.address = {};
  
  this.registerEvents();
};

Order.prototype.__proto__ = process.EventEmitter.prototype;

Order.prototype.registerEvents = function () {
  var _this = this;
  
  this.socket.on("disconnect", function () {
    _this.destroy();
  });
  
  this.socket.on("reserveSeat", function (data, callback) {
    _this.reserveSeat(data.seatId, callback);
  });
  
  this.socket.on("updateOrder", function (data, callback) {
    _this.update(data.order, callback);
  });
};

Order.prototype.destroy = function () {
  this.releaseSeats();
  this.emit("destroyed");
  
  console.log("Order destroyed");
};

Order.prototype.update = function (order, callback) {
  switch (order.step) {
    case "date":
    if (this.date != order.info.date) {
      this.releaseSeats();
      this.date = order.info.date;
      this.updateSeats();
    }
    break;
  }
  
  var response = {
    ok: true,
    errors: {}
  };
  
  callback(response);
};

Order.prototype.reserveSeat = function (seatId, callback) {
  var seat = this.seats.reserve(seatId, this.date);
  if (seat) {
    this.reservedSeats.push(seat);
    this.updatedSeats();
    
    console.log("Seat reserved");
  }

  callback({ ok: seat != null, seatId: seatId });
};

Order.prototype.updateSeats = function (date) {
  if (!this.date || (date != null && date != this.date)) return;
  
  this.socket.emit("updateSeats", {
    seats: this.seats.getAllOnDate(this.date, this.reservedSeats)
  });
};

Order.prototype.updatedSeats = function () {
  this.emit("updatedSeats");
};

Order.prototype.releaseSeats = function () {
  this.reservedSeats.forEach(function (seat) {
    seat.release();
  });
  this.reservedSeats.length = 0;
  
  this.updatedSeats();
};

module.exports = Order;