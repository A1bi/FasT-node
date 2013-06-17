var util = require("util");

var RetailClient = require("./retailClient");

function RetailAppClient(socket, event) {
  this.requiredSteps = ["date", "tickets", "seats", "confirm"];
  
  RetailAppClient.super_.call(this, socket, event, "retail", this.retailId);
};

util.inherits(RetailAppClient, RetailClient);

RetailAppClient.prototype.registerEvents = function () {
  var _this = this;
  
  RetailAppClient.super_.prototype.registerEvents.call(this);
  
  this.socket.on("resetOrder", function (data, callback) {
    _this.resetOrder();
    _this.resetExpirationTimer();
    _this.aborted = false;
  });
};

RetailAppClient.prototype.expire = function () {
  RetailAppClient.super_.prototype.expire.call(this);
  this.resetOrder();
};

RetailAppClient.prototype.placedOrder = function (response) {
  RetailAppClient.super_.prototype.placedOrder.call(this, response);
  
  this.resetOrder();
};

RetailAppClient.prototype.resetOrder = function () {
  var date = this.date, selectedSeats = this.reservedSeats;
  
  RetailAppClient.super_.prototype.resetOrder.call(this);
  
  this.updatedSeats(date, selectedSeats);
};


module.exports = RetailAppClient;