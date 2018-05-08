#!/usr/bin/env node

const fs = require("fs");
const ProgressBar = require('progress');
const https = require('https');
const readline = require('readline');
const ejs = require('ejs');
const base64 = require('base64-stream');
const proxy = require('./proxy');

var smart = {
  "proxy": proxy,
  "regex": {
    "white": {
      "domain": null,
      "url": null
    },
    "black": {
      "pureip": null,
      "domain": null,
      "url": null
    }
  },
  "chsips": []
};

//const gfwlisturl = "https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt";
const gfwlisturl = "https://pagure.io/gfwlist/raw/master/f/gfwlist.txt";
const apnicurl = "https://ftp.apnic.net/apnic/stats/apnic/delegated-apnic-latest";

var gfwlist = {
  "white": {
    "initial": {
      "http": [],
      "https": []
    },
    "domain": []
  },
  "black": {
    "initial": {
      "http": [],
      "https": []
    },
    "pureip": [],
    "domain": [],
    "anywhere": {
      "domain": [],
      "plain": [],
      "regex": []
    }
  }
};

const reComment = /^(\[.*\]|[ \f\n\r\t\v]*|\!.*)$/;
const reInitial = /^\|https?:\/\/[0-9a-zA-Z-_.*?&=%~/:]+$/;
const rePureip = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const reDomain = /^\|\|[0-9a-zA-Z-.*]+\/?$/;  // 明确的domain中有可能包含*通配符
const reRegex = /^\/.*\/$/;
const reDomain2 = /^[0-9a-zA-Z-.]+$/;  // 经常有domain混在url模式中，此时*通配符通常与url相关
const reAnywhere = /^[0-9a-zA-Z-_.*?&=%~/:]+$/;
const reGroup = /\|/g;

const readRule = (line) => {
  // 跳过注释、空行与开头的版本说明
  if (reComment.test(line))
    return;
  // 区分黑名单与白名单
  var list;
  if (line.startsWith('@@')) {
    line = line.substring(2);
    list = gfwlist.white;
  }
  else
    list = gfwlist.black;
  if (reInitial.test(line)) {
    list = list.initial;
    if (line[5] == 's') {
      line = line.substring(9);
      list = list.https;
    }
    else {
      line = line.substring(8);
      list = list.http;
    }
    list.push(line);
  }
  else if (rePureip.test(line))
    list.pureip.push(line);
  else if (reDomain.test(line))
    list.domain.push(line.substring(2));
  else if (reRegex.test(line)) {
    if ( line.match(reGroup)!=null && line.match(reGroup).length > 20 )
      console.warn( '\n"%s" has been skiped for performance reason.\n', line );
    else
      list.anywhere.regex.push(line.substring(1, line.length - 1));
  }
  else if (reDomain2.test(line))
    list.anywhere.domain.push(line);
  else if (reAnywhere.test(line))
    list.anywhere.plain.push(line);
  else
    console.error('\nCan\'t understand %s.\n', line);
}

// 同步上有点小问题，但几乎不太可能网络比本地文件处理得快，懒得改了
readline.createInterface({
  input: fs.createReadStream('user.rule')
}).on('line', readRule);
https.get(gfwlisturl).on('response', (res) => {
  if (res.statusCode === 200) {
    const len = parseInt(res.headers['content-length'], 10);
    const bar = new ProgressBar('  Downloading GFW List      [:bar] :rate/bps :percent :etas', {
      complete: '=',
      incomplete: '-',
      width: 50,
      stream: process.stderr,
      total: len
    });
    readline.createInterface({
      input: res.pipe(base64.decode()),
      output: null
    }).on('line', readRule);
    res.on('data', (chunk) => {
      bar.tick(chunk.length);
    });
    res.on('end', () => {
      url2regex = (url) => {
        return url.replace(/\./g, '\\.').replace(/\?/g, '\\?').replace(/\*/g, '.*').replace(/\//g, '\\/').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      };
      smart.regex.black.url = ejs.render('^http(:\\/\\/(<%-http%>)|s\\:\\/\\/(<%-https%>))|<%-any%>|<%-regex%>', {
        "http": gfwlist.black.initial.http.map(url2regex).join('|'),
        "https": gfwlist.black.initial.http.map(url2regex).join('|'),
        "any": gfwlist.black.anywhere.plain.map(url2regex).join('|'),
        "regex": gfwlist.black.anywhere.regex.join('|')
      });
      smart.regex.black.domain = ejs.render('^(.*\\.)?(<%-domain%>|<%-domain2%>)$', {
        "domain": gfwlist.black.domain.map(domain => domain.replace(/\./g, '\\.').replace(/\*/g, '.*')).join('|'),
        "domain2": gfwlist.black.anywhere.domain.map(domain2 => domain2[0] == '.' ? domain2.substring(1).replace(/\*/g, '.*') : domain2.replace(/\*/g, '.*')).join('|')
      });
      smart.regex.black.pureip = ejs.render('^(<%-txt%>)$', { "txt": gfwlist.black.pureip.map(txt => txt.replace(/\./g, '\\.')).join('|') });
      smart.regex.white.url = ejs.render('^http(:\/\/(<%-http%>)|s:\/\/(<%-https%>))', {
        "http": gfwlist.white.initial.http.map(url2regex).join('|'),
        "https": gfwlist.white.initial.http.map(url2regex).join('|')
      });
      smart.regex.white.domain = ejs.render('^(.*\\.)?(<%-domain%>)$', {
        "domain": gfwlist.white.domain.map(domain => domain.replace(/\*/g, '.*')).join('|')
      });
      step2();
    });
  }
}).on('error', (err) => {
  console.error('\nGet GFW List failed!\n');
  console.error(err);
  process.exit(-1);
});

function step2() {
  https.get(apnicurl).on('response', (res) => {
    var len = parseInt(res.headers['content-length'], 10);
    var bar = new ProgressBar('  Downloading apnic records [:bar] :rate/bps :percent :etas', {
      complete: '=',
      incomplete: '-',
      width: 50,
      stream: process.stderr,
      total: len
    });
    const reVer = /^\d.*$/;
    const reCN = /^apnic\|CN\|ipv4\|((\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}))\|(\d+)\|\d{8}\|.*$/
    const rl = readline.createInterface({
      input: res,
      output: null
    }).on('line', (line) => {
      // 跳过注释、空行与开头的版本说明
      if (line.startsWith('#') || line.length == 0)
        return;
      if (reVer.exec(line))
        if (!line.startsWith('2|'))
          throw "found a unsupported version.";
      // 区分黑名单与白名单
      const result = reCN.exec(line)
      if (result) {
        with (smart) {
          const sect = [(parseInt(result[2], 10) << 16) * 256 + (parseInt(result[3], 10) << 16) + (parseInt(result[4], 10) << 8) + parseInt(result[5], 10),
          parseInt(result[6], 10)];
          if (chsips.length == 0) {
            chsips.push(sect);
          }
          else {
            const last = chsips[chsips.length - 1];
            if (last[0] + last[1] == sect[0])
              last[1] += sect[1];
            else
              chsips.push(sect);
          }
        }
      }
    });
    res.on('data', (chunk) => {
      bar.tick(chunk.length);
    });
    res.on('end', () => {
      ejs.renderFile(__dirname + '/smart.template', smart, (err, data) => {
        if (err) {
          console.error(err);
          process.exit(-3);
        }
        else
          console.log(data);
      });
    });
  }).on('error', (err) => {
    console.error('\nGet apnic records failed!\n');
    console.error(err);
    process.exit(-2);
  });
}
