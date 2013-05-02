var util = require("util");

var OrderClient = require("./orderClient");

function RetailClient(socket, event) {
  this.requiredSteps = ["date", "tickets", "seats", "confirm"];
  this.retailId = socket.handshake.query.retailId;
  
  RetailClient.super_.call(this, socket, event, "retail", this.retailId);
  
  this.updateEvent();
};

util.inherits(RetailClient, OrderClient);

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