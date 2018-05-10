// 对于Windows 10用户，可以使用此脚本提供基于http协议的pac配置

const http = require('http');
const fs = require('fs');
const pacfile = 'smart.pac';

http.createServer(function(request, response) {
  fs.exists(pacfile,function(exists){
    if( exists && fs.statSync(pacfile).isFile() ) {
      fs.readFile(pacfile, "binary", function(err, file) {
        if(err) {        
          response.writeHead(500, {"Content-Type": "text/plain"});
          response.write(err + "\n");
          response.end();
        }
        else {
          response.writeHead(200, {"Content-Type": "application/x-ns-proxy-autoconfig"});
          response.write(file, "binary");
          response.end();
        }
      });
    }
    else {
      response.writeHead(404, {"Content-Type": "text/plain"});
      response.write("File smart.pac not found\n");
      response.end();
    }
  });
}).listen(80,'127.0.0.1');

console.log( "Set PAC address to 'http://localhost/smart.pac'." );