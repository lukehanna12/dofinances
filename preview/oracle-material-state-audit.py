#!/usr/bin/env python3
"""Derive coherent finite material states and SDF-driven LOD from AIR."""
import json,lzma,struct,pathlib,math
root=pathlib.Path("preview/oracle-evidence")
obj=json.loads(lzma.decompress((root/"live_blur_dataflow.json.xz").read_bytes()))
cases=obj["cases"]
mapping={r["name"]:r for line in (root/"uniform_field_layouts.jsonl").read_text().splitlines()
          if (r:=json.loads(line)).get("struct_name")=="GlassBackgroundUniforms"
             and r.get("byte_offset") is not None}
def field(b,name):
 r=mapping[name];offset=48+r["byte_offset"];t=r["llvm_type"]
 if t=="float":return struct.unpack_from("<f",b,offset)[0]
 if t=="half":return struct.unpack_from("<e",b,offset)[0]
 if t=="<4 x half>":return list(struct.unpack_from("<4e",b,offset))
 if t=="<4 x float>":return list(struct.unpack_from("<4f",b,offset))
 if t=="<2 x float>":return list(struct.unpack_from("<2f",b,offset))
 if t=="<2 x half>":return list(struct.unpack_from("<2e",b,offset))
 return None
selected=["displacement_mat","inner_refraction_amount","inner_refraction_inv_height",
  "outer_refraction_amount","outer_refraction_inv_height","refraction_threshold0",
  "refraction_threshold1","blur_radius","edge_bleed_blur_radius","edge_bleed_amount",
  "edge_bleed_inv_height","shadow_amount","shadow_inv_height","shadow_offset",
  "shadow_blur_radius","shadow_inv_radius","face_cm0","face_cm1","face_cm2",
  "bleed_cm0","bleed_cm1","bleed_cm2","shadow_cm0","shadow_cm1","shadow_cm2",
  "shadow_contribution","shadow_face_opacity","blur_alpha0","blur_alpha1",
  "blur_alpha2","blur_alpha3","blur_dist0","blur_dist1","blur_dist2","blur_dist3",
  "edge_bleed_dist0","edge_bleed_dist1","edge_bleed_opacity","face_opacity",
  "bleed_darken","shadow_dist_offset","shadow_opacity","refraction_opacity",
  "holding_tone_opacity","sdr_shadow_dist0","sdr_shadow_dist1","clamp_limit",
  "preserve_hue","sdr_white_value","x86_workaround","complex_refraction"]
for group in ["diagnostic_m0_b4.75_z1.0","diagnostic_m1_b4.75_z1.0"]:
 c=next(x for x in cases if x["binding"]["case"]==group)
 b=bytes.fromhex(c["binding_prefix_hex"])
 d={k:field(b,k) for k in selected}
 print("CANONICAL_COHERENT_STATE",group,"binding_length",len(b),"fragment",c["binding"]["fragment"],flush=True)
 print("STATE",json.dumps(d,separators=(",",":"),allow_nan=True),flush=True)
 print("SDF_FIRST48",list(struct.unpack_from("<12f",b,0)),flush=True)
 print("SELECTED_BINDING_SOURCE",c["binding"],flush=True)
 # AIR base function source 290–321: alpha0-sum(alpha1..3*sat((d-dist_i)/(dist_i+1-dist_i)))
 for dist in [-60,-45,-28,-20,-14,-7,-2,-1,-.5,-.001,0,.001]:
  alpha=[d["blur_alpha"+str(i)] for i in range(4)]
  td=[d["blur_dist"+str(i)] for i in range(4)]
  acc=alpha[0]
  for i in range(3):
   difference=td[i+1]-td[i]
   if difference==0:
    x=0 if dist<td[i] else 1 if dist>td[i] else 0
   else:x=min(1,max(0,(dist-td[i])/difference))
   acc-=alpha[i+1]*x
  print("BLUR_LOD_CONTROL",group,dist,round(acc,7),flush=True)
