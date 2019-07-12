var util = require("util");

var Client = require("./client"),
    allSeats = require("./seats");

SeatingClient.expirationTime = 1800 * 1000;

function SeatingClient(socket, eventId, privileged) {
  this.chosenSeats;
  this.exclusiveSeats;
  this.originalSeats;
  this.numberOfSeats;
  this.event = parseInt(eventId);
  this.date;
  this.expirationTimer = null;
  this.privileged = privileged;

  this.init();

  SeatingClient.super_.call(this, socket, "seating");

  this.updateSeats();
};

util.inherits(SeatingClient, Client);

SeatingClient.prototype.registerEvents = function () {
  this.updatedSeatsListener = this.updateSeats.bind(this);
  allSeats.on("updatedSeats", this.updatedSeatsListener);
};

SeatingClient.prototype.registerSocketEvents = function () {
  var _this = this;
  SeatingClient.super_.prototype.registerSocketEvents.call(this);

  this.socket.on("chooseSeat", function (data, callback) {
    _this.chooseSeat(data.seatId, callback);
  });

  this.socket.on("setDateAndNumberOfSeats", function (data, callback) {
    if (!data) return;
    _this.setDateAndNumberOfSeats(data.date, data.numberOfSeats);
    if (callback) callback();
  });

  this.socket.on("reset", function () {
    _this.reset();
  });
};

SeatingClient.prototype.destroy = function () {
  SeatingClient.super_.prototype.destroy.call(this);

  this.killExpirationTimer();
  this.releaseSeats();

  allSeats.off("updatedSeats", this.updatedSeatsListener);
};

SeatingClient.prototype.init = function () {
  this.chosenSeats = [];
  this.exclusiveSeats = [];
  this.originalSeats = [];
  this.numberOfSeats = 0;
  this.date = null;
  this.setExpirationTimer();
  this.registerEvents();
};

SeatingClient.prototype.reset = function () {
  this.releaseSeats();
  this.init();

  console.log("Seats reset for client");
};

SeatingClient.prototype.expire = function () {
  console.log("Seating session expired");
  this.socket.emit("expired");
  this.disconnect();
};

SeatingClient.prototype.killExpirationTimer = function () {
  clearTimeout(this.expirationTimer);
};

SeatingClient.prototype.setExpirationTimer = function () {
  if (this.privileged) return;

  var _this = this;
  this.killExpirationTimer();
  this.expirationTimer = setTimeout(function () {
    _this.expire();

  }, SeatingClient.expirationTime);
};

SeatingClient.prototype.setDateAndNumberOfSeats = function (date, number) {
  if (this.date != date) {
    this.releaseSeats();
    var _this = this;
    var updatedSeats = [];
    this.originalSeats.forEach(function (seat) {
      if (seat.date == date) {
        _this.chosenSeats.push(seat);
        updatedSeats.push(seat);
      }
    });
    this.date = date;
  }
  this.numberOfSeats = number;

  this.updateChosenSeats(updatedSeats);
};

SeatingClient.prototype.chooseSeat = function (seatId, callback) {
  var ok = false;
  if (this.date && this.numberOfSeats > 0) {
    var seat = allSeats.get(seatId, this.date);
    if (seat) {
      if (this.removeChosenSeat(seat)) {
        ok = true;
        console.log("Seat choice revoked");

      } else if (seat.choose(this.exclusiveSeats, this.originalSeats, this.privileged)) {
        this.chosenSeats.push(seat);
        ok = true;
        console.log("Seat chosen");
      }
      if (ok) this.updateChosenSeats([seat]);
    }
  }

  if (callback) callback({ ok: ok, seatId: seatId });
};

SeatingClient.prototype.updateSeats = function (seats) {
  seats = seats || allSeats.getAll();
  var updatedSeats = {}, _this = this, anyUpdates = false;

  seats.forEach(function (seat) {
    if (!_this.event || allSeats.events[_this.event].dates.indexOf(parseInt(seat.date)) >= 0) {
      updatedSeats[seat.date] = updatedSeats[seat.date] || {};
      updatedSeats[seat.date][seat.id] = seat.forClient(
        _this.exclusiveSeats,
        _this.chosenSeats,
        _this.originalSeats,
        _this.privileged
      );
      anyUpdates = true;
    }
  });

  if (!anyUpdates) return;

  this.socket.emit("updateSeats", {
    seats: updatedSeats
  });
};

SeatingClient.prototype.updateChosenSeats = function (addToUpdated) {
  var updatedSeats = this.chosenSeats.splice(0, this.chosenSeats.length - this.numberOfSeats);
  updatedSeats.forEach(function (seat) {
    seat.release();
  });
  if (addToUpdated) updatedSeats = updatedSeats.concat(addToUpdated);
  allSeats.updatedSeats(updatedSeats);
};

SeatingClient.prototype.getChosenSeats = function () {
  return this.chosenSeats.map(function (seat) {
    return seat.id;
  });
};

SeatingClient.prototype.setOriginalSeats = function (seats) {
  var updatedSeats = [];
  this.originalSeats = [];
  this.chosenSeats = [];
  this.iterateSeats(seats, function (seat) {
    this.originalSeats.push(seat);
    this.chosenSeats.push(seat);
    updatedSeats.push(seat);
  });
  this.updateSeats(updatedSeats);
};

SeatingClient.prototype.addExclusiveSeats = function (seats, updatedSeats) {
  this.updateExclusiveSeats(seats, function (seat, index) {
    if (index == -1) {
      this.exclusiveSeats.push(seat);
      return true;
    }
  }, updatedSeats);
};

SeatingClient.prototype.removeExclusiveSeats = function (seats) {
  this.updateExclusiveSeats(seats, function (seat, index) {
    if (index > -1) {
      this.exclusiveSeats.splice(index, 1);
      this.removeChosenSeat(seat);
      return true;
    }
  });
};

SeatingClient.prototype.setExclusiveSeats = function (seats) {
  var updatedSeats = this.exclusiveSeats.slice(0);
  this.exclusiveSeats = [];
  this.addExclusiveSeats(seats, updatedSeats);
};

SeatingClient.prototype.updateExclusiveSeats = function (seats, callback, updatedSeats) {
  updatedSeats = updatedSeats || [];

  this.iterateSeats(seats, function (seat) {
    var index = this.exclusiveSeats.indexOf(seat);
    if (callback.call(this, seat, index)) {
      updatedSeats.push(seat);
    }
  });

  this.updateSeats(updatedSeats);
};

SeatingClient.prototype.removeChosenSeat = function (seat) {
  var chosenIndex = this.chosenSeats.indexOf(seat);
  if (chosenIndex > -1) {
    seat.release();
    this.chosenSeats.splice(chosenIndex, 1);
    return true;
  }
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
      if (seat) {
        callback.call(_this, seat);
      }
    });
  }
};


module.exports = SeatingClient;
