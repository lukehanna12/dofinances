#!/usr/bin/env python3
import gzip,json,pathlib
root=pathlib.Path('preview/oracle-evidence')
for f in sorted(root.glob('*.gz')):
 d=json.loads(gzip.decompress(f.read_bytes()))
 print("\n###",f.name,"top keys",list(d),"counts",d.get('counts'))
 for k,v in d.items():
  if isinstance(v,list):
   print(" LIST",k,len(v),"FIRST",json.dumps(v[0],ensure_ascii=True)[:1300] if v else "-")
  elif isinstance(v,dict):
   print(" DICT",k,list(v)[:35],"FIRST",json.dumps(next(iter(v.values()),None),ensure_ascii=True)[:1200])
  else: print(" SCALAR",k,repr(v)[:140])
 if f.name in ('glass_background_sdf_no_bleed_lph.ssa.json.gz','glass_background_lph.ssa.json.gz'):
  print(" STRUCTURE SAMPLE",json.dumps(d,ensure_ascii=True)[:12500])
