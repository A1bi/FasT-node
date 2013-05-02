var fs = require("fs"),
    Server = require("net").Server;

Array.prototype.getObjectWithId = function (id) {
  var obj = null;
  this.forEach(function (object) {
    if (object['id'] == id) {
      obj = object;
      return;
    }
  });
  return obj;
};

Server.prototype.listenToSocket = function (sockPath) {
  if (fs.existsSync(sockPath)) fs.unlinkSync(sockPath);
  this.listen(sockPath);
  fs.chmod(sockPath, "0777");
  return this;
};