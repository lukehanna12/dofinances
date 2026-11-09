/*
 * Test-branch-only, scene-backed Liquid Glass optical approximation.
 * The wallpaper is OWNED and generated in Canvas2D. We do not capture
 * private DOM pixels, the screen, or outside apps.
 *
 * Provenance:
 * - Oracle target 25F80/M2/G14G selects LPH-only Glass programs.
 * - SDF mode4/5 CPU48 producer/join behavior is recorded, and AIR SSA is
 *   retained. This shader uses an ANALOGOUS rounded edge SDF only.
 * - Oracle does not close universal native S/R, final scalar scale or Q.
 * Therefore refraction coefficients, blur footprint, highlights and color
 * treatment are explicit approximations, never "reconstructed" constants.
 */
export const BACKDROP_SCENES = Object.freeze(["Gallery","Monochrome","Spectrum"]);

export function lensProfile(depth, panelWidth, enabled=true) {
  if (!Number.isFinite(depth) || !Number.isFinite(panelWidth) ||
      depth < 0 || panelWidth <= 0) throw new RangeError("finite positive geometry required");
  const band=Math.exp(-Math.pow(depth/16,2));
  const widthFactor=Math.min(1,Math.max(0,(panelWidth-74)/186));
  const thickness=.72+.28*widthFactor;
  return enabled ? (1.1+7*band*band)*thickness : 0;
}

function wallpaperStops(scene) {
  if (scene === 1) return ["#313539","#202529","#141a1f"];
  if (scene === 2) return ["#26374b","#1b233c","#1b2b38"];
  return ["#273a3c","#1b262b","#141d23"];
}

export function drawGlassWallpaper(canvas,scene,win) {
  const w=Math.max(1,Math.round(win.innerWidth||1));
  const h=Math.max(1,Math.round(win.innerHeight||1));
  const scale=Math.max(.25,Math.min(1.75,win.devicePixelRatio||1,4096/Math.max(w,h)));
  const pxw=Math.max(1,Math.round(w*scale));
  const pxh=Math.max(1,Math.round(h*scale));
  const ctx=canvas.getContext("2d",{alpha:false});
  if(!ctx) return false;
  if(canvas.width!==pxw||canvas.height!==pxh) {
    canvas.width=pxw; canvas.height=pxh;
  }
  ctx.setTransform(pxw/w,0,0,pxh/h,0,0);
  ctx.globalCompositeOperation="source-over";
  ctx.clearRect(0,0,w,h);
  const stops=wallpaperStops(scene);
  const bg=ctx.createLinearGradient(0,0,w,h);
  bg.addColorStop(0,stops[0]);
  bg.addColorStop(.52,stops[1]);
  bg.addColorStop(1,stops[2]);
  ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);

  function glow(x,y,r,c) {
    ctx.save();
    ctx.translate(w*x,h*y);
    ctx.scale(1,.85);
    const radial=ctx.createRadialGradient(0,0,0,0,0,r);
    radial.addColorStop(0,c);
    radial.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=radial;
    ctx.fillRect(-r,-r,r*2,r*2);
    ctx.restore();
  }
  ctx.globalCompositeOperation="screen";
  if(scene===0) {
    glow(.19,.31,Math.max(180,w*.34),"rgba(231,159,88,.51)");
    glow(.78,.25,Math.max(210,w*.36),"rgba(64,188,169,.41)");
    glow(.48,.92,Math.max(180,w*.32),"rgba(187,145,95,.20)");
  } else if(scene===1) {
    glow(.22,.38,Math.max(180,w*.33),"rgba(216,214,203,.28)");
    glow(.77,.29,Math.max(200,w*.38),"rgba(158,164,172,.23)");
  } else {
    glow(.18,.31,Math.max(180,w*.34),"rgba(255,125,70,.63)");
    glow(.78,.26,Math.max(205,w*.38),"rgba(36,229,208,.52)");
    glow(.55,.86,Math.max(200,w*.30),"rgba(121,93,234,.36)");
  }
  ctx.globalCompositeOperation="source-over";

  // High spatial frequency gives a measurable sharp-vs-refracted reference
  // immediately adjacent to the sidebar.
  ctx.save();
  ctx.strokeStyle="rgba(245,249,255,.115)";
  ctx.lineWidth=1;
  ctx.beginPath();
  for(let x=.5;x<w;x+=88){ctx.moveTo(x,0);ctx.lineTo(x,h);}
  for(let y=.5;y<h;y+=88){ctx.moveTo(0,y);ctx.lineTo(w,y);}
  ctx.stroke();
  function circle(x,y,r,a) {
    ctx.strokeStyle="rgba(248,251,255,"+a+")";
    ctx.lineWidth=1.35;
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.stroke();
  }
  // The first ring crosses the 260px glass boundary on a desktop viewport.
  circle(w*.18,h*.39,Math.min(255,Math.max(140,w*.13)),.32);
  circle(w*.18,h*.39,Math.min(350,Math.max(235,w*.20)),.17);
  circle(w*.81,h*.71,Math.min(260,Math.max(160,w*.15)),.24);
  circle(w*.81,h*.71,Math.min(380,Math.max(250,w*.23)),.12);
  ctx.strokeStyle="rgba(255,255,255,.10)";
  ctx.lineWidth=1.1;
  ctx.beginPath();
  ctx.moveTo(0,h*.72);ctx.lineTo(w*.65,0);
  ctx.moveTo(w*.43,h);ctx.lineTo(w,h*.30);
  ctx.stroke();
  ctx.restore();
  return true;
}

const VERTEX_SHADER_SOURCE="#version 300 es\nlayout(location=0) in vec2 a_position;\nout vec2 v_uv;\nvoid main() {\n  v_uv = a_position * .5 + .5;\n  gl_Position = vec4(a_position, 0.0, 1.0);\n}";
const FRAGMENT_SHADER_SOURCE="#version 300 es\nprecision highp float;\nprecision highp sampler2D;\nin vec2 v_uv;\nuniform sampler2D u_wallpaper;\nuniform vec2 u_viewport;\nuniform vec4 u_panel;\nuniform vec3 u_pointer;\nuniform float u_pixel_ratio;\nuniform float u_lens;\nout vec4 outColor;\n\nfloat roundedRightDistance(vec2 p, vec2 size, float radius) {\n  vec2 q = p - size * .5;\n  vec4 corners = vec4(radius, radius, 0.0, 0.0);\n  vec2 pair = q.x > 0.0 ? corners.xy : corners.zw;\n  float r = q.y > 0.0 ? pair.x : pair.y;\n  vec2 d = abs(q) - size * .5 + r;\n  return min(max(d.x, d.y), 0.0) + length(max(d, vec2(0.0))) - r;\n}\n\nfloat hash12(vec2 p) {\n  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);\n}\nvec2 sampleUV(vec2 topLeftPx) {\n  vec2 normalized = topLeftPx / u_viewport;\n  return clamp(vec2(normalized.x, 1.0 - normalized.y),\n               vec2(.0001), vec2(.9999));\n}\nvoid main() {\n  // The panel is 260px, 74px or 274px according to the REAL navigation.\n  // The SDF controls where light bends: strong near the rounded silhouette,\n  // nearly absent in the center. These optical coefficients are approximated.\n  vec2 p = vec2(v_uv.x * u_panel.z, (1.0-v_uv.y) * u_panel.w);\n  vec2 dims = u_panel.zw;\n  float corner = min(25.0, dims.x * .33);\n  float signedDistance = roundedRightDistance(p, dims, corner);\n  float depth = max(-signedDistance, 0.0);\n  float band = exp(-pow(depth / 16.0, 2.0));\n  vec2 grad = vec2(\n    roundedRightDistance(p + vec2(1.0,0.0),dims,corner)\n      - roundedRightDistance(p - vec2(1.0,0.0),dims,corner),\n    roundedRightDistance(p + vec2(0.0,1.0),dims,corner)\n      - roundedRightDistance(p - vec2(0.0,1.0),dims,corner));\n  vec2 n = grad / max(length(grad), .00001);\n\n  // Do not lens along the seamless left viewport edge.\n  band *= smoothstep(0.0, 11.0, p.x);\n  float thickness = mix(.72, 1.0, smoothstep(74.0,260.0,dims.x));\n  float warp = (1.1 + 7.0 * band * band) * thickness * u_lens;\n  vec2 sourcePixel = u_panel.xy + p - n * warp;\n\n  // A single, shared wallpaper texture is the genuine source for both the\n  // exterior background and interior shader, avoiding mismatched artwork.\n  vec2 uv = sampleUV(sourcePixel);\n  float mip = 2.65 + log2(max(1.0,u_pixel_ratio));\n  vec3 scattered = textureLod(u_wallpaper, uv, mip).rgb;\n  vec3 concentrated = textureLod(u_wallpaper, uv, 1.05).rgb;\n  vec3 light = mix(scattered, concentrated, band * .32);\n  float localLuma = dot(scattered, vec3(.2126,.7152,.0722));\n\n  // The full-width Regular navigation material stays dark for legibility.\n  // Ambient colors remain visible, but the material itself has no purple tint.\n  vec3 neutral = vec3(.105,.113,.118);\n  float density = clamp(.34 + .11 * localLuma, .34, .50);\n  vec3 material = mix(light, neutral, density);\n\n  // Geometry-conditioned rim and a restrained interaction glint.\n  vec2 mouse = u_pointer.xy * dims;\n  vec2 delta = (p - mouse) / vec2(105.0, 175.0);\n  float glint = exp(-dot(delta,delta) * 1.55) * u_pointer.z;\n  float outerRim = exp(-depth / 2.6);\n  float softRim = exp(-depth / 14.0);\n  float rightWeight = smoothstep(dims.x*.46,dims.x*.89,p.x);\n  float slope = clamp(.56 + .38*n.x - .21*n.y, .18, 1.0);\n  float highlight = rightWeight * (outerRim*.145 + softRim*.050)\n    * (slope + glint * .47);\n  float localGlow = glint * band * .033;\n  vec3 pearl = mix(vec3(.83,.87,.90),vec3(1.0),rightWeight*.58);\n  material += pearl * (highlight + localGlow);\n\n  // Subtle stable luminance grain prevents smooth material banding.\n  float grain = (hash12(floor(u_panel.xy+p))-.5)*.006;\n  material += vec3(grain);\n  outColor = vec4(clamp(material, vec3(0.0), vec3(1.0)), 1.0);\n}";

export function createSceneBackedGlass({doc,win,shell,sidebar,glassCanvas,reducedMotion}) {
  const wallpaper=doc.createElement("canvas");
  wallpaper.className="glass-wallpaper";
  wallpaper.setAttribute("aria-hidden","true");
  wallpaper.setAttribute("role","presentation");
  shell.prepend(wallpaper);
  let scene=0,disposed=false,frame=0,gl=null,program=null,buffer=null,texture=null;
  let rectWidth=0,rectHeight=0;
  const pointer={x:.81,y:.16,power:.12};
  const target={x:.81,y:.16,power:.12};
  const contrast=win.matchMedia?.("(prefers-contrast: more)")?.matches ||
    win.matchMedia?.("(forced-colors: active)")?.matches;
  const transparencyReduced=win.matchMedia?.("(prefers-reduced-transparency: reduce)")?.matches;
  const allowGlass=!contrast&&!transparencyReduced;
  const wallpaperReady=drawGlassWallpaper(wallpaper,scene,win);
  if(wallpaperReady) shell.classList.add("has-glass-wallpaper");

  function compile(kind,source) {
    const shader=gl.createShader(kind);
    if(!shader)throw Error("no shader");
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {
      const message=gl.getShaderInfoLog(shader)||"shader compilation failed";
      gl.deleteShader(shader);
      throw Error(message);
    }
    return shader;
  }
  if(allowGlass && wallpaperReady) {
    try {
      gl=glassCanvas.getContext("webgl2",{
        alpha:true,premultipliedAlpha:false,
        antialias:false,depth:false,stencil:false,
        preserveDrawingBuffer:false,powerPreference:"low-power"
      });
      if(gl && wallpaper.width<=gl.getParameter(gl.MAX_TEXTURE_SIZE) &&
         wallpaper.height<=gl.getParameter(gl.MAX_TEXTURE_SIZE)) {
        const v=compile(gl.VERTEX_SHADER,VERTEX_SHADER_SOURCE);
        const f=compile(gl.FRAGMENT_SHADER,FRAGMENT_SHADER_SOURCE);
        program=gl.createProgram();
        gl.attachShader(program,v);gl.attachShader(program,f);
        gl.linkProgram(program);
        gl.deleteShader(v);gl.deleteShader(f);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS))
          throw Error(gl.getProgramInfoLog(program)||"link failed");
        buffer=gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
        gl.bufferData(gl.ARRAY_BUFFER,
          new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
        gl.useProgram(program);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
        texture=gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      } else gl=null;
    } catch {
      gl=null;
    }
  }
  if(!gl||!program||!texture)glassCanvas.hidden=true;
  const uniforms=gl&&program?{
    wallpaper:gl.getUniformLocation(program,"u_wallpaper"),
    viewport:gl.getUniformLocation(program,"u_viewport"),
    panel:gl.getUniformLocation(program,"u_panel"),
    pointer:gl.getUniformLocation(program,"u_pointer"),
    pixelRatio:gl.getUniformLocation(program,"u_pixel_ratio"),
    lens:gl.getUniformLocation(program,"u_lens")
  }:null;
  let lensEnabled=true;
  let textureDirty=true;

  function uploadTexture() {
    if(!gl || !wallpaperReady)return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,wallpaper);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.uniform1i(uniforms.wallpaper,0);
    textureDirty=false;
  }
  function draw() {
    frame=0;
    if(disposed||doc.hidden||!gl||!program)return;
    const bounds=sidebar.getBoundingClientRect();
    if(bounds.width<=0||bounds.height<=0)return;
    const ratio=Math.min(1.6,Math.max(.5,win.devicePixelRatio||1));
    const width=Math.max(1,Math.round(bounds.width*ratio));
    const height=Math.max(1,Math.round(bounds.height*ratio));
    if(glassCanvas.width!==width||glassCanvas.height!==height){
      glassCanvas.width=width;glassCanvas.height=height;
    }
    gl.viewport(0,0,width,height);
    gl.useProgram(program);
    if(textureDirty)uploadTexture();
    const k=reducedMotion?.matches?1:.20;
    pointer.x+=(target.x-pointer.x)*k;
    pointer.y+=(target.y-pointer.y)*k;
    pointer.power+=(target.power-pointer.power)*k;
    gl.uniform2f(uniforms.viewport,win.innerWidth,win.innerHeight);
    gl.uniform4f(uniforms.panel,bounds.left,bounds.top,bounds.width,bounds.height);
    gl.uniform3f(uniforms.pointer,pointer.x,pointer.y,pointer.power);
    gl.uniform1f(uniforms.pixelRatio,wallpaper.width/Math.max(1,win.innerWidth));
    gl.uniform1f(uniforms.lens,lensEnabled?1:0);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES,0,6);
    shell.classList.add("has-refractive-glass");
    const residual=Math.abs(pointer.x-target.x)+Math.abs(pointer.y-target.y)+
      Math.abs(pointer.power-target.power);
    if(!reducedMotion?.matches&&residual>.002)invalidate();
  }
  function invalidate() {
    if(!disposed&&!frame&&!doc.hidden&&gl)
      frame=win.requestAnimationFrame(draw);
  }
  function redrawWallpaper() {
    if(!wallpaperReady)return;
    if(drawGlassWallpaper(wallpaper,scene,win)){
      textureDirty=true;
      invalidate();
    }
  }
  function onPointer(event) {
    if(reducedMotion?.matches)return;
    const rect=sidebar.getBoundingClientRect();
    if(rect.width<=0||rect.height<=0)return;
    target.x=Math.min(1,Math.max(0,(event.clientX-rect.left)/rect.width));
    target.y=Math.min(1,Math.max(0,(event.clientY-rect.top)/rect.height));
    target.power=.9;
    invalidate();
  }
  function onLeave(){target.power=.12;invalidate();}
  function onLost(event){
    event.preventDefault();
    if(frame)win.cancelAnimationFrame(frame);
    frame=0;
    shell.classList.remove("has-refractive-glass");
    glassCanvas.hidden=true;
    gl=null;
  }
  function onViewportChange(){redrawWallpaper();invalidate();}
  function onVisibility(){if(!doc.hidden)invalidate();}
  const observer=typeof ResizeObserver!=="undefined"?
    new ResizeObserver(invalidate):null;
  observer?.observe(sidebar);
  win.addEventListener("resize",onViewportChange,{passive:true});
  sidebar.addEventListener("pointermove",onPointer,{passive:true});
  sidebar.addEventListener("pointerleave",onLeave,{passive:true});
  glassCanvas.addEventListener("webglcontextlost",onLost);
  doc.addEventListener("visibilitychange",onVisibility);
  invalidate();
  return {
    get active(){return !!gl;},
    invalidate,
    setScene(index) {
      if(!Number.isInteger(index)||index<0||index>=BACKDROP_SCENES.length)
        throw new RangeError("unsupported glass scene");
      scene=index;
      redrawWallpaper();
    },
    setLens(value){lensEnabled=!!value;invalidate();},
    dispose(){
      disposed=true;
      if(frame)win.cancelAnimationFrame(frame);
      observer?.disconnect();
      win.removeEventListener("resize",onViewportChange);
      sidebar.removeEventListener("pointermove",onPointer);
      sidebar.removeEventListener("pointerleave",onLeave);
      glassCanvas.removeEventListener("webglcontextlost",onLost);
      doc.removeEventListener("visibilitychange",onVisibility);
      if(gl){
        if(texture)gl.deleteTexture(texture);
        if(buffer)gl.deleteBuffer(buffer);
        if(program)gl.deleteProgram(program);
      }
      shell.classList.remove("has-refractive-glass","has-glass-wallpaper");
      wallpaper.remove();
    }
  };
}
