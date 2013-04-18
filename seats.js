var railsApi = require("./railsApi");

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
  
  this.forClient = function (selected) {
    selected = selected || [];
    return {
      reserved: this.reserved,
      selected: (selected.indexOf(this) != -1) ? true : false,
      grid: this.grid
    };
  };
};

var seats = {
  dates: {},

  update: function () {
    var _this = this;
    console.log("Updating seats...");
    
    railsApi.get("seats", "", function (seats) {
      for (var i in seats) {
        var seatInfo = seats[i];
        var seatId = seatInfo.id;
    
        for (var dateId in seatInfo.reserved) {
          _this.dates[dateId] = _this.dates[dateId] || {};
      
          var seat = _this.dates[dateId][seatId];
          if (!seat) {
            _this.dates[dateId][seatId] = new Seat(seatId, seatInfo.reserved[dateId], seatInfo.grid);
          } else if (seatInfo.reserved[dateId]) {
            seat.reserved = seatInfo.reserved[dateId];
          }
        }
      }
  
      setTimeout(function () { _this.update(); }, 300000);
    });
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

seats.update();

module.exports = seats;