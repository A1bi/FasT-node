var util = require("util");

var Client = require("./client");

function RetailCheckoutClient(socket, event) {
  RetailCheckoutClient.super_.call(this, socket, "retailCheckout", socket.handshake.query.retailId);
};

util.inherits(RetailCheckoutClient, Client);


module.exports = RetailCheckoutClient;