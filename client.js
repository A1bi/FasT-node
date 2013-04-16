var util = require("util");
var Validator = require("validator").Validator;
var EventEmitter = require("events").EventEmitter;

var railsApi = require("./railsApi");

function Client(socket, seats) {
  this.socket = socket;
  this.seats = seats;
  this.reservedSeats = [];
  this.date = null;
  this.tickets = {};
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

util.inherits(Client, EventEmitter);

Client.prototype.registerEvents = function () {
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

Client.prototype.destroy = function () {
  this.killExpirationTimer();
  this.emit("destroyed");
  if (!this.placed) this.releaseSeats();
  
  console.log("Order destroyed");
};

Client.prototype.expire = function () {
  console.log("Order expired");
  this.socket.emit("expired").disconnect();
};

Client.prototype.killExpirationTimer = function () {
  clearTimeout(this.expirationTimer);
};

Client.prototype.resetExpirationTimer = function () {
  this.killExpirationTimer();
  this.setExpirationAlertTimer();
};

Client.prototype.setExpirationAlertTimer = function () {
  var _this = this;
  this.expirationTimer = setTimeout(function () {
    _this.setExpirationTimer();
    _this.socket.emit("aboutToExpire", { secondsLeft: _this.expirationTimes.alertBefore });
    console.log("Order expiration alert");
    
  }, (this.expirationTimes.total - this.expirationTimes.alertBefore) * 1000);
};

Client.prototype.setExpirationTimer = function () {
  var _this = this;
  this.expirationTimer = setTimeout(function () {
    _this.expire();
    
  }, this.expirationTimes.alertBefore * 1000);
};

Client.prototype.update = function (order, callback) {
  this.resetExpirationTimer();
  
  var response = {
    ok: true,
    errors: {}
  };
  var info = order.info;
  
  this.validator._errors = [];
  
  var method = "validateStep" + order.step[0].toUpperCase() + order.step.substr(1);
  if (typeof(this[method]) == "function") {
    this[method](order.info, response);
  } else {
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

Client.prototype.place = function () {
  var _this = this;
  var orderInfo = this.getSerializedInfo();
  
  railsApi.post("orders", null, orderInfo, function (response) {
    _this.placed = true;
    _this.saved(response);
  });
};

Client.prototype.reserveSeat = function (seatId, callback) {
  this.resetExpirationTimer();

  var seat = this.seats.reserve(seatId, this.date);
  if (seat) {
    this.reservedSeats.push(seat);
    this.updateReservedSeats(seat);
    
    console.log("Seat reserved");
  }

  callback({ ok: seat != null, seatId: seatId });
};

Client.prototype.updateSeats = function (dateId, seats) {
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

Client.prototype.updateReservedSeats = function (addToUpdated) {
  var updatedSeats = this.reservedSeats.splice(0, this.reservedSeats.length - this.getNumberOfTickets());
  updatedSeats.forEach(function (seat) {
    seat.release();
  });
  if (addToUpdated) updatedSeats.push(addToUpdated);
  this.updatedSeats(this.date, updatedSeats);
};

Client.prototype.updatedSeats = function (dateId, updatedSeats) {
  if (updatedSeats.length < 1) return;
  this.emit("updatedSeats", dateId, updatedSeats);
};

Client.prototype.releaseSeats = function () {
  var updatedSeats = this.reservedSeats.slice(0);
  this.reservedSeats.forEach(function (seat) {
    seat.release();
  });
  this.reservedSeats.length = 0;
  
  this.updatedSeats(this.date, updatedSeats);
};

Client.prototype.getNumberOfTickets = function (tickets) {
  tickets = tickets || this.tickets;
  var number = 0;
  for (var typeId in tickets) {
    number += parseInt(tickets[typeId]);
  }
  return number;
};

Client.prototype.validateStepSeats = function (info, response) {
  if (this.reservedSeats.length != this.getNumberOfTickets()) {
    // TODO: i18n
    response.errors['general'] = "Die Anzahl der gewählten Sitzplätze stimmt nicht mit der Anzahl Ihrer Tickets überein.";
  }
};

Client.prototype.returnsErrors = function (response) {
  if (Object.keys(response.errors).length + this.validator._errors.length > 0) return false;
  return true;
};


Validator.prototype.error = function (error) {
  this._errors.push(error);
  return this;
};


module.exports = Client;