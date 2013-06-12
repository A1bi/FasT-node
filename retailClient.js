var util = require("util");

var OrderClient = require("./orderClient");

function RetailClient(socket, event) {
  this.requiredSteps = ["date", "tickets", "seats", "confirm"];
  this.retailId = socket.handshake.query.retailId;
  
  RetailClient.super_.call(this, socket, event, "retail", this.retailId);
  
  this.expirationTimes = {
    alertBefore: 45,
    total: 180
  };
};

util.inherits(RetailClient, OrderClient);

RetailClient.prototype.registerEvents = function () {
  var _this = this;
  
  RetailClient.super_.prototype.registerEvents.call(this);
  
  this.socket.on("resetOrder", function (data, callback) {
    _this.resetOrder();
    _this.resetExpirationTimer();
    _this.aborted = false;
  });
};

RetailClient.prototype.expire = function () {
  RetailClient.super_.prototype.expire.call(this);
  this.resetOrder();
};

RetailClient.prototype.placeOrder = function () {
  var orderInfo = {
    retailId: this.retailId,
    order: {
      date: this.date,
      tickets: this.tickets,
      seats: this.reservedSeats.map(function (seat) {
        return seat.id;
      })
    }
  };
  
  RetailClient.super_.prototype.placeOrder.call(this, orderInfo);
};

RetailClient.prototype.placedOrder = function (response) {
  RetailClient.super_.prototype.placedOrder.call(this, response);
  
  this.resetOrder();
};

RetailClient.prototype.validateStepConfirm = function (info, response) {
  
};


module.exports = RetailClient;