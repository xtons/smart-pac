#!/usr/bin/env python3
import urllib.request as request
import sys
from base64 import b64decode

__all__ = ['gfw2re']

_gwlurl = 'https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt'

def gfw2re(filename=''):
  a = []
  def deal(line):
    a.append(line)
  if filename=='':
    for line in request.urlopen(gwlurl):
      print( line )
  else:
    for line in open(filename):
      print( line )
  return filename;

def getUsage():
  return "Usage: {} [filename]\ngfw2re will download gfwlist.txt from {} if not specify a local file  .".format(sys.argv[0], _gwlurl)
  
if __name__ == "__main__":
  print (eval({
    1:  'gfw2re()',
    2:  'gfw2re(sys.argv[-1])'
  }.get(len(sys.argv), 'getUsage()')))
