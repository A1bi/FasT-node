var util = require("util");

var Client = require("./client");

function Purchase(socket, seats) {
  this.address = {};
  this.payment = {};
  
  Purchase.super_.call(this, socket, seats);
};

util.inherits(Purchase, Client);

Purchase.prototype.getSerializedInfo = function () {
  return {
    purchase: {
      date: this.date,
      tickets: this.tickets,
      seats: this.reservedSeats.map(function (seat) {
        return seat.id;
      })
    }
  };
};

Purchase.prototype.saved = function (response) {
  if (response.ok) {
    console.log("Purchase placed");
  }
};

Purchase.prototype.validateStepDate = function (info, response) {
  if (!this.seats.dates[info.date]) {
    response.errors['general'] = "Invalid date";
  
  } else {
    if (this.date != info.date) {
      this.releaseSeats();
      this.date = info.date;
    }
    this.updateReservedSeats();
  }
};

Purchase.prototype.validateStepTickets = function (info, response) {
  if (this.getNumberOfTickets(info.tickets) < 1) {
    response.errors['general'] = "Too few tickets";
  }
};

Purchase.prototype.validateStepConfirm = function (info, response) {
  
};


module.exports = Purchase;