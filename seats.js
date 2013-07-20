var railsApi = require("./railsApi");


function Seat(id, t) {
  this.id = id;
  this.chosen = false;
  this.taken = t || false;
  
  this.available = function (exclusive) {
    return !this.taken && !this.chosen && (!exclusive || exclusive.includes(this));
  }
  
  this.choose = function (exclusive) {
    if (this.available(exclusive)) {
      this.chosen = true;
      return true;
    }
    
    return false;
  };
  
  this.release = function () {
    this.chosen = false;
  };
  
  this.forClient = function (exclusive, chosen) {
    seat = { available: this.available(exclusive) };
    if (chosen) seat['chosen'] = chosen.includes(this);
    
    return seat;
  };
};


exports.update = function (seats) {
  for (var dateId in seats) {
    var dateSeats = seats[dateId];
    dates[dateId] = dates[dateId] || {};
    
    for (var seatId in dateSeats) {
      var seatInfo = dateSeats[seatId];
      var seat = dates[dateId][seatId];
      if (!seat) {
        dates[dateId][seatId] = new Seat(seatId, !seatInfo.available);
      } else {
        seat.taken = !seatInfo.available
      }
    }
  }
};

exports.get = function (seatId, dateId) {
  if (!dates[dateId]) return null;
  return dates[dateId][seatId];
};

exports.choose = function (seatId, dateId, exclusive) {
  var seat = this.get(seatId, dateId);
  if (seat && seat.choose(exclusive)) {
    return seat;
  }
  
  return null;
};

exports.getAll = function (exclusive, chosen) {
  var seats = {};
  for (var dateId in dates) {
    seats[dateId] = this.getAllOnDate(dateId, exclusive, chosen);
  }
  
  return seats;
};

exports.getAllOnDate = function (dateId, exclusive, chosen) {
  var seats = {};
  for (var seatId in dates[dateId]) {
    seats[seatId] = dates[dateId][seatId].forClient(exclusive, chosen);
  }
  
  return seats;
};

var dates = {};
  
console.log("Updating seats...");
railsApi.get("seats", "", function (seatsInfo) {
  exports.update(seatsInfo.seats);
});