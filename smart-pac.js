#!/usr/bin/env node

const fs = require("fs");
const ProgressBar = require('progress');
const https = require('https');
const readline = require('readline');
const ejs = require('ejs');
const base64 = require('base64-stream');

var smart = {
  "proxy": {
    "white": "DIRECT; SOCKS5 192.168.119.2:1080",
    "black": "SOCKS5 192.168.119.198:2; DIRECT",
    "gray": "DIRECT; SOCKS5 192.168.119.2:1080"
  },
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
      "plain": [],
      "regex": []
    }
  }
};

https.get(gfwlisturl).on('response', (res) => {
  if (res.statusCode === 200) {
    const reComment = /^(\[.*\]|[ \f\n\r\t\v]*|\!.*)$/;
    const reInitial = /^\|https?:\/\/[0-9a-zA-Z-_.*?&=%~/:]+$/;
    const rePureip = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    const reDomain = /^\|\|[0-9a-zA-Z-\.*]+\/?$/;
    const reRegex = /^\/.*\/$/;
    const reAnywhere = /^[0-9a-zA-Z-_.*?&=%~/:]+$/;
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
    }).on('line', (line) => {
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
        list.domain.push(line);
      else if (reRegex.test(line))
        list.anywhere.regex.push(line);
      else if (reAnywhere.test(line))
        list.anywhere.plain.push(line);
      else
        console.error('\nCan\'t understand %s.\n', line);
    });
    res.on('data', (chunk) => {
      bar.tick(chunk.length);
    });
    res.on('end', step2);
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
          const sect = [parseInt(result[2], 10) << 24 | parseInt(result[3], 10) << 16 | parseInt(result[4], 10) << 8 | parseInt(result[5], 10),
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
          console.log(err);
          process.exit(-3);
        }
        else
          ;// console.log(data);
      });
    });
  }).on('error', (err) => {
    console.log('\nGet apnic records failed!\n');
    console.log(err);
    process.exit(-2);
  });
}