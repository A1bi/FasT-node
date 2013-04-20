var util = require("util");

var Client = require("./client");

function WebClient(socket, event) {
  this.address = {};
  this.payment = {};
  
  WebClient.super_.call(this, socket, event);
  
  this.updateSeats();
};

util.inherits(WebClient, Client);

WebClient.prototype.placeOrder = function () {
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
  
  RetailClient._super.placeOrder.call(this, "orders", orderInfo);
};

WebClient.prototype.placedOrder = function (response) {
  if (response.ok) {
    console.log("Order placed");
  }
  
  this.socket.disconnect();
};

WebClient.prototype.validateStepDate = function (info, response) {
  if (!this.event.seats.dates[info.date]) {
    response.errors['general'] = "Invalid date";
  }
  if (this.getNumberOfTickets(info.tickets) < 1) {
    response.errors['general'] = "Too few tickets";
  }
  
  if (this.returnsErrors(response)) {
    if (this.date != info.date) {
      this.releaseSeats();
      this.date = info.date;
    }
    this.tickets = info.tickets;
    this.updateReservedSeats();
  }
};

WebClient.prototype.validateStepAddress = function (info, response) {
  var _this = this;
  ["first_name", "last_name", "phone"].forEach(function (key) {
    _this.validator.check(info[key], [key, "Bitte füllen Sie dieses Feld aus."]).notEmpty();
  });
  
  this.validator.check(info.gender, ["gender", "Bitte geben Sie eine korrekte Anrede an."]).isIn(["0", "1"]);
  this.validator.check(info.plz, ["plz", "Bitte geben Sie eine korrekte Postleitzahl an."]).isInt().len(5, 5);
  this.validator.check(info.email, ["email", "Bitte geben Sie eine korrekte e-mail-Adresse an."]).isEmail();
  
  if (this.returnsErrors(response)) {
    this.address = info;
  }
};

WebClient.prototype.validateStepPayment = function (info, response) {
  this.validator.check(info.method, ["general", "Invalid payment method"]).isIn(["charge", "transfer"]);
  if (info.method == "charge") {
    this.validator.check(info.name, ["name", "Bitte geben Sie den Kontoinhaber an."]).notEmpty();
    this.validator.check(info.number, ["number", "Bitte geben Sie eine korrekte Kontonummer an."]).isInt().len(1, 8);
    this.validator.check(info.blz, ["blz", "Bitte geben Sie eine korrekte Bankleitzahl an."]).isInt().len(8, 8);
    this.validator.check(info.bank, ["bank", "Bitte geben Sie den Namen der Bank an."]).notEmpty();
  }
  
  if (this.returnsErrors(response)) {
    this.payment = info;
  }
};

WebClient.prototype.validateStepConfirm = function (info, response) {
  if (!info.accepted) response.errors.accepted = "Bitte stimmen Sie den AGB zu.";
};


module.exports = WebClient;