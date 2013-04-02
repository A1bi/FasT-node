var https = require("https");

var apiHost = "127.0.0.1";

var railsApi = {
  get: function (resource, action, callback) {
    this.request(resource + "/" + action, "GET", function (data) {
      callback(data);
    });
  },
  
  request: function (path, method, callback) {
    var req = https.request({
      hostname: apiHost,
      method: method,
      path: "/api/" + path,
      rejectUnauthorized: false
      
    }, function (res) {
      var data = [];
      
      res.on("data", function (d) {
        data.push(d);
      });
      
      res.on("end", function () {
        try {
          callback(JSON.parse(data));
        } catch (error) {
          console.log(error);
          callback({});
        }
      });
    
    }).on("error", function (error) {
      console.log(error);
    
    }).end();
  }
};

module.exports = railsApi;