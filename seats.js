var util = require("util"),
    EventEmitter = require("events").EventEmitter;

var railsApi = require("./railsApi");


function Seat(id, d, t, e) {
  this.id = id;
  this.date = d;
  this.chosen = false;
  this.taken = t || false;
  this.exclusive = e || false;

  this.inCollection = function (collection) {
    return collection && collection.includes(this);
  };

  this.available = function (exclusives, originals, privileged) {
    return this.inCollection(originals) || (
             !this.taken && !this.chosen &&
             (!this.exclusive || privileged || this.inCollection(exclusives))
           );
  };

  this.choose = function (exclusives, originals, privileged) {
    if (this.available(exclusives, originals, privileged)) {
      this.chosen = true;
      return true;
    }

    return false;
  };

  this.release = function () {
    this.chosen = false;
  };

  this.forClient = function (exclusives, chosen, originals, privileged) {
    seat = {};
    if (!this.available(exclusives, originals, privileged)) seat.t = true;
    if (chosen && chosen.includes(this)) seat.c = true;
    if (this.exclusive && this.inCollection(exclusives)) seat.e = true;

    return seat;
  };
};


var instance = null;

function Seats() {
  this.events = {};
  this.dates = {};
  var _this = this;

  railsApi.on("updateSeats", function (seats) {
    _this.update(seats);
  });

  railsApi.get("events", function (seatsInfo) {
    console.log("Initializing seats, fetching event info from Rails...");
    _this.events = seatsInfo.events;
    _this.update(seatsInfo.seats);
  });

  this.setMaxListeners(Infinity);
}

util.inherits(Seats, EventEmitter);

Seats.prototype.update = function (seats) {
  var updatedSeats = [];
  for (var dateId in seats) {
    var dateSeats = seats[dateId];
    this.dates[dateId] = this.dates[dateId] || {};

    for (var seatId in dateSeats) {
      var seatInfo = dateSeats[seatId];
      var seat = this.dates[dateId][seatId];
      if (!seat) {
        seat = new Seat(seatId, dateId, !seatInfo.available, seatInfo.reserved);
        this.dates[dateId][seatId] = seat;
      } else {
        seat.taken = !seatInfo.available;
        seat.exclusive = seatInfo.reserved;
      }
      updatedSeats.push(seat);
    }
  }
  console.log("Updated " + updatedSeats.length + " seats successfully.");

  this.updatedSeats(updatedSeats);
};

Seats.prototype.updatedSeats = function (seats) {
  if (seats.length < 1) return;
  this.emit("updatedSeats", seats);
};

Seats.prototype.get = function (seatId, dateId) {
  if (!this.dates[dateId]) return null;
  return this.dates[dateId][seatId];
};

Seats.prototype.getAll = function () {
  var seats = [];
  for (var dateId in this.dates) {
    for (var seatId in this.dates[dateId]) {
      seats.push(this.dates[dateId][seatId]);
    }
  }
  return seats;
};


module.exports = function () {
  if (!instance) instance = new Seats();
  return instance;
}();
