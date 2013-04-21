var railsApi = require("./railsApi");

var event = {
  name: null,
  dates: null,
  ticketTypes: null,
  seats: require("./seats"),
  
  hashProp: function (info, target) {
    info.forEach(function (obj) {
      target[obj.id] = obj;
    });
  },
  
  update: function () {
    var _this = this;
    console.log("Updating current event...");
    
    railsApi.get("events", "current", function (eventInfo) {
      _this.name = eventInfo.name;
      _this.dates = eventInfo.dates;
      _this.ticketTypes = eventInfo.ticket_types;
      _this.seats.update(eventInfo.seats);
    });
  }
};

event.update();

module.exports = event;