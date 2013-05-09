function Seat(id, r) {
  this.id = id;
  this.reserved = r || false;
  
  this.reserve = function () {
    if (!this.reserved) {
      this.reserved = true;
      return true;
    }
    
    return false;
  };
  
  this.release = function () {
    this.reserved = false;
  };
  
  this.forClient = function (selected) {
    seat = { reserved: this.reserved };
    if (selected) seat['selected'] = (selected.indexOf(this) != -1) ? true : false
    
    return seat;
  };
};

var seats = {
  dates: {},

  update: function (seats) {
    for (var i in seats) {
      var seatInfo = seats[i];
      var seatId = seatInfo.id;
  
      for (var dateId in seatInfo.reserved) {
        this.dates[dateId] = this.dates[dateId] || {};
    
        var seat = this.dates[dateId][seatId];
        if (!seat) {
          this.dates[dateId][seatId] = new Seat(seatId, seatInfo.reserved[dateId]);
        } else if (seatInfo.reserved[dateId]) {
          seat.reserved = seatInfo.reserved[dateId];
        }
      }
    }
  },
  
  get: function (seatId, dateId) {
    if (!this.dates[dateId]) return null;
    return this.dates[dateId][seatId];
  },
  
  reserve: function (seatId, dateId) {
    var seat = this.get(seatId, dateId);
    if (seat && seat.reserve()) {
      return seat;
    }
    
    return null;
  },
  
  getAll: function (selected) {
    var seats = {};
    for (var dateId in this.dates) {
      seats[dateId] = this.getAllOnDate(dateId, selected);
    }
    
    return seats;
  },
  
  getAllOnDate: function (dateId, selected) {
    var seats = {};
    for (var seatId in this.dates[dateId]) {
      seats[seatId] = this.dates[dateId][seatId].forClient(selected);
    }
    
    return seats;
  }
};

module.exports = seats;