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
                        if latest.get("phase")!="ready" or audit.get("presentation")!="offscreen-ci":
                            raise RuntimeError("GPU init phase not complete "+str(latest))
                        proof=audit.get("offscreenPixelProof")
                        if not isinstance(proof,list) or len(proof)!=4 or proof[3]!=255:
                            raise RuntimeError("Offscreen GPU pixel byte readback failed "+str(latest))
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
                        print("GPU_OFFSCREEN_PROOF "+json.dumps(updated,sort_keys=True))
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
