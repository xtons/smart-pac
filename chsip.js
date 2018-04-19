var http = require('http');
var fs = require('fs');

exports.chsip = function() {
  const apnicurl = "https://ftp.apnic.net/apnic/stats/apnic/delegated-apnic-latest";
  var file = fs.createWriteStream("file.jpg");  
  var request = http.get(apnicurl, function(response) {
    response.pipe(file);
  });
}

chsip();
