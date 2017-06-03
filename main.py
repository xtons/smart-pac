#!/usr/bin/env python3
import codecs
from chsip import chsip
from gfw2re import gfw2re
from string import Template

reProxy = gfw2re()
content = codecs.open('smart.template', 'r', 'utf-8').read()
tpl = Template( content )
dict = dict( bi=reProxy['black']['initial'], bd=reProxy['black']['domain'], ba=reProxy['black']['anywhere'], wi=reProxy['white']['initial'], wd=reProxy['white']['domain'], chsip=chsip() )
pac = tpl.substitute( dict )
print( pac )
