#!/usr/bin/env node

const fs = require("fs");
const ProgressBar = require('progress');
const https = require('https');
const readline = require('readline');
const ejs = require('ejs');
const base64 = require('base64-stream');


const apnicurl = "https://ftp.apnic.net/apnic/stats/apnic/delegated-apnic-latest";
const gfwlisturl = "https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt";

var smart = {
  chsips: []
};

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
    }).on('line', (line) => {
      //console.log(line);
    });
    res.on('data', (chunk) => {
      bar.tick(chunk.length);
    })
  }
}).on('error', (err) => {
  console.log('\nGet GFW List failed!\n');
  console.log(err);
});

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
      console.log(err || data);
    });
  });
}).on('error', (err) => {
  console.log('\nGet apnic records failed!\n');
  console.log(err);
});
