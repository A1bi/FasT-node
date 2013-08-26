var util = require("util"),
    crypto = require('crypto');

var Client = require("./client"),
    railsApi = require("./railsApi"),
    allSeats = require("./seats");

function SeatingClient(socket, sessionInfo) {
  this.chosenSeats;
  this.exclusiveSeats;
  this.originalSeats;
  this.numberOfSeats;
  this.date;
  this.expirationTimer = null;
  this.expirationTime = 900;
  this.expired;
  
  this.init();
  
  var id = crypto.randomBytes(12).toString("hex");
  SeatingClient.super_.call(this, socket, "seating", id);
  
  sessionInfo = sessionInfo || {};
  if (sessionInfo.originalSeats) {
    this.setOriginalSeats(sessionInfo.originalSeats);
  }
  
  this.setSocket(socket);
};

util.inherits(SeatingClient, Client);

SeatingClient.prototype.setSocket = function (socket) {
  if (!socket) return;
  this.socket = socket;
  this.updateSeats();
  this.socket.emit("gotSeatingId", { id: id });
};

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
  this.originalSeats = [];
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
    var seat = allSeats.choose(seatId, this.date, this.exclusiveSeats, this.originalSeats);
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
  var updatedSeats = {}, _this = this;
  seats.forEach(function (seat) {
    updatedSeats[seat.date] = updatedSeats[seat.date] || {};
    updatedSeats[seat.date][seat.id] = seat.forClient(_this.exclusiveSeats, _this.chosenSeats, _this.originalSeats);
  });
  
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

SeatingClient.prototype.getChosenSeats = function () {
  return this.chosenSeats.map(function (seat) {
    return seat.id;
  });
};

SeatingClient.prototype.setOriginalSeats = function (seats) {
  this.originalSeats = [];
  this.iterateSeats(seats, function (seat) {
    this.originalSeats.push(seat);
  });
};

SeatingClient.prototype.setExclusiveSeats = function (seats) {
  var updatedSeats = this.exclusiveSeats.slice(0);
  this.exclusiveSeats = [];
  
  this.iterateSeats(seats, function (seat) {
    this.exclusiveSeats.push(seat);
    updatedSeats.push(seat);
  });
  
  this.updateSeats(updatedSeats);
};

SeatingClient.prototype.releaseSeats = function () {
  var updatedSeats = this.chosenSeats.slice(0);
  this.chosenSeats.forEach(function (seat) {
    seat.release();
  });
  this.chosenSeats.length = 0;
  
  allSeats.updatedSeats(updatedSeats);
};

SeatingClient.prototype.iterateSeats = function (seats, callback) {
  var _this = this;
  for (var dateId in seats) {
    seats[dateId].forEach(function (seatId) {
      var seat = allSeats.get(seatId, dateId);
      callback.call(_this, seat);
    });
  }
};


module.exports = SeatingClient;