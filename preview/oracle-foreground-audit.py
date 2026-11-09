#!/usr/bin/env python3
"""Read-only AIR foreground family audit with exact instruction lineage.
The foreground pass is distinct from the 264-byte background LPH bindings.
Only implement its effects when actual foreground uniform values are retained.
"""
import pathlib,json,gzip,collections
root=pathlib.Path("preview/oracle-evidence")
for name in ["glass_foreground_lph.ssa.json.gz","glass_foreground_sdf_lph.ssa.json.gz"]:
 d=json.loads(gzip.decompress((root/name).read_bytes()))
 print("FOREGROUND_GRAPH",name,d["counts"],flush=True)
 for fn in d["functions"]:
  rows=[x for b in fn["blocks"] for x in b["instructions"]]
  if not ("glass_foreground_base" in fn["name"] or fn["name"]==d["entrypoint"]):
   continue
  print("FOREGROUND_FUNCTION",fn["name"],"instructions",len(rows),"blocks",len(fn["blocks"]),flush=True)
  if "glass_foreground_base" not in fn["name"]:continue
  for row in rows:
   ir=row["ir"]
   print("FORE",row["source_line"],ir[:350],flush=True)
data=[json.loads(x) for x in (root/"uniform_field_layouts.jsonl").read_text().splitlines()]
fore=[x for x in data if x.get("struct_name")=="GlassForegroundUniforms.32"]
print("FOREGROUND_ABI",json.dumps([{"name":x["name"],"index":x["index"],
  "offset":x["byte_offset"],"type":x["llvm_type"]} for x in fore]),flush=True)
