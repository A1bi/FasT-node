var https = require("https");

var apiHost = "127.0.0.1";

var railsApi = {
  get: function (resource, action, callback) {
    this.requestOnResource(resource, action, "GET", null, callback);
  },
  
  post: function (resource, action, data, callback) {
    this.requestOnResource(resource, action, "POST", data, callback);
  },
  
  requestOnResource: function (resource, action, method, data, callback) {
    this.request(resource + ((action) ? "/" + action : ""), method, data, function (data) {
      callback(data);
    });
  },
  
  request: function (path, method, data, callback) {
    var body = JSON.stringify(data || {});
    
    var req = https.request({
      hostname: apiHost,
      method: method,
      path: "/api/" + path,
      rejectUnauthorized: false,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": body.length
      }
      
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
    });
    
    req.write(body);
    
    req.end();
  }
};

module.exports = railsApi;
