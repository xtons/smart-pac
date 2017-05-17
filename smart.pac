var white = "DIRECT; SOCKS5 192.168.119.198:8128";
var black = "SOCKS5 192.168.119.198:8128; DIRECT";
var gray = "DIRECT; SOCKS5 192.168.119.198:8128"
var detectResolve = true;

var proxyRe;
function initAll() {

}

function FindProxyForURL(url, host) {
  if( typeof(proxyRe)=="undefined" )
    initAll();
  return white;
}