var util = require("util"),
    extend = require("node.extend");

var OrderClient = require("./orderClient");

function RetailClient(socket, event, type) {
  this.retailId = socket.handshake.query.retailId;
  
  RetailClient.super_.call(this, socket, event, type, this.retailId);
  
  this.expirationTimes = {
    alertBefore: 45,
    total: 180
  };
};

util.inherits(RetailClient, OrderClient);

RetailClient.prototype.placeOrder = function (orderInfo) {
  orderInfo = orderInfo || {};
  extend(true, orderInfo, {
    retailId: this.retailId,
    order: {
      date: this.date,
      tickets: this.tickets,
      seats: this.reservedSeats.map(function (seat) {
        return seat.id;
      })
    }
  });
  
  RetailClient.super_.prototype.placeOrder.call(this, orderInfo);
};

RetailClient.prototype.validateStepConfirm = function (info, response) {
  
};


module.exports = RetailClient;