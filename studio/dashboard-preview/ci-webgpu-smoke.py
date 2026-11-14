#!/usr/bin/env python3
"""Real-time Chrome DevTools Protocol WebGPU smoke test (no screenshots).

Unlike chrome --dump-dom --virtual-time-budget, this waits in REAL wall-clock
time for requestDevice(), shader compilation and GPU queue completion. The
loop is CI-only; no polling is installed on the Dashboard or in production.
"""
from __future__ import annotations
import json
import os
import signal
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen
import websocket

CHROME=os.environ["CHROME"]
PAGE="http://127.0.0.1:8765/?webgpu-offscreen-ci=1"
PORT=9222
TIMEOUT=95

def cdp_eval(ws, counter, expression):
    counter[0]+=1
    tag=counter[0]
    ws.send(json.dumps({"id":tag,"method":"Runtime.evaluate","params":{
        "expression":expression,"returnByValue":True,"awaitPromise":False
    }}))
    while True:
        res=json.loads(ws.recv())
        if res.get("id")!=tag:
            continue
        if "error" in res:
            raise RuntimeError(str(res["error"]))
        value=res.get("result",{}).get("result",{})
        return value.get("value")

def wait_endpoint():
    for _ in range(80):
        try:
            with urlopen(f"http://127.0.0.1:{PORT}/json/list",timeout=2) as response:
                pages=json.load(response)
            result=next((x for x in pages if x.get("type")=="page"),None)
            if result:return result["webSocketDebuggerUrl"]
        except Exception:
            pass
        time.sleep(.2)
    raise RuntimeError("Chrome remote debugging did not open")

def run():
    args=[
        CHROME,"--headless=new","--no-sandbox",
        "--disable-dev-shm-usage","--enable-unsafe-swiftshader",
        "--enable-unsafe-webgpu","--use-gl=angle","--use-angle=swiftshader",
        "--ignore-gpu-blocklist","--remote-allow-origins=*",
        f"--remote-debugging-port={PORT}","--window-size=800,600",
        "--disable-background-timer-throttling",
        f"--user-data-dir={tempfile.mkdtemp(prefix='dofinances-gpu-chrome-')}",
        "about:blank"
    ]
    with open("/tmp/dashboard-preview-webgpu-chrome.log","wb") as log:
        process=subprocess.Popen(args,stdout=log,stderr=subprocess.STDOUT,
                                 start_new_session=True)
        try:
            endpoint=wait_endpoint()
            ws=websocket.create_connection(endpoint,timeout=12,
                 origin=f"http://127.0.0.1:{PORT}")
            ws.settimeout(20)
            try:
                counter=[0]
                counter[0]+=1
                ws.send(json.dumps({"id":counter[0],"method":"Page.navigate",
                    "params":{"url":PAGE}}))
                while True:
                    item=json.loads(ws.recv())
                    if item.get("id")==counter[0]:
                        if "error" in item:raise RuntimeError(str(item["error"]))
                        break
                expr="""JSON.stringify({
                    url:location.href,
                    status:document.querySelector('#cta6-mosaic')?.dataset.gpuStatus,
                    phase:document.querySelector('#cta6-mosaic')?.dataset.gpuPhase,
                    error:document.querySelector('#cta6-mosaic')?.dataset.gpuError,
                    body:document.body?.dataset.gpuScene,
                    audit:window.__dashboardWebGPU||null,
                    count:document.querySelectorAll('.cta6-tile--icon').length,
                    sidebar:!!document.querySelector('#workspace-sidebar')
                })"""
                deadline=time.monotonic()+TIMEOUT
                latest={}
                while time.monotonic()<deadline:
                    raw=cdp_eval(ws,counter,expr)
                    if raw:
                        latest=json.loads(raw)
                    audit=latest.get("audit") or {}
                    if latest.get("body")=="offscreen-proof":
                        if latest.get("count")!=16 or latest.get("sidebar"):
                            raise RuntimeError("Original 16 icons/sidebar boundary violated "+str(latest))
                        if audit.get("status")!="ready" or audit.get("mipCount",0)<2 or audit.get("sceneBuilds",0)<1:
                            raise RuntimeError("GPU did not build real scene+mips "+str(latest))
                        if audit.get("sourcePixels")!=[2400,1600]:
                            raise RuntimeError("Original AVIF lost 2400x1600 resolution "+str(audit))
                        if audit.get("sourceImage")!="/app/assets/dashboard-cloud-veiled-colorful-fields.avif":
                            raise RuntimeError("Wrong backdrop source "+str(audit))
                        if latest.get("phase")!="ready" or audit.get("presentation")!="offscreen-ci":
                            raise RuntimeError("GPU init phase not complete "+str(latest))
                        proof=audit.get("offscreenPixelProof")
                        if not isinstance(proof,list) or len(proof)!=4 or proof[3]!=255:
                            raise RuntimeError("Offscreen GPU pixel byte readback failed "+str(latest))
                        # Initial mixed mode has 14 variants x 3 alpha tiers.
                        counts=audit.get("tintCounts") or {}
                        hues=("none","red","orange","yellow","green","teal","cyan",
                            "blue","indigo","purple","magenta","pink","white","black")
                        expected={k:3 for k in hues}
                        if counts!=expected:
                            raise RuntimeError("Expanded tint distribution missing "+str(counts))
                        mixed=audit.get("tintShowcase") or {}
                        if len(mixed.get("opacityTiers",[]))!=3:
                            raise RuntimeError("Three source-recorded opacity tiers missing")
                        # GPU tile movement/interaction must never invalidate
                        # the GPU-owned background or its mip pyramid.
                        before_frames=audit["frameCount"]
                        before_scene_builds=audit["sceneBuilds"]
                        cdp_eval(ws,counter,
                            "window.dispatchEvent(new PointerEvent('pointermove',"+
                            "{pointerType:'mouse',clientX:155,clientY:166,bubbles:true})); true")
                        for _ in range(20):
                            time.sleep(.15)
                            updated=json.loads(cdp_eval(ws,counter,expr))
                            check=updated.get("audit") or {}
                            if check.get("frameCount",0)>before_frames:
                                break
                        if check.get("sceneBuilds")!=before_scene_builds:
                            raise RuntimeError("Pointer motion regenerated backdrop mips "+str(updated))
                        if check.get("frameCount",0)<=before_frames:
                            raise RuntimeError("Pointer motion did not trigger GPU redraw "+str(updated))
                        # Local per-tile hover and pressed response must be
                        # reachable without a scene or mip regeneration.
                        cdp_eval(ws,counter,
                            "(()=>{const tile=document.querySelector('.cta6-tile--icon');"
                            "const b=tile.getBoundingClientRect();"
                            "const x=b.left+b.width/2,y=b.top+b.height/2;"
                            "window.__ciPointerXY=[x,y];"
                            "window.dispatchEvent(new PointerEvent('pointermove',"
                            "{pointerId:7,isPrimary:true,button:0,pointerType:'mouse',"
                            "clientX:x,clientY:y,bubbles:true}));"
                            "window.dispatchEvent(new PointerEvent('pointerdown',"
                            "{pointerId:7,isPrimary:true,button:0,pointerType:'mouse',"
                            "clientX:x,clientY:y,bubbles:true}));return true})()")
                        for _ in range(25):
                            time.sleep(.08)
                            inter=json.loads(cdp_eval(ws,counter,expr)).get("audit") or {}
                            if inter.get("pressed") and inter.get("focusedTile", -1)>=0:
                                break
                        else:
                            raise RuntimeError("Pointer press not registered on a square")
                        cdp_eval(ws,counter,
                            "(()=>{const [x,y]=window.__ciPointerXY;"
                            "window.dispatchEvent(new PointerEvent('pointerup',"
                            "{pointerId:7,isPrimary:true,button:0,pointerType:'mouse',"
                            "clientX:x,clientY:y,bubbles:true}));return true})()")
                        # A tiny motion state update must not rebuild GPU-owned scene.
                        inter=json.loads(cdp_eval(ws,counter,expr)).get("audit") or {}
                        if inter.get("sceneBuilds")!=before_scene_builds:
                            raise RuntimeError("Interaction rebuilt backdrop mips")
                        # A tint change is a GPU uniform update only.
                        # Source hue transfer is experimental; verify matrix
                        # opacity provenance and that it does not touch mips.
                        before_tint_frames=inter.get("frameCount",0)
                        cdp_eval(ws,counter,
                            "window.__dashboardTintControls.setTint('blue',0.25);true")
                        for _ in range(25):
                            time.sleep(.08)
                            after_tint=json.loads(cdp_eval(ws,counter,expr))
                            ta=(after_tint.get("audit") or {})
                            witness=ta.get("tint") or {}
                            if ta.get("frameCount",0)>before_tint_frames and (
                                witness.get("name")=="blue"
                                and abs(witness.get("opacity",0)-0.25)<0.000001
                                and witness.get("filterCount")==3
                            ):
                                break
                        else:
                            raise RuntimeError("Tint uniform update not recorded")
                        if ta.get("sceneBuilds")!=before_scene_builds:
                            raise RuntimeError("Tint transition regenerated backdrop mips")
                        # Regression for reversed scheme brightness: encoded
                        # browser face endpoints must make Light brighter.
                        # Pure luminance ordering is covered in Node test-tint;
                        # the WebGPU smoke confirms scheme switching still
                        # submits a new draw without recreating backdrop mips.
                        cdp_eval(ws,counter,
                            "window.__dashboardTintControls.setScheme('light');true")
                        for _ in range(20):
                            time.sleep(.08)
                            scheme_check=json.loads(cdp_eval(ws,counter,expr))
                            st=(scheme_check.get("audit") or {}).get("tint") or {}
                            if st.get("scheme")=="light":break
                        else:
                            raise RuntimeError("Tint scheme not updated")
                        cdp_eval(ws,counter,
                            "window.__dashboardTintControls.setTint('none');true")
                        cdp_eval(ws,counter,
                            "window.__dashboardTintControls.setShowcase();true")
                        for _ in range(20):
                            time.sleep(.08)
                            restored=json.loads(cdp_eval(ws,counter,expr))
                            state=(restored.get("audit") or {})
                            if state.get("tintCounts")==expected:
                                break
                        else:
                            raise RuntimeError("Mixed tint restoration failed")
                        if state.get("sceneBuilds")!=before_scene_builds:
                            raise RuntimeError("Per-tile tint changes rebuilt scene")
                        # Exercise the second retained AIR SDF branch in
                        # a real GPU render, not merely WGSL compilation. The
                        # four equal native lanes select 4; one unequal
                        # corner selects 5. This synthetic CI case is NOT
                        # presented as captured public Clear state.
                        baseline_mode4=(check.get("sdfModes") or {}).get("mode4")
                        if baseline_mode4!=check.get("tiles"):
                            raise RuntimeError("Equal-radius native mode4 not selected "+str(updated))
                        synthetic=(
                            "(()=>{const t=document.querySelector('.cta6-tile--plain');"
                            "if(!t)throw Error('Missing square for mode5 CI');"
                            "t.style.borderTopRightRadius='3px';"
                            "window.__dashboardGpuControls.reflowTiles();return true})()"
                        )
                        cdp_eval(ws,counter,synthetic)
                        mode5_frame=check.get("frameCount",0)
                        mode5_check={}
                        for _ in range(20):
                            time.sleep(.15)
                            after=json.loads(cdp_eval(ws,counter,expr))
                            mode5_check=after.get("audit") or {}
                            modes=mode5_check.get("sdfModes") or {}
                            if modes.get("mode5",0)>=1 and mode5_check.get("frameCount",0)>mode5_frame:
                                break
                        else:
                            raise RuntimeError("Unequal-corner mode5 GPU render missing "+str(after))
                        if mode5_check.get("sceneBuilds")!=before_scene_builds:
                            raise RuntimeError("Mode switch rebuilt backdrop mips "+str(after))
                        if mode5_check.get("status")!="ready":
                            raise RuntimeError("Mode5 GPU renderer fell back "+str(after))
                        print("GPU_BOTH_SDF_BRANCHES "+json.dumps({
                            "mode4":modes.get("mode4"),"mode5":modes.get("mode5"),
                            "frameCount":mode5_check.get("frameCount"),
                            "sceneBuilds":mode5_check.get("sceneBuilds")},sort_keys=True))
                        print("GPU_OFFSCREEN_PROOF "+json.dumps(after,sort_keys=True))
                        return
                    if latest.get("body")=="fallback":
                        raise RuntimeError("GPU fallback: "+json.dumps(latest,sort_keys=True))
                    time.sleep(.35)
                raise RuntimeError("GPU initialization timeout: "+json.dumps(latest,sort_keys=True))
            finally:
                ws.close()
        finally:
            if process.poll() is None:
                os.killpg(process.pid,signal.SIGTERM)
                try:process.wait(timeout=5)
                except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL)

if __name__=="__main__":
    try:run()
    except Exception as ex:
        print("GPU_CDP_FAILURE",repr(ex),file=sys.stderr)
        try:
            print(open("/tmp/dashboard-preview-webgpu-chrome.log").read()[-5500:],
                  file=sys.stderr)
        except Exception:pass
        sys.exit(1)
