function Order(socket, seats) {
  this.socket = socket;
  this.seats = seats;
  this.reservedSeats = [];
  this.date = null;
  this.address = {};
  
  this.registerEvents();
  this.updateSeats();
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
    this.updatedSeats(this.date, [seat]);
    
    console.log("Seat reserved");
  }

  callback({ ok: seat != null, seatId: seatId });
};

Order.prototype.updateSeats = function (dateId, seats) {
  var updatedSeats = {};
  
  if (dateId) {
    updatedSeats[dateId] = {};
    seats.forEach(function (seat) {
      updatedSeats[dateId][seat.id] = seat.forClient(this.reservedSeats);
    });
  
  } else {
    updatedSeats = this.seats.getAll();
  }
  
  this.socket.emit("updateSeats", {
    seats: updatedSeats
  });
};

Order.prototype.updatedSeats = function (dateId, updatedSeats) {
  this.emit("updatedSeats", dateId, updatedSeats);
};

Order.prototype.releaseSeats = function () {
  if (this.reservedSeats.length < 1) return;
  
  var updatedSeats = this.reservedSeats.slice(0);
  this.reservedSeats.forEach(function (seat) {
    seat.release();
  });
  this.reservedSeats.length = 0;
  
  this.updatedSeats(this.date, updatedSeats);
};

module.exports = Order;