/*
 * Isolated Dashboard preview tint. All observed constants come from
 * E-P-SWIFTUI-TINT-SCHEME-NATIVE-FINITE (25F80/M2/G14G).
 * The native witness captures 104 cases x 2 identical processes.
 * Its extra 80-byte vibrantColorMatrix has measured coefficients that
 * differ by color scheme and a measured opacity in lane 18.
 * IMPORTANT: the matrix is NOT a proved public tint-hue RGB transform.
 * Do not evaluate it against the tint color. The separately captured
 * native Clear face white/black endpoints drive an explicitly provisional
 * browser tone map; hue and source-over blending remain browser adapters.
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
  orange:Object.freeze({rgb:[1,.38,0],opacity:.75,label:"Orange"}),
  yellow:Object.freeze({rgb:[1,.91,0],opacity:.75,label:"Yellow"}),
  green:Object.freeze({rgb:[0,1,0],opacity:.5,label:"Green"}),
  teal:Object.freeze({rgb:[0,.67,.63],opacity:.75,label:"Teal"}),
  cyan:Object.freeze({rgb:[0,.91,1],opacity:.75,label:"Cyan"}),
  blue:Object.freeze({rgb:[0,0,1],opacity:.25,label:"Blue"}),
  indigo:Object.freeze({rgb:[.27,.22,1],opacity:.75,label:"Indigo"}),
  purple:Object.freeze({rgb:[.58,.24,.95],opacity:.75,label:"Purple"}),
  magenta:Object.freeze({rgb:[1,0,.78],opacity:.75,label:"Magenta"}),
  pink:Object.freeze({rgb:[1,.38,.69],opacity:.75,label:"Pink"}),
  white:Object.freeze({rgb:[1,1,1],opacity:.99,label:"White"}),
  black:Object.freeze({rgb:[0,0,0],opacity:1,label:"Black"})
});
export const OBSERVED_OPACITIES=Object.freeze([0,.125,.25,.37,.5,.75,.95,.99,1]);
// 14 visible comparison states x 3 observed public opacity inputs = 42
// squares. New hues are authored sRGB controls, not native-recovered hues.
export const SHOWCASE_TINTS=Object.freeze([
  "none","red","orange","yellow","green","teal","cyan",
  "blue","indigo","purple","magenta","pink","white","black"
]);
export const SHOWCASE_OPACITIES=Object.freeze([.37,.75,1]);

// 25F80/M2, SwiftUI Glass.clear light/dark inputFaceColorMatrixWhite/Black
// and inputFaceColorMatrixFillColor (white alpha) recorded by
// E-P-SWIFTUI-TINT-SCHEME-NATIVE-FINITE. The INPUT values are observed.
// Their application as linear RGB endpoints is an unproved browser adapter.
export const CLEAR_FACE_INPUTS=Object.freeze({
  light:Object.freeze({white:Math.fround(.95),black:Math.fround(.2),
    fillWhiteAlpha:Math.fround(.1)}),
  dark:Object.freeze({white:Math.fround(.8),black:Math.fround(.05),
    fillWhiteAlpha:Math.fround(.05)})
});
export const BROWSER_TINT_FILM_STRENGTH=.25;
const HEX_COLOR=/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
export function normalizeTintHex(hex){
  if(typeof hex!=="string")throw new TypeError("Hex tint must be a string");
  const token=hex.startsWith("#")?hex:"#"+hex;
  if(!HEX_COLOR.test(token))throw new RangeError("Hex tint must be RGB or RRGGBB");
  const chars=token.slice(1).toLowerCase();
  return "#"+(chars.length===3?[...chars].map(c=>c+c).join(""):chars);
}
export function rgbFromHex(hex){
  const code=normalizeTintHex(hex).slice(1);
  return Object.freeze([0,2,4].map(i=>Math.fround(parseInt(code.slice(i,i+2),16)/255)));
}
export function browserFaceColor(rgb,scheme="dark"){
  const face=CLEAR_FACE_INPUTS[scheme];
  if(!face)throw new RangeError("Unknown scheme");
  if(!Array.isArray(rgb)||rgb.length!==3||rgb.some(v=>!Number.isFinite(v)))
    throw new TypeError("Finite RGB triplet required");
  return rgb.map(v=>Math.fround(clamp(face.black+(face.white-face.black)*clamp(v))));
}
export function browserTintColor(backdrop,material){
  const face=browserFaceColor(backdrop,material.scheme);
  const alpha=material.active?material.opacity*BROWSER_TINT_FILM_STRENGTH:0;
  return face.map((v,i)=>Math.fround(v*(1-alpha)+material.rgb[i]*alpha));
}
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
  if(scheme!=="light"&&scheme!=="dark")throw new RangeError("Unknown scheme");
  if(name==="showcase"){
    const strength=opacity===undefined?1:Number(opacity);
    if(!Number.isFinite(strength)||strength<0||strength>1)
      throw new RangeError("Showcase strength must be [0,1]");
    return Object.freeze({
      name,opacity:Math.fround(strength),scheme,active:true,mixed:true,
      rgb:Object.freeze([0,0,0]),filterCount:null,observedOpacity:false,
      evidenceId:"E-P-SWIFTUI-TINT-SCHEME-NATIVE-FINITE",
      nativeHueProven:false,nativeCompositorProven:false
    });
  }
  const hex=typeof name==="string"&&HEX_COLOR.test(name)?normalizeTintHex(name):null;
  const entry=hex?{rgb:rgbFromHex(hex),opacity:.75,label:hex}:TINT_COLORS[name];
  if(!entry)throw new RangeError("Unknown tint preset");
  const rawOpacity=opacity===undefined?entry.opacity:Number(opacity);
  if(!Number.isFinite(rawOpacity)||rawOpacity<0||rawOpacity>1)throw new RangeError("Invalid opacity");
  const active=name!=="none";
  // Keep measured nativeTintMatrix() available for exact input regression,
  // but never apply its scheme-dependent vibrancy offsets to hue RGB:
  // doing so inverted apparent light/dark brightness in the old preview.
  // These palette entries are explicitly authored sRGB values.
  const rgb=entry.rgb.map(x=>Math.fround(x));
  return Object.freeze({
    name:hex||name,opacity:Math.fround(active?rawOpacity:0),scheme,active,
    rgb:Object.freeze(rgb),filterCount:active?3:2,
    observedOpacity:active&&OBSERVED_OPACITIES.some(v=>Math.fround(v)===Math.fround(rawOpacity)),
    evidenceId:"E-P-SWIFTUI-TINT-SCHEME-NATIVE-FINITE",
    nativeHueProven:false,nativeCompositorProven:false
  });
}
// Resolve one tile, preserving the native matrix parameters but explicitly
// not claiming that the browser color stage reproduces native execution.
export function tintForTile(state,index){
  if(!Number.isSafeInteger(index)||index<0)
    throw new RangeError("Nonnegative tile index required");
  if(state.name!=="showcase")return state;
  const name=SHOWCASE_TINTS[index%SHOWCASE_TINTS.length];
  const tier=SHOWCASE_OPACITIES[Math.floor(index/SHOWCASE_TINTS.length)%
    SHOWCASE_OPACITIES.length];
  return tintParameters(name,name==="none"?0:Math.min(1,tier*state.opacity),state.scheme);
}
export function createTintControls(onChange){
  const query=new URLSearchParams(typeof location!=="undefined"?location.search:"");
  // Default is Dark + untinted. Presets, showcase and hex remain available.
  const selected=query.get("tint");
  const initialColor=selected==="showcase"||TINT_COLORS[selected]||
    (typeof selected==="string"&&HEX_COLOR.test(selected))?selected:"none";
  const initialScheme=["light","dark"].includes(query.get("tintScheme"))?query.get("tintScheme"):"dark";
  const rawAlpha=query.get("tintOpacity");
  let state=tintParameters(initialColor,
    rawAlpha!==null&&rawAlpha!==""&&Number.isFinite(Number(rawAlpha))?
      clamp(Number(rawAlpha)):undefined,initialScheme);
  const host=typeof document==="object"?document.getElementById("cta6-mosaic"):null;
  let toggle=null, panel=null,range=null,alphaOut=null,schemeSelect=null,showcaseButton=null;
  const choices=new Map();
  function fallbackStyle(){
    if(!host)return;
    // Browser-only CSS fallback mirrors the per-pane tint assignments
    // and keeps the neutral light/dark face distinct even without tint.
    const face=CLEAR_FACE_INPUTS[state.scheme];
    const tone=state.scheme==="light"?
      "rgba(255,255,255,"+face.fillWhiteAlpha.toFixed(6)+")":
      "rgba(0,0,0,"+face.fillWhiteAlpha.toFixed(6)+")";
    const tiles=[...host.querySelectorAll(".cta6-tile--plain,.cta6-tile--icon")];
    tiles.forEach((tile,index)=>{
      const material=tintForTile(state,index);
      const rgb=material.rgb.map(v=>Math.round(clamp(v)*255));
      const alpha=material.active?material.opacity*.25:0;
      tile.style.setProperty("--dashboard-face-fill",tone);
      tile.style.setProperty("--dashboard-tint-fill",
        material.active?
          "rgba("+rgb.join(",")+","+alpha.toFixed(6)+")":
          "rgba(246,248,250,.065)");
      tile.dataset.glassTint=material.name;
      // Do not replace any existing semantic icon title/tooltip.
      if(!tile.title||tile.dataset.dashboardTintTitle==="true"){
        tile.title=material.name==="none"?"Untinted clear glass":
          (TINT_COLORS[material.name]?.label||material.name)+" - "+
            (material.opacity*100).toFixed(1)+"% tint (browser approximation)";
        tile.dataset.dashboardTintTitle="true";
      }
    });
  }
  function renderUI(){
    fallbackStyle();
    if(!toggle)return;
    toggle.textContent=state.name==="showcase"?"Tint - Mixed showcase":
      "Tint - "+(TINT_COLORS[state.name]?.label||state.name);
    toggle.setAttribute("aria-expanded",String(!panel.hidden));
    showcaseButton?.setAttribute("aria-pressed",String(state.name==="showcase"));
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
    setHex:(hex,opacity)=>apply(normalizeTintHex(hex),opacity,state.scheme),
    setShowcase:strength=>apply("showcase",strength===undefined?1:strength,state.scheme),
    setScheme:scheme=>apply(state.name,state.opacity,scheme),
    get state(){return {...state,rgb:[...state.rgb]}}
  });
  // Hide the old bottom-left panel by default. ?tintUi=1 restores it
  // for future experiments without affecting the hex/preset tint API.
  if(host&&query.get("tintUi")==="1"){
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
    showcaseButton=document.createElement("button");
    showcaseButton.type="button";
    showcaseButton.className="dashboard-tint-showcase";
    showcaseButton.textContent="Mixed showcase - compare all tiles";
    showcaseButton.addEventListener("click",()=>apply("showcase",1,state.scheme));
    panel.append(showcaseButton);
    const explanation=document.createElement("p");
    explanation.className="dashboard-tint-guide";
    explanation.textContent="Fourteen hues and neutral variants across three "+
      "opacity levels. Hover over any block for its color and strength.";
    panel.append(explanation);
    const swatches=document.createElement("div");
    swatches.className="dashboard-tint-swatches";
    for(const [name,option] of Object.entries(TINT_COLORS)){
      const button=document.createElement("button");
      button.type="button";button.className="dashboard-tint-swatch";
      button.dataset.tint=name;
      button.textContent=option.label;
      button.style.setProperty("--tint-swatch-color",
        "rgb("+option.rgb.map(v=>Math.round(v*255)).join(",")+")");
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
    note.textContent="Observed matrix and face inputs; hue/face output math "+
      "and tint blend are browser approximations.";
    panel.append(note);
    container.append(toggle,panel);
    document.body.append(container);
  }
  renderUI();
  if(typeof window!=="undefined")window.__dashboardTintControls=api;
  return api;
}
