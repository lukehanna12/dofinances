/*
 * Liquid Plexiglass browser experiment. This is an optical approximation,
 * not a reverse-engineered Apple Q/S/R/C implementation.
 *
 * Keep the real workspace-nav.js as the sole owner of breakpoints, routing,
 * sidebar preference and drawer behavior. This module only adds presentation.
 * No network calls, credentials, persistent accounts, or document captures.
 */

export function glassIndicatorGeometry(sidebarNavigation, activeLink) {
  const nav = sidebarNavigation.getBoundingClientRect();
  const link = activeLink.getBoundingClientRect();
  if (!(nav.width > 0 && link.width > 0 && link.height > 0)) return null;
  return {
    x: link.left - nav.left + sidebarNavigation.scrollLeft,
    y: link.top - nav.top + sidebarNavigation.scrollTop,
    width: link.width,
    height: link.height
  };
}

const VERTEX = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// A deliberately narrow approximation of an optical material: thin specular
// rims, smooth glints, diffuse grazing-light reflection and subpixel grain.
// No fake sampling of DOM pixels: CSS backdrop-filter supplies that material
// layer. The retained Oracle evidence does not identify the runtime Q chain.
const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_size;
uniform vec2 u_pointer;
uniform float u_strength;
uniform float u_time;
out vec4 outColor;

float gauss(float x, float s) {
  float q = x / max(s, .001);
  return exp(-q*q);
}
float noise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453);
}
void main() {
  vec2 p = vec2(v_uv.x*u_size.x, (1.0-v_uv.y)*u_size.y);
  vec2 cursor = u_pointer*u_size;
  float rimR = gauss(u_size.x - p.x, 2.6);
  float rimRSoft = gauss(u_size.x - p.x, 13.0);
  float rimL = gauss(p.x, 4.5);
  float rimTop = gauss(p.y, 3.0);
  float rimBottom = gauss(u_size.y-p.y, 4.0);
  float grazing = gauss(p.x-u_size.x*.91, u_size.x*.23);
  float cursorAlongRim = gauss(p.y-cursor.y, u_size.y*.13);
  float cursorDistance = length((p-cursor)/vec2(90.0,155.0));
  float glint = exp(-cursorDistance*cursorDistance*1.9)*u_strength;
  float movingEdge = (rimR*.30 + rimRSoft*.13) *
                     (.6 + .75*cursorAlongRim*u_strength);
  float upperLight = .07*rimTop + .034*rimBottom;
  float edgeLight = movingEdge + .045*rimL;
  float bloom = .065*grazing*gauss(p.y-cursor.y,u_size.y*.24)*u_strength;
  float reflected = glint*.045 + bloom + upperLight + edgeLight;
  float grain = (noise(floor(p*1.15+vec2(u_time*.003,0.0)))-.5)*.012;
  float alpha = clamp(reflected + grain, 0.0, .34);
  vec3 tint = mix(vec3(.60,.72,.90),vec3(.93,.97,1.0),
                  clamp(.53+rimR*.45+glint*.24,0.0,1.0));
  outColor = vec4(tint*alpha, alpha);
}`;

function createOpticalRenderer(canvas, sidebar, win, reducedMotion) {
  const gl = canvas.getContext?.("webgl2", {
    alpha: true, premultipliedAlpha: true,
    antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer: false, powerPreference: "low-power"
  });
  if (!gl) return {dispose() {}, invalidate() {}};

  const compile = (kind, source) => {
    const shader = gl.createShader(kind);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader) || "shader compilation failed";
      gl.deleteShader(shader);
      throw new Error(error);
    }
    return shader;
  };
  let program;
  try {
    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(program) || "program link failed");
  } catch {
    canvas.hidden = true;
    return {dispose() {}, invalidate() {}};
  }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  gl.useProgram(program);
  gl.enableVertexAttribArray(gl.getAttribLocation(program, "a_position"));
  gl.vertexAttribPointer(gl.getAttribLocation(program, "a_position"), 2, gl.FLOAT, false, 0, 0);
  const size = gl.getUniformLocation(program,"u_size");
  const pointer = gl.getUniformLocation(program,"u_pointer");
  const strength = gl.getUniformLocation(program,"u_strength");
  const time = gl.getUniformLocation(program,"u_time");
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const target = {x: .78, y: .18, power: .12};
  const current = {x: .78, y: .18, power: .12};
  let raf = 0;
  let disposed = false;
  let width = 0, height = 0;

  function resize() {
    const bounds = sidebar.getBoundingClientRect();
    const ratio = Math.min(1.5, Math.max(1, win.devicePixelRatio || 1));
    const w = Math.max(1, Math.round(bounds.width*ratio));
    const h = Math.max(1, Math.round(bounds.height*ratio));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    width = w;
    height = h;
    gl.viewport(0,0,w,h);
  }
  function draw(stamp) {
    raf = 0;
    if (disposed || win.document.hidden) return;
    resize();
    const easing = reducedMotion.matches ? 1 : .18;
    current.x += (target.x-current.x)*easing;
    current.y += (target.y-current.y)*easing;
    current.power += (target.power-current.power)*easing;
    gl.useProgram(program);
    gl.uniform2f(size,width,height);
    gl.uniform2f(pointer,current.x,current.y);
    gl.uniform1f(strength,current.power);
    gl.uniform1f(time,reducedMotion.matches ? 0 : stamp);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES,0,6);
    const residual = Math.abs(current.x-target.x)+Math.abs(current.y-target.y)+
                     Math.abs(current.power-target.power);
    if (!reducedMotion.matches && residual>.002) invalidate();
  }
  function invalidate() {
    if (!disposed && !raf && !win.document.hidden) raf=win.requestAnimationFrame(draw);
  }
  function move(event) {
    if (reducedMotion.matches) return;
    const rect = sidebar.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    target.x = Math.min(1,Math.max(0,(event.clientX-rect.left)/rect.width));
    target.y = Math.min(1,Math.max(0,(event.clientY-rect.top)/rect.height));
    target.power = 1;
    invalidate();
  }
  function leave() {
    target.power = .12;
    invalidate();
  }
  function contextLost(event) {
    event.preventDefault();
    if (raf) win.cancelAnimationFrame(raf);
    raf=0;
    canvas.hidden=true;
  }
  function visibility() {if(!win.document.hidden) invalidate();}
  sidebar.addEventListener("pointermove",move,{passive:true});
  sidebar.addEventListener("pointerleave",leave,{passive:true});
  canvas.addEventListener("webglcontextlost",contextLost);
  win.document.addEventListener("visibilitychange",visibility);
  const observer = typeof ResizeObserver !== "undefined" ?
    new ResizeObserver(invalidate) : null;
  observer?.observe(sidebar);
  invalidate();
  return {
    invalidate,
    dispose() {
      disposed=true;
      if(raf)win.cancelAnimationFrame(raf);
      observer?.disconnect();
      sidebar.removeEventListener("pointermove",move);
      sidebar.removeEventListener("pointerleave",leave);
      canvas.removeEventListener("webglcontextlost",contextLost);
      win.document.removeEventListener("visibilitychange",visibility);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    }
  };
}

export function initLiquidGlassSidebar(doc=document, win=window) {
  const shell = doc.getElementById("workspace-shell");
  const sidebar = doc.getElementById("workspace-sidebar");
  const navigation = doc.getElementById("sidebar-navigation");
  const topActions = doc.querySelector(".top-actions");
  if (!shell || !sidebar || !navigation || !topActions)
    throw new Error("Real workspace sidebar markup required");
  if (shell.classList.contains("liquid-glass-preview"))
    throw new Error("Glass sidebar already initialized");

  shell.classList.add("liquid-glass-preview");
  const reducedMotion = win.matchMedia("(prefers-reduced-motion: reduce)");
  const canvas = doc.createElement("canvas");
  canvas.className = "glass-optics";
  canvas.setAttribute("aria-hidden","true");
  canvas.setAttribute("role","presentation");
  sidebar.prepend(canvas);
  const optics = createOpticalRenderer(canvas,sidebar,win,reducedMotion);

  const indicator = doc.createElement("div");
  indicator.className = "glass-selection";
  indicator.setAttribute("aria-hidden","true");
  navigation.prepend(indicator);
  let updateFrame = 0;
  let firstLayout = true;
  function updateIndicator() {
    updateFrame=0;
    const active = sidebar.querySelector(
      '.nav-stack:not([hidden]) .nav-link.active');
    const bounds = active && glassIndicatorGeometry(navigation,active);
    if (!bounds) {
      shell.classList.remove("has-glass-indicator");
      return;
    }
    if (firstLayout) {
      indicator.style.transition = "none";
      firstLayout=false;
    } else indicator.style.removeProperty("transition");
    indicator.style.setProperty("--glass-selection-x",bounds.x+"px");
    indicator.style.setProperty("--glass-selection-y",bounds.y+"px");
    indicator.style.setProperty("--glass-selection-width",bounds.width+"px");
    indicator.style.setProperty("--glass-selection-height",bounds.height+"px");
    shell.classList.add("has-glass-indicator");
    if (indicator.style.transition === "none") {
      // Prevent first paint from sliding the capsule from the nav's origin.
      win.requestAnimationFrame(()=>indicator.style.removeProperty("transition"));
    }
  }
  function scheduleIndicator() {
    if (!updateFrame) updateFrame=win.requestAnimationFrame(updateIndicator);
  }
  const mutation = new MutationObserver(scheduleIndicator);
  mutation.observe(sidebar,{subtree:true,attributes:true,attributeFilter:["class","hidden"]});
  const resizeObserver = typeof ResizeObserver !== "undefined" ?
    new ResizeObserver(scheduleIndicator) : null;
  resizeObserver?.observe(sidebar);
  resizeObserver?.observe(navigation);
  navigation.addEventListener("scroll",scheduleIndicator,{passive:true});
  win.addEventListener("resize",scheduleIndicator,{passive:true});
  win.addEventListener("hashchange",scheduleIndicator);
  scheduleIndicator();

  // A preview-only optical calibration scene selector. It changes neither
  // the nav state nor any real account data.
  const scenes = [
    {name:"Aurora",className:""},
    {name:"Neutral",className:"glass-scene-neutral"},
    {name:"Prism",className:"glass-scene-prism"}
  ];
  let scene=0;
  const toggle=doc.createElement("button");
  toggle.type="button";
  toggle.className="glass-scene-toggle";
  toggle.setAttribute("aria-label","Change glass backdrop: Aurora");
  toggle.title="Cycle glass backdrop for visual testing";
  const dot=doc.createElement("span");
  dot.className="glass-scene-dot";
  dot.setAttribute("aria-hidden","true");
  const label=doc.createElement("span");
  toggle.append(dot,label);
  function updateScene() {
    for(const x of scenes) if(x.className) shell.classList.remove(x.className);
    if(scenes[scene].className) shell.classList.add(scenes[scene].className);
    label.textContent="Backdrop: "+scenes[scene].name;
    toggle.setAttribute("aria-label","Change glass backdrop: "+scenes[scene].name);
    optics.invalidate();
  }
  toggle.addEventListener("click",()=>{scene=(scene+1)%scenes.length;updateScene();});
  topActions.prepend(toggle);
  updateScene();

  function cleanup() {
    mutation.disconnect();
    resizeObserver?.disconnect();
    navigation.removeEventListener("scroll",scheduleIndicator);
    win.removeEventListener("resize",scheduleIndicator);
    win.removeEventListener("hashchange",scheduleIndicator);
    if (updateFrame) win.cancelAnimationFrame(updateFrame);
    optics.dispose();
  }
  win.addEventListener("pagehide",cleanup,{once:true});
  return {updateIndicator,cleanup};
}
