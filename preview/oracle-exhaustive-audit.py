#!/usr/bin/env python3
"""Read-only, bounded source-grounded audit of the canonical Oracle witnesses.
All byte-identical source records are stored under preview/oracle-evidence and
are excluded from the Cloudflare preview packaging.
"""
import gzip,lzma,json,pathlib,struct,hashlib,collections
root=pathlib.Path("preview/oracle-evidence")
def unpack(file):
 p=root/file
 b=p.read_bytes()
 if file.endswith(".gz"):b=gzip.decompress(b)
 if file.endswith(".xz"):b=lzma.decompress(b)
 try:return json.loads(b)
 except:return b
def compact(o,n=6200):
 return json.dumps(o,separators=(",",":"),ensure_ascii=True)[:n]
print("=== FINITE SCALAR + PRIMITIVE ORACLES ===",flush=True)
for name in ["primitive_oracle.json.xz","direct_execution.json.xz",
  "family_proofs.json.xz","live_blur_dataflow.json.xz","live_cache_scale.json.xz",
  "live_surface_scale_joins.json.xz","P2_CPU_AIR_BRIDGE.json.xz",
  "AIR_PRIMITIVE_CONTRACT_AUDIT.json.xz"]:
 o=unpack(name)
 print("AUDIT",name,"type",type(o).__name__,flush=True)
 if isinstance(o,dict):
  print("KEYS",list(o),flush=True)
  for k,v in o.items():
   if isinstance(v,list):
    print("ARRAY",k,"length",len(v),
      "FIRST",compact(v[0],1100) if v else "-",flush=True)
   elif isinstance(v,dict):
    print("MAPPING",k,"keys",list(v)[:28],
      "EXAMPLE",compact(next(iter(v.values()),None),850),flush=True)
   else:
    print("VALUE",k,compact(v,900),flush=True)
  if name=="primitive_oracle.json.xz":
   print("PRIMITIVE_FULL",compact(o,15000),flush=True)
 elif isinstance(o,list):
  print("LIST",len(o),[compact(x,1000) for x in o[:5]],flush=True)

print("=== DIRECT UNIFORM FIELD VALUES + VARIANT DIFFS ===",flush=True)
print("GLASS_ABI_OFFSET",48,"SDF_ABI_LENGTH",48,"SOURCE_TOTAL_LENGTH",272,flush=True)
fields=[json.loads(s) for s in (root/"uniform_field_layouts.jsonl").read_text().splitlines()]
layout=[x for x in fields if x.get("struct_name")=="GlassBackgroundUniforms" and x.get("byte_offset") is not None]
uniforms={n:unpack(n) for n in [
  "base_uniform.bin","color_matrices_uniform.bin","holding_tone_uniform.bin",
  "clamp_limit_uniform.bin","shadow_face_opacity_uniform.bin"]}
def values(raw,entry):
 offset=48+entry["byte_offset"];kind=entry["llvm_type"]
 if kind=="float":return struct.unpack_from("<f",raw,offset)[0]
 if kind=="half":return struct.unpack_from("<e",raw,offset)[0]
 if kind=="<4 x half>":return list(struct.unpack_from("<4e",raw,offset))
 if kind=="<4 x float>":return list(struct.unpack_from("<4f",raw,offset))
 if kind=="<2 x float>":return list(struct.unpack_from("<2f",raw,offset))
 if kind=="<2 x half>":return list(struct.unpack_from("<2e",raw,offset))
 return None
for name,blob in uniforms.items():
 out=[(row["name"],row["index"],row["byte_offset"],values(blob,row)) for row in layout]
 print("UNIFORM",name, "bytes",len(blob),"VALUES",compact(out,17000),flush=True)
 if name!="base_uniform.bin":
  baseline=uniforms["base_uniform.bin"]
  changes=[(row["name"],row["index"],values(baseline,row),values(blob,row))
           for row in layout if values(baseline,row)!=values(blob,row)]
  print("UNIFORM_DELTA",name,compact(changes,15000),flush=True)

print("=== TARGET PROGRAM AIR BRANCHES & SUBROUTINES ===",flush=True)
for name in ["glass_background_sdf_no_bleed_lph.ssa.json.gz",
  "glass_background_sdf_lph.ssa.json.gz",
  "glass_background_lph.ssa.json.gz",
  "glass_background_no_bleed_lph.ssa.json.gz",
  "glass_foreground_lph.ssa.json.gz",
  "glass_foreground_sdf_lph.ssa.json.gz"]:
 d=unpack(name)
 print("PROGRAM",name,"counts",compact(d.get("counts")),"entry",d.get("entrypoint"),flush=True)
 for f in d["functions"]:
  blocks=f["blocks"];ops=[i["opcode"] for b in blocks for i in b["instructions"]]
  print("FUNC",f["name"],"ins",len(ops),"blocks",len(blocks),
     "ops",compact(collections.Counter(ops).most_common(10)),flush=True)
 if name!="glass_background_sdf_no_bleed_lph.ssa.json.gz":continue
 for f in d["functions"]:
  fname=f["name"]
  instructions=[i for b in f["blocks"] for i in b["instructions"]]
  if "supercircle_sdf" in fname:
   print("SUPER_CIRCLE_BEGIN",flush=True)
   for row in instructions: print("SUPER",row["source_line"],row["ir"][:330],flush=True)
   print("SUPER_CIRCLE_END",flush=True)
  if "glass_background_base" in fname:
   print("BASE_CHUNKS",flush=True)
   for row in instructions:
    if 418<=row["source_line"]<=702:
     print("BASE",row["source_line"],row["ir"][:290],flush=True)

print("=== DIRECT GPU OUTPUT WITNESS DIFFERENCES ===",flush=True)
def load_pixels(name):return unpack(name)
base=load_pixels("base_seed1.bin.xz")
print("DIRECT_BASE_BYTES",len(base),"SHA256",hashlib.sha256(base).hexdigest(),flush=True)
for name in ["color_matrices_seed1.bin.xz","holding_tone_seed1.bin.xz","clamp_limit_seed1.bin.xz"]:
 buf=load_pixels(name)
 changes=sum(x!=y for x,y in zip(base,buf))
 print("DIRECT_VARIANT",name,"bytes",len(buf),"hash",hashlib.sha256(buf).hexdigest(),
       "diff_bytes",changes, "firstchanged",
       next((i for i,(x,y) in enumerate(zip(base,buf)) if x!=y),None),flush=True)
