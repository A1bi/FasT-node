var util = require("util");
var Validator = require("validator").Validator;

var Client = require("./client"),
    railsApi = require("./railsApi");

function OrderClient(socket, event, clientType, clientId) {
  this.event = event;
  this.reservedSeats = [];
  this.date = null;
  this.tickets = {};
  this.orderPlaced = false;
  this.aborted = false;
  this.remainingSteps = this.requiredSteps.slice(0);
  this.validator = new Validator();
  this.expirationTimer = null;
  this.expirationTimes = {
    alertBefore: 60,
    total: 300
  };
  
  OrderClient.super_.call(this, socket, clientType, clientId);
  
  this.resetOrder();
  this.resetExpirationTimer();
  
  this.updateSeats();
};

util.inherits(OrderClient, Client);

OrderClient.prototype.registerEvents = function () {
  var _this = this;
  
  OrderClient.super_.prototype.registerEvents.call(this);
  
  this.socket.on("reserveSeat", function (data, callback) {
    if (_this.aborted) return;
    _this.reserveSeat(data.seatId, callback);
  });
  
  this.socket.on("updateOrder", function (data, callback) {
    if (_this.aborted) return;
    _this.updateOrder(data.order, callback);
  });
};

OrderClient.prototype.destroy = function () {
  OrderClient.super_.prototype.destroy.call(this);
  
  this.aborted = true;
  this.killExpirationTimer();
  this.resetOrder();
  
  console.log("Order destroyed");
};

OrderClient.prototype.expire = function () {
  console.log("Order expired");
  this.socket.emit("expired");
};

OrderClient.prototype.killExpirationTimer = function () {
  clearTimeout(this.expirationTimer);
};

OrderClient.prototype.resetExpirationTimer = function () {
  this.killExpirationTimer();
  this.setExpirationAlertTimer();
};

OrderClient.prototype.setExpirationAlertTimer = function () {
  var _this = this;
  this.expirationTimer = setTimeout(function () {
    _this.setExpirationTimer();
    _this.socket.emit("aboutToExpire", { secondsLeft: _this.expirationTimes.alertBefore });
    console.log("Order expiration alert");
    
  }, (this.expirationTimes.total - this.expirationTimes.alertBefore) * 1000);
};

OrderClient.prototype.setExpirationTimer = function () {
  var _this = this;
  this.expirationTimer = setTimeout(function () {
    _this.expire();
    
  }, this.expirationTimes.alertBefore * 1000);
};

OrderClient.prototype.updateOrder = function (order, callback) {
  var response = {
    ok: true,
    errors: {}
  };
  var info = order.info;
  this.validator._errors = [];
  
  var validationMethod = "validateStep" + order.step[0].toUpperCase() + order.step.substr(1);
  if (this.requiredSteps.indexOf(order.step) == -1 || typeof(this[validationMethod]) != "function") {
    response.errors['general'] = "Invalid step";
  
  } else {
    this.resetExpirationTimer();
  
    this[validationMethod](order.info, response);
  }
  
  if (this.returnsNoErrors(response)) {
    this.remainingSteps.splice(this.remainingSteps.indexOf(order.step), 1);
    
    if (order.step == "confirm") {
      if (this.remainingSteps.length < 1) {
        this.placeOrder();
      } else {
        response.errors['general'] = "Some steps not finished";
      }
    }
  }
  
  if (!this.returnsNoErrors(response)) {
    this.validator._errors.forEach(function (error) {
      response.errors[error[0]] = error[1];
    });
    response.ok = false;
  }
  
  if (callback) callback(response);
};

OrderClient.prototype.resetOrder = function () {
  if (!this.orderPlaced) this.releaseSeats();
  
  this.reservedSeats = [];
  this.date = null;
  this.tickets = {};
  this.orderPlaced = false;
};

OrderClient.prototype.placeOrder = function (orderInfo) {
  var _this = this;
  if (this.orderPlaced) return;
  this.orderPlaced = true;
  this.killExpirationTimer();
  
  railsApi.post("orders", null, orderInfo, function (response) {
    _this.placedOrder(response);
  });
};

OrderClient.prototype.placedOrder = function (response) {
  if (response.ok === true) {
    console.log("Order placed");
  
  } else {
    this.orderPlaced = false;
    
    response = { ok: false, errors: { general: "unknown error" } }
  }
  
  this.resetOrder();
  
  this.socket.emit("orderPlaced", response);
};

OrderClient.prototype.reserveSeat = function (seatId, callback) {
  this.resetExpirationTimer();

  var seat = this.event.seats.reserve(seatId, this.date);
  if (seat) {
    this.reservedSeats.push(seat);
    this.updateReservedSeats(seat);
    
    console.log("Seat reserved");
  }

  if (callback) callback({ ok: seat != null, seatId: seatId });
};

OrderClient.prototype.updateSeats = function (dateId, seats) {
  var updatedSeats = {}, _this = this;
  
  if (dateId) {
    updatedSeats[dateId] = {};
    seats.forEach(function (seat) {
      updatedSeats[dateId][seat.id] = seat.forClient(_this.reservedSeats);
    });
  
  } else {
    updatedSeats = this.event.seats.getAll();
  }
  
  this.socket.emit("updateSeats", {
    seats: updatedSeats
  });
};

OrderClient.prototype.updateReservedSeats = function (addToUpdated) {
  var updatedSeats = this.reservedSeats.splice(0, this.reservedSeats.length - this.getNumberOfTickets());
  updatedSeats.forEach(function (seat) {
    seat.release();
  });
  if (addToUpdated) updatedSeats.push(addToUpdated);
  this.updatedSeats(this.date, updatedSeats);
};

OrderClient.prototype.updatedSeats = function (dateId, updatedSeats) {
  if (updatedSeats.length < 1) return;
  this.emit("updatedSeats", dateId, updatedSeats);
};

OrderClient.prototype.releaseSeats = function () {
  var updatedSeats = this.reservedSeats.slice(0);
  this.reservedSeats.forEach(function (seat) {
    seat.release();
  });
  this.reservedSeats.length = 0;
  
  this.updatedSeats(this.date, updatedSeats);
};

OrderClient.prototype.getNumberOfTickets = function (tickets) {
  tickets = tickets || this.tickets;
  var number = 0;
  for (var typeId in tickets) {
    number += parseInt(tickets[typeId]) || 0;
  }
  return number;
};

OrderClient.prototype.validateStepDate = function (info, response) {
  if (!this.event.dates.getObjectWithId(info.date)) {
    response.errors['general'] = "Invalid date";
  
  } else if (this.date != info.date) {
    this.releaseSeats();
    this.date = info.date;
  }
};

OrderClient.prototype.validateStepTickets = function (info, response) {
  for (var typeId in info.tickets) {
    if (!this.event.ticketTypes.getObjectWithId(typeId)) {
      response.errors['general'] = "Invalid ticket type";
      break;
    }
  }
  
  if (this.returnsNoErrors(response)) {
    if (this.getNumberOfTickets(info.tickets) < 1) {
      response.errors['general'] = "Too few tickets";
  
    } else {
      this.tickets = info.tickets;
      this.updateReservedSeats();
    }
  }
};

OrderClient.prototype.validateStepSeats = function (info, response) {
  var number = this.getNumberOfTickets();
  if (number < 1) {
    response.errors['general'] = "Tickets have yet to be selected";
    
  } else if (this.reservedSeats.length != number) {
    // TODO: i18n
    response.errors['general'] = "Die Anzahl der gewählten Sitzplätze stimmt nicht mit der Anzahl Ihrer Tickets überein.";
  }
};

OrderClient.prototype.returnsNoErrors = function (response) {
  if (Object.keys(response.errors).length + this.validator._errors.length > 0) return false;
  return true;
};

OrderClient.prototype.getNumberFromString = function (string) {
  return string.replace(/[^\d]/g, "");
};


Validator.prototype.error = function (error) {
  this._errors.push(error);
  return this;
};


module.exports = OrderClient;