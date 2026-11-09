#!/usr/bin/env python3
"""Projection of actual retained 48 live fragment uploads, using exact ABI."""
import pathlib,json,lzma,struct,collections,math
root=pathlib.Path("preview/oracle-evidence")
rows=json.loads(lzma.decompress((root/"live_blur_dataflow.json.xz").read_bytes()))["cases"]
layout={o["name"]:o for line in (root/"uniform_field_layouts.jsonl").read_text().splitlines()
        if (o:=json.loads(line)).get("struct_name")=="GlassBackgroundUniforms"
           and o.get("byte_offset") is not None}
fields=["inner_refraction_amount","inner_refraction_inv_height","outer_refraction_amount",
  "outer_refraction_inv_height","refraction_threshold0","refraction_threshold1",
  "blur_radius","edge_bleed_blur_radius","edge_bleed_amount","edge_bleed_inv_height",
  "shadow_amount","shadow_inv_height","shadow_blur_radius","shadow_inv_radius",
  "shadow_contribution","shadow_face_opacity","blur_alpha0","blur_alpha1",
  "blur_alpha2","blur_alpha3","blur_dist0","blur_dist1","blur_dist2","blur_dist3",
  "edge_bleed_dist0","edge_bleed_dist1","edge_bleed_opacity","face_opacity",
  "shadow_dist_offset","shadow_opacity","refraction_opacity","holding_tone_opacity",
  "sdr_shadow_dist0","sdr_shadow_dist1","clamp_limit","preserve_hue",
  "sdr_white_value","x86_workaround","complex_refraction"]
def value(b,name):
 r=layout[name];i=48+r["byte_offset"];t=r["llvm_type"]
 if i+(2 if t=="half" else 4)>len(b):return None
 return struct.unpack_from("<e" if t=="half" else "<f",b,i)[0]
out=[]
for row in rows:
  hx=row.get("binding_prefix_hex") or row.get("binding_hex") or ""
  try:b=bytes.fromhex(hx)
  except:continue
  if len(b)<209:continue
  a={k:value(b,k) for k in fields}
  name=row.get("binding",{}).get("case") or row.get("case_id")
  out.append(dict(name=name,hexlen=len(hx)//2,mode=row.get("sdf_mode"),
                  fragment=row.get("binding",{}).get("fragment"),values=a))
print("GLASS_ABI_OFFSET",48,"SDF_ABI_LENGTH",48,flush=True)
print("RETAINED_UNIFORM_UPLOADS",len(rows),"FULLY_DECODED",len(out),flush=True)
families=collections.Counter(x.get("fragment") for x in out)
print("FRAGMENT_COUNTS",dict(families),flush=True)
for field in fields:
 counter=collections.Counter((str(x["values"].get(field)) for x in out))
 print("FIELD",field,"UNIQUE",len(counter),"TOP",counter.most_common(8),flush=True)
family_keys=["inner_refraction_amount","inner_refraction_inv_height",
  "outer_refraction_amount","outer_refraction_inv_height","refraction_threshold0",
  "refraction_threshold1","refraction_opacity","blur_alpha0","blur_alpha1",
  "blur_alpha2","blur_alpha3","blur_dist0","blur_dist1","blur_dist2","blur_dist3",
  "face_opacity","shadow_opacity","holding_tone_opacity","complex_refraction"]
joint=collections.Counter(tuple(str(x["values"][key]) for key in family_keys) for x in out)
print("JOINT_SIGNATURE_COUNT",len(joint),flush=True)
for sig,n in joint.most_common(12):
 print("JOINT",n,json.dumps(dict(zip(family_keys,sig)),separators=(",",":")),flush=True)
for sample in out[:12]:
 print("CASE",sample["name"],"mode",sample["mode"],
     "fragment",sample["fragment"],"bytes",sample["hexlen"],
     "SELECTED",json.dumps({k:sample["values"][k] for k in family_keys},
       separators=(",",":")),flush=True)
