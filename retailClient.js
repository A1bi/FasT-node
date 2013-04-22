var util = require("util");

var Client = require("./client");

function RetailClient(socket, event) {
  this.requiredSteps = ["date", "tickets", "seats", "confirm"];
  
  RetailClient.super_.call(this, socket, event);
  
  this.updateEvent();
};

util.inherits(RetailClient, Client);

RetailClient.prototype.placeOrder = function () {
  var orderInfo = {
    purchase: {
      date: this.date,
      tickets: this.tickets,
      seats: this.reservedSeats.map(function (seat) {
        return seat.id;
      })
    }
  };
  
  RetailClient.super_.placeOrder.call(this, "purchases", orderInfo);
};

RetailClient.prototype.placedOrder = function (response) {
  if (response.ok) {
    console.log("Purchase placed");
  }
  
  this.resetOrder();
};

RetailClient.prototype.validateStepConfirm = function (info, response) {
  
};


module.exports = RetailClient;