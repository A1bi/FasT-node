var Validator = require("validator").Validator;

var railsApi = require("./railsApi");

function Order(socket, seats) {
  this.socket = socket;
  this.seats = seats;
  this.reservedSeats = [];
  this.date = null;
  this.tickets = {};
  this.address = {};
  this.placed = false;
  this.validator = new Validator();
  this.expirationTimer = null;
  this.expirationTimes = {
    alertBefore: 60,
    total: 300
  };
  
  this.registerEvents();
  this.updateSeats();
  this.resetExpirationTimer();
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
  this.killExpirationTimer();
  this.emit("destroyed");
  if (!this.placed) this.releaseSeats();
  
  console.log("Order destroyed");
};

Order.prototype.expire = function () {
  console.log("Order expired");
  this.socket.emit("expired").disconnect();
};

Order.prototype.killExpirationTimer = function () {
  clearTimeout(this.expirationTimer);
};

Order.prototype.resetExpirationTimer = function () {
  this.killExpirationTimer();
  this.setExpirationAlertTimer();
};

Order.prototype.setExpirationAlertTimer = function () {
  var _this = this;
  this.expirationTimer = setTimeout(function () {
    _this.setExpirationTimer();
    _this.socket.emit("aboutToExpire", { secondsLeft: _this.expirationTimes.alertBefore });
    console.log("Order expiration alert");
    
  }, (this.expirationTimes.total - this.expirationTimes.alertBefore) * 1000);
};

Order.prototype.setExpirationTimer = function () {
  var _this = this;
  this.expirationTimer = setTimeout(function () {
    _this.expire();
    
  }, this.expirationTimes.alertBefore * 1000);
};

Order.prototype.update = function (order, callback) {
  this.resetExpirationTimer();
  
  var response = {
    ok: true,
    errors: {}
  };
  var info = order.info;
  
  this.validator._errors = [];
  
  switch (order.step) {
    case "date":
    if (this.validateStep("Date", info, response)) {
      if (this.date != info.date) {
        this.releaseSeats();
        this.date = info.date;
      }
      this.tickets = info.tickets;
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
    if (this.validateStep("Payment", info, response)) {
      this.payment = info;
    }
    break;
    
    case "confirm":
    this.validateStep("Confirm", info, response);
    break;
    
    default:
    response.errors['general'] = "Invalid step";
  }
  
  if (this.returnsErrors(response)) {
    if (order.step == "confirm") {
      this.place();
    }
    
  } else {
    this.validator._errors.forEach(function (error) {
      response.errors[error[0]] = error[1];
    });
    response.ok = false;
  }
  
  callback(response);
};

Order.prototype.place = function () {
  var _this = this;
  var orderInfo = {
    order: {
      date: this.date,
      tickets: this.tickets,
      seats: this.reservedSeats.map(function (seat) {
        return seat.id;
      }),
      address: this.address,
      payment: this.payment
    }
  };
  
  railsApi.post("orders", null, orderInfo, function (response) {
    if (response.ok) {
      _this.placed = true;
      console.log("Order placed");
    }
    
    _this.socket.disconnect();
  });
};

Order.prototype.reserveSeat = function (seatId, callback) {
  this.resetExpirationTimer();

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

Order.prototype.getNumberOfTickets = function (tickets) {
  tickets = tickets || this.tickets;
  var number = 0;
  for (var typeId in tickets) {
    number += parseInt(tickets[typeId]);
  }
  return number;
};

Order.prototype.validateStep = function (step, info, response) {
  this['validate' + step](info, response);
  return this.returnsErrors(response);
};

Order.prototype.validateDate = function (info, response) {
  if (!this.seats.dates[info.date]) {
    response.errors['general'] = "Invalid date";
  }
  if (this.getNumberOfTickets(info.tickets) < 1) {
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
  var _this = this;
  ["first_name", "last_name", "phone"].forEach(function (key) {
    _this.validator.check(info[key], [key, "Bitte füllen Sie dieses Feld aus."]).notEmpty();
  });
  
  this.validator.check(info.gender, ["gender", "Bitte geben Sie eine korrekte Anrede an."]).isIn(["0", "1"]);
  this.validator.check(info.plz, ["plz", "Bitte geben Sie eine korrekte Postleitzahl an."]).isInt().len(5, 5);
  this.validator.check(info.email, ["email", "Bitte geben Sie eine korrekte e-mail-Adresse an."]).isEmail();
};

Order.prototype.validatePayment = function (info, response) {
  this.validator.check(info.method, ["general", "Invalid payment method"]).isIn(["charge", "transfer"]);
  if (info.method == "charge") {
    this.validator.check(info.name, ["name", "Bitte geben Sie den Kontoinhaber an."]).notEmpty();
    this.validator.check(info.number, ["number", "Bitte geben Sie eine korrekte Kontonummer an."]).isInt().len(1, 8);
    this.validator.check(info.blz, ["blz", "Bitte geben Sie eine korrekte Bankleitzahl an."]).isInt().len(8, 8);
    this.validator.check(info.bank, ["bank", "Bitte geben Sie den Namen der Bank an."]).notEmpty();
  }
};

Order.prototype.validateConfirm = function (info, response) {
  if (!info.accepted) response.errors.accepted = "Bitte stimmen Sie den AGB zu.";
};

Order.prototype.returnsErrors = function (response) {
  if (Object.keys(response.errors).length + this.validator._errors.length > 0) return false;
  return true;
};


Validator.prototype.error = function (error) {
  this._errors.push(error);
  return this;
};


module.exports = Order;