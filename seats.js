function Seat(id, r, g) {
  this.id = id;
  this.reserved = r || false;
  this.grid = g;
  
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
  
  this.forClient = function (selected, grid) {
    seat = { reserved: this.reserved };
    if (selected) seat['selected'] = (selected.indexOf(this) != -1) ? true : false
    if (grid) seat['grid'] = this.grid;
    
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
          this.dates[dateId][seatId] = new Seat(seatId, seatInfo.reserved[dateId], seatInfo.grid);
        } else if (seatInfo.reserved[dateId]) {
          seat.reserved = seatInfo.reserved[dateId];
        }
      }
    }
  },
  
  get: function (seatId, dateId) {
    return this.dates[dateId][seatId];
  },
  
  reserve: function (seatId, dateId) {
    var seat = this.get(seatId, dateId);
    if (seat && seat.reserve()) {
      return seat;
    }
    
    return null;
  },
  
  getAll: function (selected, grid) {
    var seats = {};
    for (var dateId in this.dates) {
      seats[dateId] = this.getAllOnDate(dateId, selected, grid);
    }
    
    return seats;
  },
  
  getAllOnDate: function (dateId, selected, grid) {
    var seats = {};
    for (var seatId in this.dates[dateId]) {
      seats[seatId] = this.dates[dateId][seatId].forClient(selected, grid);
    }
    
    return seats;
  }
};

module.exports = seats;