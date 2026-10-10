#!/usr/bin/env python3
"""Release: zählt die Version in sw.js, index.html und game.js gemeinsam hoch.
Aufruf: python3 release.py  (danach committen und pushen)"""
import re, io
sw=io.open('sw.js',encoding='utf-8').read()
cur=int(re.search(r"einhorn-v(\d+)",sw).group(1)); new=cur+1
sw=re.sub(r"einhorn-v\d+", f"einhorn-v{new}", sw)
idx=io.open('index.html',encoding='utf-8').read()
idx=re.sub(r'game\.js\?v=\d+', f'game.js?v={new}', idx)
g=io.open('game.js',encoding='utf-8').read()
g=re.sub(r"const VERSION='\d+';", f"const VERSION='{new}';", g)
for f,c in [('sw.js',sw),('index.html',idx),('game.js',g)]: io.open(f,'w',encoding='utf-8').write(c)
print('Version', cur, '->', new)
