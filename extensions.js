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
