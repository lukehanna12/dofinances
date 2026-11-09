import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {glassIndicatorGeometry} from "../sites/_apex/app/assets/sidebar-glass.js";

import {lensProfile,drawGlassWallpaper,BACKDROP_SCENES,createSceneBackedGlass}
  from "../sites/_apex/app/assets/sidebar-glass-refraction.js";

const read = path => readFile(new URL(path,import.meta.url),"utf8");

test("glass presentation preserves the actual app route and responsive owners", async () => {
  const nav=await read("../sites/_apex/app/assets/workspace-nav.js");
  const boot=await read("../preview/app-sidebar-bootstrap.js");
  const html=await read("../sites/_apex/app/index.html");
  assert.match(boot,/initWorkspaceNavigation\(\)/);
  assert.match(boot,/initLiquidGlassSidebar\(\)/);
  assert.ok(boot.indexOf("initWorkspaceNavigation()") < boot.indexOf("initLiquidGlassSidebar()"));
  assert.match(nav,/const isMobile=.*max-width: 760px/);
  assert.match(nav,/const isCompactRail=.*max-width: 1279px/);
  assert.match(nav,/const PREFERENCE_KEY="dofinances.workspace.sidebar.collapsed"/);
  assert.match(nav,/win\.addEventListener\("hashchange",render\)/);
  assert.match(nav,/shell\.classList\.toggle\("is-collapsed",effectiveCollapsed\)/);
  assert.match(html,/href="\/app\/assets\/sidebar-glass\.css"/);
  assert.equal((html.match(/id="workspace-sidebar"/g)||[]).length,1);
});

test("glass selection follows the actual active link rather than a fixed mock row", () => {
  const nav={scrollLeft:0,scrollTop:22,getBoundingClientRect:()=>({left:0,top:70,width:245,height:700})};
  const active={getBoundingClientRect:()=>({left:12,top:211,width:221,height:39})};
  assert.deepEqual(glassIndicatorGeometry(nav,active),{x:12,y:163,width:221,height:39});
  const rail={scrollLeft:0,scrollTop:0,getBoundingClientRect:()=>({left:0,top:72,width:49,height:700})};
  const railLink={getBoundingClientRect:()=>({left:12,top:162,width:49,height:39})};
  assert.deepEqual(glassIndicatorGeometry(rail,railLink),{x:12,y:90,width:49,height:39});
  assert.equal(glassIndicatorGeometry(nav,{getBoundingClientRect:()=>({left:0,top:0,width:0,height:0})}),null);
});

test("optical shading is progressive with reduced-transparency, contrast and motion modes", async () => {
  const css=await read("../sites/_apex/app/assets/sidebar-glass.css");
  const js=await read("../sites/_apex/app/assets/sidebar-glass.js");
  for(const token of [
    ".shell.liquid-glass-preview .sidebar", ".glass-selection",
    ".glass-optics", ".glass-scene-toggle", "glass-scene-neutral",
    "glass-scene-prism", "prefers-reduced-transparency",
    "prefers-reduced-motion", "forced-colors",
    "backdrop-filter: blur(21px)", "border-radius: 0 24px 24px 0"
  ]) assert.ok(css.includes(token),token);
  const refraction=await read("../sites/_apex/app/assets/sidebar-glass-refraction.js");
  assert.match(js,/createSceneBackedGlass\(/);
  assert.match(js,/optics\.setScene\(scene\)/);
  assert.match(js,/optics\.setLens\(lensOn\)/);
  assert.match(refraction,/getContext\("webgl2"/);
  assert.match(refraction,/roundedRightDistance\(/);
  assert.match(refraction,/uniform sampler2D u_wallpaper/);
  assert.match(refraction,/textureLod\(u_wallpaper, uv/);
  assert.match(refraction,/gl\.texImage2D/);
  assert.match(refraction,/gl\.generateMipmap/);
  assert.match(js,/new MutationObserver\(scheduleIndicator\)/);
  assert.match(js,/new ResizeObserver\(scheduleIndicator\)/);
  assert.match(refraction,/pointermove/);
  assert.match(refraction,/pointerleave/);
  assert.match(refraction,/visibilitychange/);
  assert.match(js,/win\.addEventListener\("pagehide",cleanup/);
  assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|\.cookie|localStorage/);
  assert.doesNotMatch(refraction,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|\.cookie|localStorage/);
  assert.doesNotMatch(css,/@import|url\(https?:\/\//);
});

test("the test branch alone deploys a static read-only preview with all required assets", async () => {
  const workflow=await read("../.github/workflows/app-sidebar-preview.yml");
  assert.match(workflow,/branches: \[test\/app-sidebar\]/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/test\/app-sidebar'/);
  assert.match(workflow,/pages deploy .*--branch=app-sidebar-preview/);
  assert.match(workflow,/cp sites\/_apex\/app\/assets\/sidebar-glass\.js/);
  assert.match(workflow,/cp sites\/_apex\/app\/assets\/sidebar-glass\.css/);
  assert.match(workflow,/cp sites\/_apex\/app\/assets\/sidebar-glass-refraction\.js/);
  assert.match(workflow,/test ! -e .app-sidebar-preview\/app\/assets\/dashboard\.js/);
  assert.match(workflow,/node --test tests\/dashboard-navigation\.test\.mjs tests\/sidebar-glass\.test\.mjs/);
});


test("the preview wallpaper spans the entire viewport and glass remains color-neutral",async()=>{
  const css=await read("../sites/_apex/app/assets/sidebar-glass.css");
  const js=await read("../sites/_apex/app/assets/sidebar-glass.js");
  // The scene must continue behind BOTH sidebar and content. The previous
  // 440px color patch plus opaque main obscured the comparison altogether.
  assert.match(css,/\.shell\.liquid-glass-preview::before,\s*\.shell\.liquid-glass-preview::after\s*\{[^}]*position: fixed;[^}]*inset: 0;[^}]*width: 100%;[^}]*height: 100%/s);
  assert.doesNotMatch(css,/width:\s*min\(440px/);
  assert.match(css,/\.shell\.liquid-glass-preview::after\s*\{[^}]*radial-gradient\(circle[^}]*repeating-linear-gradient\(90deg/s);
  assert.match(css,/\.shell\.liquid-glass-preview \.main\s*\{[^}]*background:\s*linear-gradient\(90deg,\s*rgba\(7,13,17,\.10\)/s);
  assert.match(css,/\.shell\.liquid-glass-preview \.topbar\s*\{[^}]*background:\s*rgba\(12,\s*18,\s*22,\s*\.34\)/s);
  assert.match(css,/--glass-pane:\s*rgba\(22,\s*24,\s*26,\s*\.34\)/);
  assert.match(css,/backdrop-filter:\s*blur\(21px\) saturate\(1\.13\) brightness\(1\.04\)/);
  const refraction=await read("../sites/_apex/app/assets/sidebar-glass-refraction.js");
  assert.match(refraction,/vec3\(\.105,\.113,\.118\)/);
  assert.deepEqual(BACKDROP_SCENES,["Gallery","Monochrome","Spectrum"]);
  assert.match(css,/has-glass-wallpaper::before/);
  assert.match(css,/has-refractive-glass \.glass-optics/);
  // No new routes, network requests, or external images are added.
  assert.doesNotMatch(css,/url\(|@import/);
  assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest/);
});


test("geometry-driven lens profile is bounded, declines into the pane and scales with width",()=>{
  assert.ok(lensProfile(0,260)>lensProfile(8,260));
  assert.ok(lensProfile(8,260)>lensProfile(32,260));
  assert.ok(lensProfile(0,260)>lensProfile(0,74));
  assert.equal(lensProfile(0,260,false),0);
  assert.throws(()=>lensProfile(-1,260),RangeError);
  assert.throws(()=>lensProfile(2,Infinity),RangeError);
});

function fakeWallpaper(){
  const calls={linear:[],radial:[],stroke:0,arc:0,fill:0};
  const ctx={
    setTransform(){},clearRect(){},fillRect(){calls.fill++;},save(){},restore(){},
    translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},
    stroke(){calls.stroke++;},arc(){calls.arc++;},
    createLinearGradient(){
      const gradient={addColorStop:(p,v)=>calls.linear.push([p,v])};
      return gradient;
    },
    createRadialGradient(){
      const gradient={addColorStop:(p,v)=>calls.radial.push([p,v])};
      return gradient;
    },
    set fillStyle(v){this._fill=v;},get fillStyle(){return this._fill;},
    set strokeStyle(v){this._stroke=v;},get strokeStyle(){return this._stroke;},
    set lineWidth(v){this._width=v;},get lineWidth(){return this._width;},
    set globalCompositeOperation(v){this._blend=v;},get globalCompositeOperation(){return this._blend;}
  };
  const canvas={width:0,height:0,getContext:kind=>kind==="2d"?ctx:null,remove(){}};
  return {canvas,calls};
}

test("one canvas supplies the entire scene for BOTH background and refracted pixels",()=>{
  const {canvas,calls}=fakeWallpaper();
  const win={innerWidth:1200,innerHeight:850,devicePixelRatio:2};
  assert.equal(drawGlassWallpaper(canvas,0,win),true);
  assert.equal(canvas.width,2100);
  assert.equal(canvas.height,1488);
  assert.ok(calls.fill>=4,"scene includes base plus illuminated layers");
  assert.equal(calls.arc,4,"the same 4 hard-edged rings cross the material boundary");
  assert.ok(calls.stroke>0);
  assert.ok(calls.linear.some(([,s])=>s==="#273a3c"));
  assert.equal(drawGlassWallpaper(canvas,2,win),true);
  assert.ok(calls.linear.some(([,s])=>s==="#26374b"));
});

test("invalid or disabled WebGL safely retains the same wallpaper and CSS glass fallback",()=>{
  const f=fakeWallpaper();
  const classNames=new Set();
  const shell={classList:{
    add:(...names)=>names.forEach(n=>classNames.add(n)),
    remove:(...names)=>names.forEach(n=>classNames.delete(n))
  },prepend(el){this.child=el;}};
  const canvas={hidden:false,getContext:()=>null,addEventListener(){},removeEventListener(){}};
  const sidebar={addEventListener(){},removeEventListener(){}};
  const doc={
    hidden:false,createElement(name){assert.equal(name,"canvas");return f.canvas;},
    addEventListener(){},removeEventListener(){}
  };
  const win={
    innerWidth:1200,innerHeight:850,devicePixelRatio:1,
    matchMedia:()=>({matches:false}),
    addEventListener(){},removeEventListener(){}
  };
  f.canvas.className="";
  f.canvas.setAttribute=()=>{};
  const renderer=createSceneBackedGlass({
    doc,win,shell,sidebar,glassCanvas:canvas,reducedMotion:{matches:false}
  });
  assert.equal(renderer.active,false);
  assert.equal(canvas.hidden,true);
  assert.ok(classNames.has("has-glass-wallpaper"));
  assert.ok(!classNames.has("has-refractive-glass"));
  renderer.setScene(1);
  assert.ok(f.calls.linear.some(([,s])=>s==="#313539"));
  renderer.setLens(false);
  assert.throws(()=>renderer.setScene(44),RangeError);
  renderer.dispose();
  assert.ok(!classNames.has("has-glass-wallpaper"));
});

test("WebGL refraction is scene-texture based and optically distinct from the old glint-only overlay",async()=>{
  const shader=await read("../sites/_apex/app/assets/sidebar-glass-refraction.js");
  const css=await read("../sites/_apex/app/assets/sidebar-glass.css");
  assert.match(shader,/roundedRightDistance\(p, dims, corner\)/);
  assert.match(shader,/float warp = \(1\.1 \+ 7\.0 \* band \* band\)/);
  assert.match(shader,/sourcePixel = u_panel\.xy \+ p - n \* warp/);
  assert.match(shader,/textureLod\(u_wallpaper, uv, mip\)/);
  assert.match(shader,/vec3 material = mix\(light, neutral, density\)/);
  assert.match(shader,/gl\.pixelStorei\(gl\.UNPACK_FLIP_Y_WEBGL,true\)/);
  assert.match(shader,/gl\.texImage2D\(gl\.TEXTURE_2D,0,gl\.RGBA,gl\.RGBA,gl\.UNSIGNED_BYTE,wallpaper\)/);
  assert.match(css,/\.shell\.liquid-glass-preview\.has-refractive-glass \.sidebar \{[^}]*backdrop-filter: none/s);
  assert.match(css,/\.shell\.liquid-glass-preview\.has-refractive-glass \.glass-optics \{[^}]*mix-blend-mode: normal/s);
});
test("GPU path uploads exactly the shared wallpaper, renders distortion and accepts scene/lens changes",()=>{
  const f=fakeWallpaper(), calls={uploads:0,draws:0,lens:[],uniforms:[]};
  const gl={
    VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,
    MAX_TEXTURE_SIZE:5,ARRAY_BUFFER:6,STATIC_DRAW:7,FLOAT:8,
    TEXTURE_2D:9,TEXTURE_WRAP_S:10,TEXTURE_WRAP_T:11,CLAMP_TO_EDGE:12,
    TEXTURE_MAG_FILTER:13,TEXTURE_MIN_FILTER:14,LINEAR:15,
    LINEAR_MIPMAP_LINEAR:16,UNPACK_FLIP_Y_WEBGL:17,
    TEXTURE0:18,RGBA:19,UNSIGNED_BYTE:20,COLOR_BUFFER_BIT:21,TRIANGLES:22,
    createShader:()=>({}),shaderSource(){},compileShader(){},
    getShaderParameter:()=>true,createProgram:()=>({}),attachShader(){},linkProgram(){},
    deleteShader(){},getProgramParameter:()=>true,createBuffer:()=>({}),
    bindBuffer(){},bufferData(){},useProgram(){},enableVertexAttribArray(){},
    vertexAttribPointer(){},createTexture:()=>({}),activeTexture(){},
    bindTexture(){},texParameteri(){},pixelStorei(){},
    getParameter:()=>8192,getUniformLocation:(_,name)=>name,
    texImage2D(...args){calls.uploads++;assert.equal(args.at(-1),f.canvas);},
    generateMipmap(){},uniform1i(){},viewport(){},
    uniform2f(){},uniform4f(){},uniform3f(){},
    uniform1f(key,value){calls.uniforms.push([key,value]);if(key==="u_lens")calls.lens.push(value);},
    clearColor(){},clear(){},drawArrays(){calls.draws++;},
    deleteTexture(){},deleteBuffer(){},deleteProgram(){}
  };
  const classNames=new Set();
  const shell={classList:{
    add:(...names)=>names.forEach(n=>classNames.add(n)),
    remove:(...names)=>names.forEach(n=>classNames.delete(n))
  },prepend(){}};
  const canvas={
    width:0,height:0,hidden:false,
    getContext:type=>type==="webgl2"?gl:null,
    addEventListener(){},removeEventListener(){}
  };
  const sidebar={
    addEventListener(){},removeEventListener(){},
    getBoundingClientRect(){return {left:0,top:0,width:260,height:800};}
  };
  const doc={
    hidden:false,createElement(){return f.canvas;},
    addEventListener(){},removeEventListener(){}
  };
  f.canvas.setAttribute=()=>{};
  const frames=[];
  const win={
    innerWidth:1280,innerHeight:800,devicePixelRatio:1,
    matchMedia:()=>({matches:false}),
    addEventListener(){},removeEventListener(){},
    requestAnimationFrame(fn){frames.push(fn);return frames.length;},
    cancelAnimationFrame(){}
  };
  const renderer=createSceneBackedGlass({
    doc,win,shell,sidebar,glassCanvas:canvas,reducedMotion:{matches:true}
  });
  assert.equal(renderer.active,true);
  frames.shift()();
  assert.equal(calls.uploads,1);
  assert.equal(calls.draws,1);
  assert.ok(classNames.has("has-refractive-glass"));
  assert.equal(calls.lens.at(-1),1);
  renderer.setLens(false);
  frames.shift()();
  assert.equal(calls.lens.at(-1),0);
  renderer.setScene(2);
  frames.shift()();
  assert.equal(calls.uploads,2);
  assert.ok(calls.draws>=3);
  renderer.dispose();
  assert.equal(classNames.has("has-refractive-glass"),false);
});


test("browser smoke is isolated, checks GPU and all responsive modes, and is removed before deployment",async()=>{
  const browser=await read("../tests/sidebar-glass-browser-smoke.js");
  const flow=await read("../.github/workflows/app-sidebar-preview.yml");
  assert.match(browser,/data-glass-browser-smoke/);
  assert.match(browser,/has-refractive-glass/);
  assert.match(browser,/gl\.getError\(\)===gl\.NO_ERROR/);
  assert.match(browser,/is-mobile-open/);
  assert.match(browser,/is-collapsed/);
  assert.match(flow,/runs-on: ubuntu-24\.04/);
  assert.match(flow,/viewport in 1440,900 980,760 390,844/);
  assert.match(flow,/--enable-unsafe-swiftshader/);
  assert.match(flow,/unlinkSync\('\.app-sidebar-preview\/app\/assets\/_ci-glass-smoke\.js'\)/);
  assert.match(flow,/test ! -e \.app-sidebar-preview\/app\/assets\/_ci-glass-smoke\.js/);
});
