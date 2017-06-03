#!/usr/bin/env python3
import urllib.request as request
import re
import sys
import warnings
from base64 import b64decode

__all__ = ['gfw2re']

_gwlurl = 'https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt'

def gfw2re(filename=''):
  sites = {
    'white': {
      'initial': {
        'http': [],
        'https': []
        },
      'domain': []
    },
    'black': {
      'initial': {
        'http': [],
        'https': []
        },
      'domain': [],
      'anywhere': {
        'plain': [],
        'regexp': []
      }
    }
  }
  reProxy = {
    "white": {
      'initial': r'',
      'domain': r''
    },
    "black": {
      'initial': r'',
      'domain': r'',
      'anywhere': r''
    }
  }
  if filename=='':
    content = b64decode(request.urlopen(_gwlurl).read()).decode('utf-8')
  else:
    content = b64decode(open(filename).read()).decode('utf-8')
  reInitial = re.compile( "^\|https?://[0-9a-zA-Z-_.*?&=%~/:]+$" )
  reDomain = re.compile( "^\|\|[0-9a-zA-Z-.*]+/?$" ) # 在我看来有一些错误的用法导致在||跟着的域名后出现了/，这是没有必要的
  reAnywhere = re.compile( "^[0-9a-zA-Z-_.*?&=%~/:]+$" )
  reRegexp = re.compile( "/.*/" )
  reVersion = re.compile( "\[.*\]" )
  for line in content.splitlines():
    # 跳过注释、空行与开头的版本说明
    if line.startswith('!') or len(line)==0 or re.match(reVersion, line):
      continue
    # 区分黑名单与白名单
    if line.startswith('@@'):
      line = line[2:]
      list = sites['white']
    else:
      list = sites['black']
    # 识别每一行
    if re.match( reInitial, line ):
      if line.startswith('|http://'):
        list['initial']['http'].append(line[8:])
      elif line.startswith('|https://'):
        list['initial']['https'].append(line[9:])
    elif re.match( reDomain, line ):
      if line.endswith('/'):
        list['domain'].append(line[2:-1])
      else:
        list['domain'].append(line[2:])
    elif re.match(reAnywhere, line ):
      list['anywhere']['plain'].append(line)
    elif re.match(reRegexp, line):
      list['anywhere']['regexp'].append(line)
    else:
      warnings.warn( 'can\'t understand "{}".'.format(line) )
  
  if( len(sites['black']['initial']['https']) > 0 ):
    reTemp = '^http(://('+'|'.join(sites['black']['initial']['http'])+')|s://('+'|'.join(sites['black']['initial']['https'])+'))'
  else:
    reTemp = '^http://('+'|'.join(sites['black']['initial']['http'])+')'
  reProxy['black']['initial'] = reTemp.replace('/','\/').replace('.','\\.').replace('*','.*')
  reTemp = '|'.join(sites['black']['domain']).replace('.','\\.').replace('*','.*')
  reProxy['black']['domain'] = '^.*({})$'.format( reTemp )
  reTemp = '|'.join( sites['black']['anywhere']['plain'] ).replace('/','\/').replace('.','\\.').replace('*','.*').replace('?','\?') \
    + '|' + '|'.join( map( lambda x: x[1:-1], sites['black']['anywhere']['regexp']) )
  reProxy['black']['anywhere'] = reTemp
  if( len(sites['white']['initial']['https']) > 0 ):
    reTemp = '^http(://('+'|'.join(sites['white']['initial']['http'])+')|s://('+'|'.join(sites['white']['initial']['https'])+'))'
  else:
    reTemp = '^http://('+'|'.join(sites['white']['initial']['http'])+')'
  reProxy['white']['initial'] = reTemp.replace('/','\/').replace('.','\\.').replace('*','.*')
  reTemp = '|'.join(sites['white']['domain']).replace('.','\\.').replace('*','.*')
  reProxy['white']['domain'] = '^.*({})$'.format( reTemp )
  return reProxy;

def getUsage():
  return "Usage: {} [filename]\ngfw2re will download gfwlist.txt from {} if not specify a local file  .".format(sys.argv[0], _gwlurl)

def dumpRe(reProxy):
  print( 'var bi=/{}/;'.format( reProxy['black']['initial']) )
  print( 'var bd=/{}/;'.format( reProxy['black']['domain']) )
  print( 'var ba=/{}/;'.format( reProxy['black']['anywhere'] ) )
  print( 'var wi=/{}/;'.format( reProxy['white']['initial'] ) )
  print( 'var wd=/{}/;'.format( reProxy['white']['domain'] ) )
  
if __name__ == "__main__":
  eval({
    1:  'dumpRe(gfw2re())',
    2:  'dumpRe(gfw2re(sys.argv[1]))'
  }.get(len(sys.argv), 'getUsage()'))
