#!/usr/bin/env python3
"""Reproducible complete-repository inventory and proof-boundary audit.

This exhausts the *retained file set* at a pinned oracle commit, not an
unbounded Apple native state space. It deliberately DOES NOT turn finite
proofs into universal claims. No screenshot or visual comparison used.
Usage:
  python3 studio/dashboard-preview/audit-oracle-evidence.py \
      /path/to/liquid-plexiglass-oracle \
      /path/to/dofinances [--run-tests]
"""
from __future__ import annotations
import argparse
import gzip
import hashlib
import json
import lzma
import subprocess
import sys
from collections import Counter
from pathlib import Path

ORACLE_HEAD = "3fd32ed3be300560552dd4577907affef7a09737"
TRACKED_COUNT = 331
PINNED_PATH_HASH = "29aeeb1fa3dd4285550009a5b8ec838a464e1e73977eccf9ea9fa22ac7ce0937"

def get_json(root: Path, rel: str):
    b = (root / rel).read_bytes()
    if rel.endswith(".gz"):
        b = gzip.decompress(b)
    elif rel.endswith(".xz"):
        b = lzma.decompress(b)
    return json.loads(b)

def classify(p: str) -> str:
    if p.startswith(("model/foundation/canonical_evidence/records/",
                     "model/foundation/canonical_evidence/MANIFEST.json")):
        return "canonical-machine-contract"
    if p.startswith("model/primary_evidence/"):
        return "retained-primary"
    if p.startswith("model/derived_evidence/"):
        return "retained-derived"
    if p.startswith("model/foundation/model/"):
        return "finite-model"
    if p.startswith("model/probes/"):
        return "target-reproducer"
    if p.startswith(("model/test_","model/foundation/scripts/",
                     "model/foundation/canonical_evidence/scripts/")):
        return "proof-regression"
    if p.startswith(("model/",".github/")) or p.endswith(".md") or p=="AGENTS.md":
        return "governance-or-model-code"
    raise ValueError("Unclassified canonical file: "+p)

def audit(oracle: Path, preview: Path, run_tests: bool):
    head=subprocess.check_output(["git","-C",str(oracle),"rev-parse","HEAD"],text=True).strip()
    assert head==ORACLE_HEAD,(head,ORACLE_HEAD)
    tracked=subprocess.check_output(["git","-C",str(oracle),"ls-files","-z"]).decode().split("\0")[:-1]
    assert len(tracked)==TRACKED_COUNT,len(tracked)
    count=Counter()
    hashes=[]
    structured=0
    compressed=0
    raw_binary=0
    files_visited=0
    for rel in tracked:
        b=(oracle/rel).read_bytes()
        files_visited+=1
        hashes.append(rel+" "+hashlib.sha256(b).hexdigest())
        count[classify(rel)]+=1
        if rel.endswith((".json",".json.gz",".json.xz")):
            get_json(oracle,rel)
            structured+=1
        elif rel.endswith((".gz",".xz")):
            d=gzip.decompress(b) if rel.endswith(".gz") else lzma.decompress(b)
            assert len(d)>0,(rel,"empty compressed payload")
            compressed+=1
        elif rel.endswith((".bin",".air",".metallib")):
            assert len(b)>0,(rel,"empty retained binary")
            raw_binary+=1
    digest=hashlib.sha256("\n".join(hashes).encode()).hexdigest()
    assert digest==PINNED_PATH_HASH,(digest,PINNED_PATH_HASH)

    manifest=get_json(oracle,"model/foundation/canonical_evidence/MANIFEST.json")
    originals=manifest["originals"]
    for basename,entry in originals.items():
        p=oracle/"model/foundation/canonical_evidence/records"/basename
        b=p.read_bytes()
        assert len(b)==entry["size_bytes"],(basename,"size")
        assert hashlib.sha256(b).hexdigest()==entry["sha256"],(basename,"sha256")

    ssa_dir=oracle/"model/foundation/canonical_evidence/records"
    air_files=list(sorted(ssa_dir.glob("*.ssa.json.gz")))
    assert len(air_files)==12,len(air_files)
    air_instructions=0
    for p in air_files:
        o=get_json(oracle,str(p.relative_to(oracle)))
        air_instructions+=sum(len(b["instructions"]) for fn in o["functions"]
                              for b in fn["blocks"])
    assert air_instructions==7432,air_instructions

    native=get_json(oracle,"model/primary_evidence/target_gpu/current_native_identity_bridge.json")
    assert len(native["records"])==11
    for r in native["records"]:
        b=lzma.decompress((oracle/r["retained_object_path"]).read_bytes())
        assert hashlib.sha256(b).hexdigest()==r["retained_object_sha256"]
        data=b[r["text_offset"]:r["text_offset"]+r["text_size"]]
        assert hashlib.sha256(data).hexdigest()==r["text_sha256"]

    structure=get_json(oracle,"model/primary_evidence/sdf_bridge/status.json")
    assert structure["status"]=="CLOSED"
    assert structure["exact_join_count"]==108
    assert structure["directly_joined_modes"]==[4,5]
    v5=get_json(oracle,"model/primary_evidence/v5_reconciliation.json")
    status=get_json(oracle,"model/STATUS.json")
    frontier=get_json(oracle,"model/RETAINED_EVIDENCE_FRONTIER.json")
    proof=get_json(oracle,"model/OPEN_PROOFS.json")
    open_ids=sorted(o["id"] for o in proof["obligations"] if o["status"]=="OPEN")
    assert open_ids==sorted(["LG-SR-NATIVE","LG-Q-NUMERICAL","LG-P-SCALARS"])
    assert frontier["global_result"]["closed_obligation_count"]==3
    assert frontier["global_result"]["open_obligation_count"]==3
    assert not frontier["global_result"]["renderer_pixel_equivalence_proven"]

    mip=get_json(oracle,"model/derived_evidence/public_native_mipmap_transition_matrix.json")
    assert mip["all_case_count"]==80
    assert mip["all_exact_264byte_copy_bind_pairs"]==240
    numerical=get_json(oracle,"model/foundation/canonical_evidence/records/R_tau_NUMERICAL_PRIMITIVE_CONTRACT_v2.json")
    sampling=numerical["texture_software_formula_tests"]
    assert len(sampling)==8
    nearest=[x for x in sampling if not x["linear"]]
    linear=[x for x in sampling if x["linear"]]
    assert len(nearest)==4 and all(x["word_mismatches"]==0 for x in nearest)
    assert len(linear)==4 and all(x["word_mismatches"]>0 for x in linear)
    selector=get_json(oracle,"model/primary_evidence/selector/precision_selector_static.json")
    assert selector["scope"].startswith("Exact target-locked selector closure")
    net=get_json(oracle,"model/primary_evidence/target_gpu/native_stage_status.json")
    assert net["candidate_full_text_partition_retained_classes"]==11
    assert not net["candidate_semantics_hardware_validation_scope_complete"]

    shader=(preview/"studio/dashboard-preview/gpu-glass.wgsl").read_text()
    renderer=(preview/"studio/dashboard-preview/gpu-renderer.js").read_text()
    mip_shader=(preview/"studio/dashboard-preview/gpu-mipmap.wgsl").read_text()
    requirements={
        "SDF native mode4": "fn mode4SDF(" in shader,
        "SDF native mode5": "fn mode5SDF(" in shader,
        "CPU mode predicate": "selectModeForNormalizedCorners" in renderer,
        "Native Float16 boundary": "fn nativeHalf3" in shader and "shader-f16" in renderer,
        "Native LOD expression": "fn glassLOD(" in shader,
        "Actual mip textures": "mipLevelCount:" in renderer and "textureStore(dst" in mip_shader,
        "Explicit sampling": "fn levelBilinear(" in shader and "fn mipSample(" in shader,
        "No DOM scene screenshots": all(s not in renderer for s in (
            "getImageData(", "drawImage(", "html2canvas")),
        "No mistaken native mip-kernel claim": "GAP R-MIP-KERNEL" in mip_shader,
        "No mistaken final color claim": "GAP PUBLIC-CLEAR-COLOR/OUTPUT Q" in shader,
    }
    if not all(requirements.values()):
        raise AssertionError("Missing preview evidence boundary: "+str(requirements))

    if run_tests:
        cmds=[
          ["python3","model/foundation/model/evidence_runtime.py","verify"],
          ["python3","model/foundation/canonical_evidence/scripts/test_model_core.py"],
          ["python3","-m","unittest","discover","-s","model","-p","test_*.py"]
        ]
        for command in cmds:
            p=subprocess.run(command,cwd=oracle,capture_output=True,text=True)
            assert p.returncode==0,(command,p.stderr[-1200:])
            if "unittest" in command:
                assert "Ran 308 tests" in p.stderr and "OK" in p.stderr
    return {
        "oracle_commit":head,"tracked_files_read":files_visited,
        "all_file_sha256_manifest_digest":digest,
        "structured_json_decoded":structured,
        "other_compressed_payloads_decoded":compressed,
        "raw_binary_files_verified":raw_binary,
        "files_by_role":dict(count),
        "canonical_originals_hash_verified":len(originals),
        "exact_air_graphs":len(air_files),
        "exact_air_instructions":air_instructions,
        "verified_native_body_identity_classes":len(native["records"]),
        "closed_sdf_same_event_joins":structure["exact_join_count"],
        "public_mipmap_finite_cases":mip["all_case_count"],
        "public_exact_metal_argument_pairs":mip["all_exact_264byte_copy_bind_pairs"],
        "native_texture_software_mismatching_linear_configs":len(linear),
        "preview_cross_stage_checks":requirements,
        "global_proof_flags_open":open_ids,
        "global_renderer_pixel_equivalence_proven":False,
        "oracle_tests_replayed":run_tests
    }

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("oracle",type=Path)
    ap.add_argument("dofinances",type=Path)
    ap.add_argument("--run-tests",action="store_true")
    args=ap.parse_args()
    print(json.dumps(audit(args.oracle,args.dofinances,args.run_tests),indent=2,sort_keys=True))
