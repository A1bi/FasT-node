var util = require("util"),
    crypto = require('crypto');

var Client = require("./client"),
    railsApi = require("./railsApi");

function SeatingClient(socket, seats) {
  this.seats = seats;
  this.chosenSeats = [];
  this.exclusiveSeats = [];
  this.numberOfSeats = 0;
  this.date = null;
  this.aborted = false;
  this.expirationTimer = null;
  this.expirationTime = 600;
  
  var id = crypto.randomBytes(12).toString("hex");
  SeatingClient.super_.call(this, socket, "seating", id);
  this.socket.emit("gotSeatingId", { id: id });
  
  this.setExpirationTimer();
  this.updateSeats();
};

util.inherits(SeatingClient, Client);

SeatingClient.prototype.registerEvents = function () {
  var _this = this;
  
  SeatingClient.super_.prototype.registerEvents.call(this);
  
  this.socket.on("chooseSeat", function (data, callback) {
    if (_this.aborted) return;
    _this.chooseSeat(data.seatId, callback);
  });
  
  this.socket.on("setDateAndNumberOfSeats", function (data) {
    if (!data) return;
    _this.setDateAndNumberOfSeats(data.date, data.numberOfSeats);
  });
};

SeatingClient.prototype.destroy = function () {
  SeatingClient.super_.prototype.destroy.call(this);
  
  this.aborted = true;
  this.killExpirationTimer();
};

SeatingClient.prototype.expire = function () {
  console.log("Seating session expired");
  this.socket.emit("expired");
};

SeatingClient.prototype.killExpirationTimer = function () {
  clearTimeout(this.expirationTimer);
};

SeatingClient.prototype.setExpirationTimer = function () {
  var _this = this;
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
    var seat = this.seats.choose(seatId, this.date);
    if (seat) {
      this.chosenSeats.push(seat);
      this.updateChosenSeats(seat);
    
      console.log("Seat chosen");
    }
  }

  if (callback) callback({ ok: seat != null, seatId: seatId });
};

SeatingClient.prototype.updateSeats = function (dateId, seats) {
  var updatedSeats = {}, _this = this;
  
  if (dateId) {
    updatedSeats[dateId] = {};
    seats.forEach(function (seat) {
      updatedSeats[dateId][seat.id] = seat.forClient(_this.exclusiveSeats, _this.chosenSeats);
    });
  
  } else {
    updatedSeats = this.seats.getAll();
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
  this.updatedSeats(this.date, updatedSeats);
};

SeatingClient.prototype.updatedSeats = function (dateId, updatedSeats) {
  if (updatedSeats.length < 1) return;
  this.emit("updatedSeats", dateId, updatedSeats);
};

SeatingClient.prototype.releaseSeats = function () {
  var updatedSeats = this.chosenSeats.slice(0);
  this.chosenSeats.forEach(function (seat) {
    seat.release();
  });
  this.chosenSeats.length = 0;
  
  this.updatedSeats(this.date, updatedSeats);
};


module.exports = SeatingClient;