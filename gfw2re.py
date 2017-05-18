#!/usr/bin/env python3
import urllib.request as request
import sys
from base64 import b64decode

__all__ = ['gfw2re']

_gwlurl = 'https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt'

def gfw2re(filename=''):
  sites = {
    'white': {
      'type1': [],
      'type2': [],
      'type3': []
    },
    'black': {
      'type1': [],
      'type2': [],
      'type3': []
    }
  }
  if filename=='':
    content = b64decode(request.urlopen(_gwlurl).read())
  else:
    content = b64decode(open(filename).read())
  for line in content.splitlines():
    print( line )
  return filename;

def getUsage():
  return "Usage: {} [filename]\ngfw2re will download gfwlist.txt from {} if not specify a local file  .".format(sys.argv[0], _gwlurl)
  
if __name__ == "__main__":
  print (eval({
    1:  'gfw2re()',
    2:  'gfw2re(sys.argv[1])'
  }.get(len(sys.argv), 'getUsage()')))
