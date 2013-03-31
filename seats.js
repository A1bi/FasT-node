var railsApi = require("./railsApi");

function Seat(r) {
  this.reserved = r || false;
  
  this.reserve = function () {
    if (!this.reserved) {
      this.reserved = true;
      return true;
    }
    
    return false;
  };
  
  this.forClient = function () {
    return {
      reserved: this.reserved
    };
  };
};

var seats = {
  dates: {},

  update: function () {
    var _this = this;
    console.log("Updating seats...");
    
    railsApi.get("seats", "", function (seats) {
      for (var seatId in seats) {
        var seatInfo = seats[seatId];
    
        for (var dateId in seatInfo.reserved) {
          _this.dates[dateId] = _this.dates[dateId] || {};
      
          var seat = _this.dates[dateId][seatId];
          if (!seat) {
            _this.dates[dateId][seatId] = new Seat(seatInfo.reserved[dateId]);
          } else if (seatInfo.reserved[dateId]) {
            seat.reserved = seatInfo.reserved[dateId];
          }
        }
      }
  
      setTimeout(function () { _this.update(); }, 300000);
    });
  },
  
  getAllOnDate: function (dateId) {
    var seats = {};
    for (var seatId in this.dates[dateId]) {
      seats[seatId] = this.dates[dateId][seatId].forClient();
    }
    
    return seats;
  }
};

seats.update();

module.exports = seats;