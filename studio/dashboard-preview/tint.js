/*
 * Isolated Dashboard preview tint. All observed constants come from
 * E-P-SWIFTUI-TINT-SCHEME-NATIVE-FINITE (25F80/M2/G14G).
 * The native witness captures 104 cases x 2 identical processes.
 * Its extra 80-byte vibrantColorMatrix has measured RGB coefficients
 * that differ by color scheme and a measured opacity in lane 18.
 *
 * IMPORTANT: neither the hue producer nor GPU execution/compositor is
 * recovered. A conventional 4x5 matrix evaluation and source-over tint
 * strength are explicitly browser adapters, not native proofs.
 */
const BITS=Object.freeze({
  light:Object.freeze([0x3f438716,0x3e5ba804,0x3cb1dd2e,0,0xbdccccd0,
    0x3d82a470,0x3f6a2071,0x3cb16024,0,0xbdccccd0,
    0x3d828c18,0x3e5bbf20,0x3f38beb6,0,0xbdccccd0,
    0,0,0,0x3f800000,0]),
  dark:Object.freeze([0x3f438716,0x3e5ba804,0x3cb1dd2e,0,0x3dccccd0,
    0x3d82a470,0x3f6a2071,0x3cb16024,0,0x3dccccc8,
    0x3d828c18,0x3e5bbf20,0x3f38beb6,0,0x3dccccc8,
    0,0,0,0x3f800000,0])
});
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const TINT_COLORS=Object.freeze({
  none:Object.freeze({rgb:[0,0,0],opacity:0,label:"None"}),
  red:Object.freeze({rgb:[1,0,0],opacity:.37,label:"Red"}),
  blue:Object.freeze({rgb:[0,0,1],opacity:.25,label:"Blue"}),
  green:Object.freeze({rgb:[0,1,0],opacity:.5,label:"Green"}),
  white:Object.freeze({rgb:[1,1,1],opacity:.99,label:"White"}),
  black:Object.freeze({rgb:[0,0,0],opacity:1,label:"Black"})
});
export const OBSERVED_OPACITIES=Object.freeze([0,.125,.25,.37,.5,.75,.95,.99,1]);
export function nativeTintMatrix(scheme="dark",opacity=1){
  const bits=BITS[scheme];
  if(!bits)throw new RangeError("light/dark color scheme required");
  if(!Number.isFinite(opacity)||opacity<0||opacity>1)throw new RangeError("Tint opacity must be [0,1]");
  const out=new Float32Array(20),view=new DataView(out.buffer);
  for(let i=0;i<bits.length;i++)view.setUint32(i*4,bits[i],true);
  // The exact captured extra matrix alpha lane, unlike the RGB hue producer.
  out[18]=Math.fround(opacity);
  return out;
}
export function tintParameters(name="none",opacity,scheme="dark"){
  const entry=TINT_COLORS[name];
  if(!entry)throw new RangeError("Unknown tint preset");
  if(scheme!=="light"&&scheme!=="dark")throw new RangeError("Unknown scheme");
  const rawOpacity=opacity===undefined?entry.opacity:Number(opacity);
  if(!Number.isFinite(rawOpacity)||rawOpacity<0||rawOpacity>1)throw new RangeError("Invalid opacity");
  const active=name!=="none";
  const matrix=nativeTintMatrix(scheme,active?rawOpacity:0);
  const c=entry.rgb;
  // GAP TINT-RGB-PRODUCER: conventional 4x5 evaluation of recorded input
  // coefficients, not proved native filter execution. Clamp to RGB gamut.
  const rgb=[0,1,2].map(row=>clamp(Math.fround(
    Math.fround(matrix[row*5]*c[0])+
    Math.fround(matrix[row*5+1]*c[1])+
    Math.fround(matrix[row*5+2]*c[2])+
    matrix[row*5+4])));
  return Object.freeze({
    name,opacity:Math.fround(active?rawOpacity:0),scheme,active,
    rgb:Object.freeze(rgb),filterCount:active?3:2,
    observedOpacity:active&&OBSERVED_OPACITIES.some(v=>Math.fround(v)===Math.fround(rawOpacity)),
    evidenceId:"E-P-SWIFTUI-TINT-SCHEME-NATIVE-FINITE",
    nativeHueProven:false,nativeCompositorProven:false
  });
}
export function createTintControls(onChange){
  const query=new URLSearchParams(typeof location!=="undefined"?location.search:"");
  const initialColor=TINT_COLORS[query.get("tint")]?query.get("tint"):"none";
  const initialScheme=["light","dark"].includes(query.get("tintScheme"))?query.get("tintScheme"):"dark";
  const rawAlpha=query.get("tintOpacity");
  let state=tintParameters(initialColor,
    rawAlpha!==null&&rawAlpha!==""&&Number.isFinite(Number(rawAlpha))?
      clamp(Number(rawAlpha)):undefined,initialScheme);
  const host=typeof document==="object"?document.getElementById("cta6-mosaic"):null;
  let toggle=null, panel=null,range=null,alphaOut=null,schemeSelect=null;
  const choices=new Map();
  function fallbackStyle(){
    if(!host)return;
    const alpha=state.active?state.opacity*.25:0;
    const values=state.rgb.map(v=>Math.round(clamp(v)*255));
    document.documentElement.style.setProperty("--dashboard-tint-fill",
      state.active?"rgba("+values.join(",")+","+alpha.toFixed(6)+")":
      "rgba(246,248,250,.065)");
  }
  function renderUI(){
    fallbackStyle();
    if(!toggle)return;
    toggle.textContent="Tint · "+TINT_COLORS[state.name].label;
    toggle.setAttribute("aria-expanded",String(!panel.hidden));
    for(const [key,button] of choices){
      button.setAttribute("aria-pressed",String(state.name===key));
    }
    range.value=String(state.opacity);
    range.disabled=!state.active;
    alphaOut.textContent=state.opacity.toFixed(3);
    schemeSelect.value=state.scheme;
  }
  function apply(name,opacity,scheme){
    const next=tintParameters(name,opacity,scheme);
    state=next;
    renderUI();
    onChange?.();
    return next;
  }
  const api=Object.freeze({
    read:()=>({...state,rgb:[...state.rgb]}),
    setTint:(name,opacity)=>apply(name,opacity,state.scheme),
    setScheme:scheme=>apply(state.name,state.opacity,scheme),
    get state(){return {...state,rgb:[...state.rgb]}}
  });
  if(host){
    const container=document.createElement("aside");
    container.className="dashboard-tint-tool";
    container.setAttribute("aria-label","Glass tint controls");
    toggle=document.createElement("button");
    toggle.className="dashboard-tint-toggle";
    toggle.type="button";
    toggle.setAttribute("aria-controls","dashboard-tint-panel");
    panel=document.createElement("div");
    panel.id="dashboard-tint-panel";
    panel.className="dashboard-tint-panel";
    panel.hidden=true;
    toggle.addEventListener("click",()=>{
      panel.hidden=!panel.hidden;renderUI();
    });
    const heading=document.createElement("div");
    heading.className="dashboard-tint-heading";
    heading.textContent="Clear glass tint";
    panel.append(heading);
    const swatches=document.createElement("div");
    swatches.className="dashboard-tint-swatches";
    for(const [name,option] of Object.entries(TINT_COLORS)){
      const button=document.createElement("button");
      button.type="button";button.className="dashboard-tint-swatch";
      button.dataset.tint=name;
      button.textContent=option.label;
      button.setAttribute("aria-label",option.label+" tint");
      button.addEventListener("click",()=>apply(name,undefined,state.scheme));
      choices.set(name,button);swatches.append(button);
    }
    panel.append(swatches);
    const alphaLabel=document.createElement("label");
    alphaLabel.className="dashboard-tint-label";
    alphaLabel.htmlFor="dashboard-tint-opacity";
    alphaLabel.append(document.createTextNode("Opacity "));
    alphaOut=document.createElement("output");
    alphaLabel.append(alphaOut);
    range=document.createElement("input");
    range.type="range";range.id="dashboard-tint-opacity";
    range.min="0";range.max="1";range.step=".005";
    range.addEventListener("input",()=>apply(state.name,Number(range.value),state.scheme));
    panel.append(alphaLabel,range);
    const schemeLabel=document.createElement("label");
    schemeLabel.className="dashboard-tint-label";
    schemeLabel.htmlFor="dashboard-tint-scheme";
    schemeLabel.textContent="Appearance";
    schemeSelect=document.createElement("select");
    schemeSelect.id="dashboard-tint-scheme";
    for(const name of ["dark","light"]){
      const option=document.createElement("option");
      option.value=name;option.textContent=name[0].toUpperCase()+name.slice(1);
      schemeSelect.append(option);
    }
    schemeSelect.addEventListener("change",()=>apply(state.name,state.opacity,schemeSelect.value));
    panel.append(schemeLabel,schemeSelect);
    const note=document.createElement("p");
    note.className="dashboard-tint-note";
    note.textContent="Native matrix and opacity inputs; visual blend remains experimental.";
    panel.append(note);
    container.append(toggle,panel);
    document.body.append(container);
    renderUI();
  }
  if(typeof window!=="undefined")window.__dashboardTintControls=api;
  return api;
}
