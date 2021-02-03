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
  var Sentry = require('@sentry/node');
  Sentry.init({
    dsn: dsn
  });
}

var clients = {};

api.init(clients);

var io = socketio(api.server, {
  "path": "/node"
});

io.of("/seating")
  .use(function (socket, next)  {
    var restoreId = socket.handshake.query.restore_id;
    if (restoreId && !(restoreId in clients)) {
      next(new Error("Invalid socket id to restore"));
      return;
    }

    next();
  })

  .on("connection", function (socket) {
    var client;
    var restoreId = socket.handshake.query.restore_id;
    if (restoreId) {
      client = clients[restoreId];
      client.setSocket(socket);

    } else {
      client = new SeatingClient(
        socket,
        socket.handshake.query.event_id,
        socket.handshake.query.privileged === 'true'
      );

      client.on("destroyed", function () {
        client.removeAllListeners();
        delete clients[client.id];
      });

      clients[client.id] = client;
    }
  })
;
