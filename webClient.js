var util = require("util");

var OrderClient = require("./orderClient");

function WebClient(socket, event) {
  this.address = {};
  this.payment = {};
  this.requiredSteps = ["date", "seats", "address", "payment", "confirm"];
  
  WebClient.super_.call(this, socket, event, "web");
};

util.inherits(WebClient, OrderClient);

WebClient.prototype.expire = function () {
  WebClient.super_.prototype.expire.call(this);
  this.socket.disconnect();
};

WebClient.prototype.placeOrder = function () {
  var orderInfo = {
    order: {
      date: this.date,
      tickets: this.tickets,
      seats: this.reservedSeats.map(function (seat) {
        return seat.id;
      }),
      address: this.address,
      payment: this.payment,
      newsletter: this.newsletter
    }
  };
  
  WebClient.super_.prototype.placeOrder.call(this, orderInfo);
};

WebClient.prototype.placedOrder = function (response) {
  WebClient.super_.prototype.placedOrder.call(this, response);
  
  this.socket.disconnect();
};

WebClient.prototype.validateStepDate = function (info, response) {
  WebClient.super_.prototype.validateStepDate.call(this, info, response);
  WebClient.super_.prototype.validateStepTickets.call(this, info, response);
};

WebClient.prototype.validateStepAddress = function (info, response) {
  var _this = this;
  ["first_name", "last_name", "phone"].forEach(function (key) {
    _this.validator.check(info[key], [key, "Bitte füllen Sie dieses Feld aus."]).notEmpty();
  });
  
  this.validator.check(info.gender, ["gender", "Bitte geben Sie eine korrekte Anrede an."]).isIn(["0", "1"]);
  this.validator.check(info.plz, ["plz", "Bitte geben Sie eine korrekte Postleitzahl an."]).isInt().len(5, 5);
  this.validator.check(info.email, ["email", "Bitte geben Sie eine korrekte e-mail-Adresse an."]).isEmail();
  
  if (this.returnsNoErrors(response)) {
    this.address = info;
  }
};

WebClient.prototype.validateStepPayment = function (info, response) {
  this.validator.check(info.method, ["general", "Invalid payment method"]).isIn(["charge", "transfer"]);
  if (info.method == "charge") {
    info.number = this.getNumberFromString(info.number);
    info.blz = this.getNumberFromString(info.blz);
    this.validator.check(info.name, ["name", "Bitte geben Sie den Kontoinhaber an."]).notEmpty();
    this.validator.check(info.number, ["number", "Bitte geben Sie eine korrekte Kontonummer an."]).isInt().len(1, 12);
    this.validator.check(info.blz, ["blz", "Bitte geben Sie eine korrekte Bankleitzahl an."]).isInt().len(8, 8);
    this.validator.check(info.bank, ["bank", "Bitte geben Sie den Namen der Bank an."]).notEmpty();
  }
  
  if (this.returnsNoErrors(response)) {
    this.payment = info;
  }
};

WebClient.prototype.validateStepConfirm = function (info, response) {
  if (!info.accepted) response.errors.accepted = "Bitte stimmen Sie den AGB zu.";
  
  if (this.returnsNoErrors(response)) {
    this.newsletter = info.newsletter;
  }
};


module.exports = WebClient;