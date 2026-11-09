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
         and ins["source_line"]>225):
      continue
     print(ins["source_line"],ins["ir"][:320],flush=True)
