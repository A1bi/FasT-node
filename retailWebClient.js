var util = require("util");

var RetailClient = require("./retailClient");

function RetailWebClient(socket, event) {
  this.requiredSteps = ["date", "seats", "confirm"];
  
  RetailWebClient.super_.call(this, socket, event, "retailWeb");
};

util.inherits(RetailWebClient, RetailClient);

RetailWebClient.prototype.placeOrder = function () {
  var orderInfo = {
    web: true
  };
  
  RetailWebClient.super_.prototype.placeOrder.call(this, orderInfo);
};

RetailWebClient.prototype.placedOrder = function (response) {
  RetailWebClient.super_.prototype.placedOrder.call(this, response);
  
  this.socket.disconnect();
};

RetailWebClient.prototype.validateStepDate = function (info, response) {
  RetailWebClient.super_.prototype.validateStepDate.call(this, info, response);
  RetailWebClient.super_.prototype.validateStepTickets.call(this, info, response);
};


module.exports = RetailWebClient;