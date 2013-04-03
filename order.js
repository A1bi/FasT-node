var Validator = require("validator").Validator;

var railsApi = require("./railsApi");

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
  var info = order.info;
  
  switch (order.step) {
    case "date":
    if (this.validateStep("Date", info, response)) {
      if (this.date != info.date) {
        this.releaseSeats();
        this.date = info.date;
      }
      this.numbers = info.numbers;
      this.updateReservedSeats();
    }
    break;
    
    case "seats":
    this.validateStep("Seats", info, response);
    break;
    
    case "address":
    if (this.validateStep("Address", info, response)) {
      this.address = info;
    }
    break;
    
    case "payment":
    break;
    
    case "confirm":
    this.validateStep("Confirm", info, response);
    break;
    
    default:
    response.errors['general'] = "Invalid step";
  }
  
  if (this.returnErrors(response)) {
    if (order.step == "confirm") {
      this.place();
    }
    
  } else {
    response.ok = false;
  }
  
  callback(response);
};

Order.prototype.place = function () {
  var orderInfo = {
    order: {
      date: this.date,
      numbers: this.numbers,
      seats: this.reservedSeats.map(function (seat) {
        return seat.id;
      }),
      address: this.address
    }
  };
  
  railsApi.post("orders", null, orderInfo, function (response) {
    console.log("Order placed");
  });
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

Order.prototype.validateStep = function (step, info, response) {
  this['validate' + step](info, response);
  return this.returnErrors(response);
};

Order.prototype.validateDate = function (info, response) {
  if (!this.seats.dates[info.date]) {
    response.errors['general'] = "Invalid date";
  }
  if (this.getNumberOfTickets(info.numbers) < 1) {
    response.errors['general'] = "Too few tickets";
  }
};

Order.prototype.validateSeats = function (info, response) {
  if (this.reservedSeats.length != this.getNumberOfTickets()) {
    // TODO: i18n
    response.errors['general'] = "Die Anzahl der gewählten Sitzplätze stimmt nicht mit der Anzahl Ihrer Tickets überein.";
  }
};

Order.prototype.validateAddress = function (info, response) {
  var validator = new Validator();
  
  ["first_name", "last_name", "phone"].forEach(function (key) {
    validator.check(info[key], [key, "Bitte füllen Sie dieses Feld aus."]).notEmpty();
  });
  
  validator.check(info.gender, ["gender", "Bitte geben Sie eine korrekte Anrede an."]).isIn(["0", "1"]);
  validator.check(info.plz, ["plz", "Bitte geben Sie eine korrekte Postleitzahl an."]).isInt().len(5, 5);
  validator.check(info.email, ["email", "Bitte geben Sie eine korrekte e-mail-Adresse an."]).isEmail();
  
  var errors = {};
  validator._errors.forEach(function (error) {
    errors[error[0]] = error[1];
  });
  response.errors = errors;
};

Order.prototype.validateConfirm = function (info, response) {
  if (!info.accepted) response.errors.accepted = "Bitte stimmen Sie den AGB zu.";
};

Order.prototype.returnErrors = function (response) {
  if (Object.keys(response.errors).length > 0) return false;
  return true;
};


Validator.prototype.error = function (error) {
  this._errors.push(error);
  return this;
};


module.exports = Order;