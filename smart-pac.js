#!/usr/bin/env node

'use strict'

const commander = require("commander");
const Agent = require("proxy-agent");
const fs = require("fs");
const Multiprogress = require('multi-progress');
const url = require('url');
const https = require('https');
const readline = require('readline');
const base64 = require('base64-stream');

const gfwlisturl = "https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt";
const apnicurl = "https://ftp.apnic.net/apnic/stats/apnic/delegated-apnic-latest";

let smart = {
  "proxy": require('./proxy'),
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

let gfwlist = {
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

commander
  .version('2.0.0')
  .description(`An automatic program to make Proxy-AutoConfig file.
    You need modify proxy.js and user.rule for custumization.

  Sample: node smart-pac.js > smart.pac` )
  .option('-s, --silent', 'without prompt')
  .option('-d, --direct', 'download gfwlist and apnic directly')
  .parse(process.argv);

function renderTemplate() {
  let { proxy, regex, chsips } = smart;
  readline.createInterface({
    input: fs.createReadStream('smart.template')
  }).on('line', (line) => console.log(eval("`" + line + "`")));
}

const mp = new Multiprogress(process.stderr);
let done = 0;

// 不明原因，globalAgent在https中未生效
// if( !commander.direct )
//   https.globalAgent = new Agent( smart.proxy.black
//     .split(';')[0].split(' ').join('://').toLowerCase()
//     .replace('socks5://','socks5h://'));

let apnicTarget = url.parse(apnicurl);
if (!commander.direct)
  apnicTarget.agent = new Agent("socks5h://192.168.119.2:1080");
https.get(apnicTarget)
  .on('response', (res) => {
    if (!commander.silent) {
      const bar = mp.newBar('  Downloading apnic records [:bar] :rate/bps :percent :etas', {
        complete: '=',
        incomplete: '-',
        width: 50,
        total: parseInt(res.headers['content-length'], 10)
      });
      res.on('data', (chunk) => bar.tick(chunk.length));
      res.on('end', () => {
        done++;
        if (done == 3)
          renderTemplate();
      });
    }
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
        const sect = [(parseInt(result[2], 10) << 16) * 256 + (parseInt(result[3], 10) << 16) + (parseInt(result[4], 10) << 8) + parseInt(result[5], 10),
        parseInt(result[6], 10)];
        if (smart.chsips.length == 0) {
          smart.chsips.push(sect);
        }
        else {
          const last = smart.chsips[smart.chsips.length - 1];
          if (last[0] + last[1] == sect[0])
            last[1] += sect[1];
          else
            smart.chsips.push(sect);
        }
      }
    });
  }).on('error', (err) => {
    console.error('\nGet apnic records failed!\n');
    console.error(err);
    process.exit(-1);
  });

const readRule = (line) => {
  // 跳过注释、空行与开头的版本说明
  if (reComment.test(line))
    return;
  // 区分黑名单与白名单
  let list;
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
    // if (line.match(reGroup) != null && line.match(reGroup).length > 20)
    //   console.warn('\n"%s" has been skiped for performance reason.\n', line);
    if (line.match(reGroup) != null && line.match(reGroup).length < 20)
      list.anywhere.regex.push(line.substring(1, line.length - 1));
  }
  else if (reDomain2.test(line))
    list.anywhere.domain.push(line);
  else if (reAnywhere.test(line))
    list.anywhere.plain.push(line);
  else
    console.error('\nCan\'t understand %s.\n', line);
}

let gfwTarget = url.parse(gfwlisturl);
if (!commander.direct)
  gfwTarget.agent = new Agent("socks5h://192.168.119.2:1080");
https.get(gfwTarget, (res) => {
  if (res.statusCode === 200) {
    const len = parseInt(res.headers['content-length'], 10);
    const bar = mp.newBar('  Downloading GFW List      [:bar] :rate/bps :percent :etas', {
      complete: '=',
      incomplete: '-',
      width: 50,
      total: len
    });
    res.on('data', (chunk) => bar.tick(chunk.length));
    res.on('end', () => { // after line event
      // plain to regex 需要处理： . $ ^ { [ ( | ) * + ? |
      // RFC3986 保留字符： !	*	'	(	)	;	:	@	&	=	+	$	,	/	?	#	[	]
      // RFC3986 除字母与数字之外的非保留字符： - _ . ~
      // 需要处理转义的字符： . $ [ ( | ) * + ?
      // 实践中遇到的 * 基本都是在当通配符用，所以……
      const plain2regex = (url) => {
        return url
          .replace(/\./g, '\\.')
          .replace(/\$/g, '\\$')
          .replace(/\[/g, '\\[')
          .replace(/\(/g, '\\(')
          .replace(/\|/g, '\\|')
          .replace(/\)/g, '\\)')
          .replace(/\]/g, '\\]')
          .replace(/\+/g, '\\+')
          .replace(/\?/g, '\\?')
          .replace(/\*/g, '\\.*');
      };
      let regArray = [];  // ready for smart.regex.black.url
      if (gfwlist.black.initial.http.length > 0 || gfwlist.black.initial.https.length > 0) {
        if (gfwlist.black.initial.http.length)
          regArray.push(`://(${gfwlist.black.initial.http.map(plain2regex).join('|')})`);
        if (gfwlist.black.initial.https.length)
          regArray.push(`s://(${gfwlist.black.initial.https.map(plain2regex).join('|')})`);
        regArray = [`http(${regArray.join('|')})`];
      }
      if (gfwlist.black.anywhere.plain.length)
        regArray.push(gfwlist.black.anywhere.plain.map(plain2regex).join('|'));
      if (gfwlist.black.anywhere.regex.length)
        regArray.push(gfwlist.black.anywhere.regex.join('|'));
      if (regArray.length)
        smart.regex.black.url = regArray.join('|');

      regArray = [];  // ready for smart.regex.black.domain
      if (gfwlist.black.domain.length)
        regArray.push(gfwlist.black.domain.map(domain => domain.replace(/\./g, '\\.').replace(/\*/g, '.*')).join('|'));
      if (gfwlist.black.anywhere.domain.length)
        regArray.push(gfwlist.black.anywhere.domain.map( domain2 => 
          ( domain2[0] == '.' ? domain2.substring(1) : domain2 ).replace(/\./g, '\\.').replace(/\*/g, '.*')).join('|'));
      if (regArray.length)
        smart.regex.black.domain = `^(.+\\.)?(${regArray.join('|')})$`;

      if (gfwlist.black.pureip.length)
        smart.regex.black.pureip = `^(${gfwlist.black.pureip.map(txt => txt.replace(/\./g, '\\.')).join('|')})$`;

      regArray = [];  // ready for smart.regex.white.url
      if (gfwlist.white.initial.http.length)
        regArray.push(`://(${gfwlist.white.initial.http.map(plain2regex).join('|')})`);
      if (gfwlist.white.initial.https.length)
        regArray.push(`s://(${gfwlist.white.initial.https.map(plain2regex).join('|')})`);
      if (regArray.length)
        smart.regex.white.url = `^http(${regArray.join('|')})`;

      if (gfwlist.white.domain.length)
        smart.regex.white.domain = `^(.+\\.)?(${gfwlist.white.domain.map(domain => domain.replace(/\./g, '\\.').replace(/\*/g, '.*')).join('|')})$`;

      done++;
      if (done == 3)
        renderTemplate();
    });
    readline.createInterface({
      input: res.pipe(base64.decode()),
      output: null
    }).on('line', readRule);
  }
})
  .on('error', (err) => {
    console.error('\nGet GFW List failed!\n');
    console.error(err);
    process.exit(-2);
  });

readline.createInterface({
  input: fs.createReadStream('user.rule')
    .on('end', () => {
      done++;
      if (done == 3)
        renderTemplate();
    })
}).on('line', readRule);
