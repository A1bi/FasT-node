function Order(socket, seats) {
  this.socket = socket;
  this.seats = seats;
  this.reservedSeats = [];
  this.date = null;
  this.numbers = {};
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
  var response = {
    ok: true,
    errors: {}
  };
  
  switch (order.step) {
    case "date":
    if (this.date != order.info.date) {
      if (!this.seats.dates[order.info.date]) {
        response.errors['general'] = "Invalid date";
      } else {
        this.releaseSeats();
        this.date = order.info.date;
      }
    }
    
    if (this.getNumberOfTickets(order.info.numbers) > 0) {
      this.numbers = order.info.numbers;
      this.updateReservedSeats();
    } else {
      response.errors['general'] = "Too few tickets";
    }
    break;
    
    case "seats":
    if (this.reservedSeats.length != this.getNumberOfTickets()) {
      // TODO: i18n
      response.errors['general'] = "Die Anzahl der gewählten Sitzplätze stimmt nicht mit der Anzahl Ihrer Tickets überein.";
    }
    break;
  }
  
  if (Object.keys(response.errors).length > 0) {
    response.ok = false;
  }
  
  callback(response);
};

Order.prototype.reserveSeat = function (seatId, callback) {
  var seat = this.seats.reserve(seatId, this.date);
  if (seat) {
    this.reservedSeats.push(seat);
    this.updateReservedSeats(seat);
    
    console.log("Seat reserved");
  }

  callback({ ok: seat != null, seatId: seatId });
};

Order.prototype.updateSeats = function (dateId, seats) {
  var updatedSeats = {}, _this = this;
  
  if (dateId) {
    updatedSeats[dateId] = {};
    seats.forEach(function (seat) {
      updatedSeats[dateId][seat.id] = seat.forClient(_this.reservedSeats);
    });
  
  } else {
    updatedSeats = this.seats.getAll();
  }
  
  this.socket.emit("updateSeats", {
    seats: updatedSeats
  });
};

Order.prototype.updateReservedSeats = function (addToUpdated) {
  var updatedSeats = this.reservedSeats.splice(0, this.reservedSeats.length - this.getNumberOfTickets());
  updatedSeats.forEach(function (seat) {
    seat.release();
  });
  if (addToUpdated) updatedSeats.push(addToUpdated);
  this.updatedSeats(this.date, updatedSeats);
};

Order.prototype.updatedSeats = function (dateId, updatedSeats) {
  if (updatedSeats.length < 1) return;
  this.emit("updatedSeats", dateId, updatedSeats);
};

Order.prototype.releaseSeats = function () {
  var updatedSeats = this.reservedSeats.slice(0);
  this.reservedSeats.forEach(function (seat) {
    seat.release();
  });
  this.reservedSeats.length = 0;
  
  this.updatedSeats(this.date, updatedSeats);
};

Order.prototype.getNumberOfTickets = function (numbers) {
  numbers = numbers || this.numbers;
  var number = 0;
  for (var typeId in numbers) {
    number += numbers[typeId];
  }
  return number;
};

module.exports = Order;