var util = require("util");
var Validator = require("validator").Validator;
var EventEmitter = require("events").EventEmitter;

var railsApi = require("./railsApi");

function Client(socket, event) {
  this.socket = socket;
  this.event = event;
  this.reservedSeats = [];
  this.date = null;
  this.tickets = {};
  this.orderPlaced = false;
  this.remainingSteps = this.requiredSteps.slice(0);
  this.validator = new Validator();
  this.expirationTimer = null;
  this.expirationTimes = {
    alertBefore: 60,
    total: 300
  };
  
  this.resetOrder();
  this.registerEvents();
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
    _this.updateOrder(data.order, callback);
  });
};

Client.prototype.destroy = function () {
  this.killExpirationTimer();
  this.emit("destroyed");
  if (!this.orderPlaced) this.releaseSeats();
  
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

Client.prototype.updateOrder = function (order, callback) {
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

Client.prototype.resetOrder = function () {
  this.reservedSeats = [];
  this.date = null;
  this.tickets = {};
  this.orderPlaced = false;
};

Client.prototype.placeOrder = function (orderInfo) {
  var _this = this;
  if (this.orderPlaced) return;
  this.orderPlaced = true;
  
  railsApi.post("orders", null, orderInfo, function (response) {
    _this.placedOrder(response);
  });
};

Client.prototype.placedOrder = function (response) {
  var clientResponse;
  if (response.ok) {
    console.log("Order placed");
    
    clientResponse = {
      ok: true,
      order: response.order
    }
  
  } else {
    clientResponse = {
      ok: false,
      errors: {
        general: "unknown error"
      }
    }
  }
  
  this.socket.emit("orderPlaced", clientResponse);
};

Client.prototype.reserveSeat = function (seatId, callback) {
  this.resetExpirationTimer();

  var seat = this.event.seats.reserve(seatId, this.date);
  if (seat) {
    this.reservedSeats.push(seat);
    this.updateReservedSeats(seat);
    
    console.log("Seat reserved");
  }

  if (callback) callback({ ok: seat != null, seatId: seatId });
};

Client.prototype.updateEvent = function () {
  this.socket.emit("updateEvent", {
    event: {
      name: this.event.name,
      dates: this.event.dates,
      ticketTypes: this.event.ticketTypes,
      seats: this.event.seats.getAll(null, true)
    }
  });
};

Client.prototype.updateSeats = function (dateId, seats) {
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
    number += parseInt(tickets[typeId]) || 0;
  }
  return number;
};

Client.prototype.validateStepDate = function (info, response) {
  if (!this.event.dates.getObjectWithId(info.date)) {
    response.errors['general'] = "Invalid date";
  
  } else if (this.date != info.date) {
    this.releaseSeats();
    this.date = info.date;
  }
};

Client.prototype.validateStepTickets = function (info, response) {
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

Client.prototype.validateStepSeats = function (info, response) {
  var number = this.getNumberOfTickets();
  if (number < 1) {
    response.errors['general'] = "Tickets have yet to be selected";
    
  } else if (this.reservedSeats.length != number) {
    // TODO: i18n
    response.errors['general'] = "Die Anzahl der gewählten Sitzplätze stimmt nicht mit der Anzahl Ihrer Tickets überein.";
  }
};

Client.prototype.returnsNoErrors = function (response) {
  if (Object.keys(response.errors).length + this.validator._errors.length > 0) return false;
  return true;
};


Validator.prototype.error = function (error) {
  this._errors.push(error);
  return this;
};


module.exports = Client;