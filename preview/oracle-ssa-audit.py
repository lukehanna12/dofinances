#!/usr/bin/env python3
import gzip,json,pathlib,collections
root=pathlib.Path("preview/oracle-evidence")
for name in ["glass_background_sdf_no_bleed_lph","glass_background_lph"]:
 file=root/(name+".ssa.json.gz")
 d=json.loads(gzip.decompress(file.read_bytes()))
 print("\n##",name, d["counts"],flush=True)
 for fn in d["functions"]:
  blocks=fn["blocks"]
  ins=[x for b in blocks for x in b["instructions"]]
  print("FUNCTION",fn["name"][:140],"blocks",len(blocks),"instr",len(ins),
        "ops",dict(collections.Counter(i["opcode"] for i in ins)),flush=True)
 for fn in d["functions"]:
  fname=fn["name"]
  blocks=fn["blocks"]
  if (("sdf" in fname.lower() and fname!=d["entrypoint"]) or
      ("base" in fname.lower() and fname!=d["entrypoint"])):
   print("\n-- FUNCTION",fname[:120],flush=True)
   for block in blocks:
    instructions=block["instructions"]
    print("BLOCK",block["label"],"count",len(instructions),flush=True)
    for ins in instructions:
     if ("base" in fname.lower() and not "sdf" in fname.lower()
         and (ins["source_line"]<225 or ins["source_line"]>650)):
      continue
     print(ins["source_line"],ins["ir"][:320],flush=True)

import lzma,struct
for name in ["live_mode_joins.json.xz","mode4_exact_joins.json.xz"]:
 f=root/name
 d=json.loads(lzma.decompress(f.read_bytes()))
 print("SDF_DATA",name,"keys",list(d),flush=True)
 print("SDF_JSON_PREFIX",json.dumps(d,ensure_ascii=True)[:11500],flush=True)
f=root/"color_matrices_uniform.bin"
if f.exists():
 b=f.read_bytes()
 print("DIRECT_SDF_UNIFORM",len(b),list(struct.unpack("<12f",b[:48])),flush=True)
 print("DIRECT_BLUR_WORD",struct.unpack("<f",b[88:92])[0],flush=True)
