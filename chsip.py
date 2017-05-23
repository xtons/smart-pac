#!/usr/bin/env python3
import urllib.request as request
import ipaddress
import re
import sys
import warnings
from base64 import b64decode

__all__ = ['chsip']

_apnicurl = 'http://ftp.apnic.net/apnic/stats/apnic/delegated-apnic-latest'

def chsip(filename=''):
  chsip = []
  if filename=='':
    content = request.urlopen(_apnicurl).read()
  else:
    content = open(filename).read()
  reVer = re.compile( "^\d.*$" )
  reCN = re.compile( "^apnic\|CN\|ipv4\|(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\|(\d+)\|\d{8}\|.*$" )
  for line in content.splitlines():
    # 跳过注释、空行与开头的版本说明
    if line.startswith('#') or len(line)==0:
      continue
    if re.match(reVer, line):
      if not line.startswith('2|'):
        Warning.warn( "found a unsupported version." )
    # 区分黑名单与白名单
    m = re.match(reCN, line)
    if m:
      begin = int(ipaddress.IPv4Address(m.group(1)))
      end = begin + int(m.group(2)) - 1
      chsip.append( [begin, end] ) 
  return chsip

def getUsage():
  return "Usage: {} [filename]\nchsip will download apnic file from {} if not specify a local file  .".format(sys.argv[0], _apnicurl)

def dumpIp(ip):
  print( 'var ips={};'.format(ip) )

if __name__ == "__main__":
  eval({
    1:  'dumpIp(chsip())',
    2:  'dumpIp(chsip(sys.argv[1]))'
  }.get(len(sys.argv), 'getUsage()'))
