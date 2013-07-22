var util = require("util"),
    crypto = require('crypto');

var Client = require("./client"),
    railsApi = require("./railsApi"),
    allSeats = require("./seats");

function SeatingClient(socket) {
  this.chosenSeats;
  this.exclusiveSeats;
  this.numberOfSeats;
  this.date;
  this.expirationTimer = null;
  this.expirationTime = 900;
  this.expired;
  
  this.init();
  
  var id = crypto.randomBytes(12).toString("hex");
  SeatingClient.super_.call(this, socket, "seating", id);
  
  this.updateSeats();
  this.socket.emit("gotSeatingId", { id: id });
};

util.inherits(SeatingClient, Client);

SeatingClient.prototype.registerEvents = function () {
  var _this = this;
  SeatingClient.super_.prototype.registerEvents.call(this);
  
  this.socket.on("chooseSeat", function (data, callback) {
    _this.chooseSeat(data.seatId, callback);
  });
  
  this.socket.on("setDateAndNumberOfSeats", function (data, callback) {
    if (!data || _this.expired) return;
    _this.setDateAndNumberOfSeats(data.date, data.numberOfSeats);
    callback();
  });
  
  this.socket.on("reset", function () {
    _this.reset();
  });
};

SeatingClient.prototype.destroy = function () {
  SeatingClient.super_.prototype.destroy.call(this);
  
  this.killExpirationTimer();
  this.releaseSeats();
};

SeatingClient.prototype.init = function () {
  this.chosenSeats = [];
  this.exclusiveSeats = [];
  this.numberOfSeats = 0;
  this.date = null;
  this.expired = false;
  this.setExpirationTimer();
};

SeatingClient.prototype.reset = function () {
  this.releaseSeats();
  this.init();
};

SeatingClient.prototype.expire = function () {
  this.reset();
  this.killExpirationTimer();
  this.expired = true;
  
  console.log("Seating session expired");
  this.socket.emit("expired");
};

SeatingClient.prototype.killExpirationTimer = function () {
  clearTimeout(this.expirationTimer);
};

SeatingClient.prototype.setExpirationTimer = function () {
  var _this = this;
  this.killExpirationTimer();
  this.expirationTimer = setTimeout(function () {
    _this.expire();
    
  }, this.expirationTime * 1000);
};

SeatingClient.prototype.setDateAndNumberOfSeats = function (date, number) {
  if (this.date != date) {
    this.releaseSeats();
    this.date = date;
  }
  this.numberOfSeats = number;
  
  this.updateChosenSeats();
};

SeatingClient.prototype.chooseSeat = function (seatId, callback) {
  if (this.date && this.numberOfSeats > 0) {
    var seat = allSeats.choose(seatId, this.date);
    if (seat) {
      this.chosenSeats.push(seat);
      this.updateChosenSeats(seat);
    
      console.log("Seat chosen");
    }
  }

  if (callback) callback({ ok: seat != null, seatId: seatId });
};

SeatingClient.prototype.updateSeats = function (seats) {
  seats = seats || allSeats.getAll();
  var updatedSeats = {};
  for (var dateId in seats) {
    updatedSeats[dateId] = {};
    for (var seatId in seats[dateId]) {
      updatedSeats[dateId][seatId] = seats[dateId][seatId].forClient(this.exclusiveSeats, this.chosenSeats);
    }
  }
  
  this.socket.emit("updateSeats", {
    seats: updatedSeats
  });
};

SeatingClient.prototype.updateChosenSeats = function (addToUpdated) {
  var updatedSeats = this.chosenSeats.splice(0, this.chosenSeats.length - this.numberOfSeats);
  updatedSeats.forEach(function (seat) {
    seat.release();
  });
  if (addToUpdated) updatedSeats.push(addToUpdated);
  allSeats.updatedSeats(updatedSeats);
};

SeatingClient.prototype.releaseSeats = function () {
  var updatedSeats = this.chosenSeats.slice(0);
  this.chosenSeats.forEach(function (seat) {
    seat.release();
  });
  this.chosenSeats.length = 0;
  
  allSeats.updatedSeats(updatedSeats);
};


module.exports = SeatingClient;