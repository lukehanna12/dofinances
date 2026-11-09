#!/usr/bin/env python3
"""Read-only target AIR blur sampling trace; never equate browser Gaussian with native mip."""
import gzip, json, math, pathlib, struct

root = pathlib.Path("preview/oracle-evidence")
artifact = root / "glass_background_sdf_no_bleed_lph.ssa.json.gz"
data = json.loads(gzip.decompress(artifact.read_bytes()))
matches = []
log2 = []
for func in data["functions"]:
    if "glass_background_base" not in func["name"]:
        continue
    for block in func["blocks"]:
        for inst in block["instructions"]:
            ir = inst["ir"]
            line = int(inst["source_line"])
            if "@air.sample_texture_2d." in ir:
                matches.append(dict(source_line=line, sampler_static_six="@__air_sampler_state.6" in ir))
            if "@air.log2.f16" in ir:
                log2.append(line)

assert len(matches) >= 3, "Three target AIR texture samples expected"
assert all(m["sampler_static_six"] for m in matches), "Unexpected unreviewed sampler state"
assert len(log2) >= 3, "Expected target mip LOD logarithms"
print("AIR_NATIVE_MIP_SAMPLE_SUMMARY", json.dumps({
    "samples":matches,"log2_source_lines":log2,
    "sampler_descriptor_retained":False
}, separators=(",",":")), flush=True)

def f32(v):
    return struct.unpack("<f",struct.pack("<f",v))[0]
def source_lod(word, distribution):
    t=f32(f32(word)*f32(distribution))
    sample=f32(f32(.5*t)+1) if t<2 else t
    return max(0,math.log2(sample))

# Native sampled mip level follows a NONLINEAR logarithmic function.
# A browser interpolant that uses raw distribution instead of an explicitly
# established native mip filter is an approximation, not an AIR reconstruction.
for word in (f32(f32(4)*f32(.4)),f32(f32(2+((74-48)/112)*2)*f32(.4))):
    lower=source_lod(word,.5)
    upper=source_lod(word,1)
    samples=[]
    for distribution in (.5,.625,.75,.875,1):
        lod=source_lod(word,distribution)
        normal=(lod-lower)/(upper-lower) if upper>lower else 0
        linear=2*distribution-1
        samples.append({"distribution":distribution,"lod":round(lod,9),
                        "lod_fraction":round(normal,9),
                        "browser_linear_fraction":round(linear,9),
                        "fraction_delta":round(normal-linear,9)})
    print("AIR_MIP_VS_BROWSER_GAUSSIAN_INTERPOLATION",json.dumps({
        "finite_word":word,"samples":samples},separators=(",",":")),flush=True)
print("BLUR_FIDELITY_BOUNDARY",
      "Native source LOD and sampler identity identified; exact texture mip generation,"
      " filter mode and browser DOM backdrop mip equivalence are not established.",flush=True)
