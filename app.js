var socketio = require("socket.io");

require("./extensions");    
var seats = require("./seats"),
    api = require("./railsApi"),
    SeatingClient = require("./seatingClient");

if (process.env.NODE_ENV == "production") {
  var dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log('error: missing ENV variable SENTRY_DSN');
    process.exit(1);
  }
  var Raven = require('raven');
  Raven.config(dsn).install();
}

var clients = [];

api.init(clients);

var io = socketio(api.server, {
  "path": "/node"
});

io.of("/seating").on("connection", function (socket) {
  var client = new SeatingClient(socket);
  client.on("destroyed", function () {
    clients.splice(clients.indexOf(client), 1);
  });
  clients.push(client);
});

seats.on("updatedSeats", function (updatedSeats) {
  clients.forEach(function (c) {
    if (typeof(c.updateSeats) == 'function') {
      c.updateSeats(updatedSeats);
    }
  });
});
