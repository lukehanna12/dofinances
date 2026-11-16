/* Temporary, Collections-only preview controls. Nothing is written to the
 * native/Oracle material model or to a server. Settings live in this tab only.
 * Values are exported explicitly so the owner can request a permanent style.
 */
export const DEFAULT_COLLECTIONS_GLASS_TUNING=Object.freeze({
  brightness:100,contrast:100,tint:"#ffffff",tintStrength:0
});
const STORAGE_KEY="dofinances.collections.clear-strip-preview.v1";
const LIMITS=Object.freeze({brightness:300,contrast:300,tintStrength:100});
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const two=v=>Math.round(v*100)/100;
export function normalizeCollectionsGlassTuning(value={}){
  const result={...DEFAULT_COLLECTIONS_GLASS_TUNING};
  for(const field of ["brightness","contrast","tintStrength"]){
    const raw=value?.[field];
    if(raw===undefined||raw===null||String(raw).trim()==="")continue;
    const n=Number(raw);
    if(Number.isFinite(n))result[field]=two(clamp(n,0,LIMITS[field]));
  }
  const hex=String(value?.tint??"").trim().toLowerCase();
  if(/^#?[0-9a-f]{6}$/.test(hex))result.tint="#"+hex.replace(/^#/,"");
  else if(/^#?[0-9a-f]{3}$/.test(hex)){
    const short=hex.replace(/^#/,"");
    result.tint="#"+[...short].map(c=>c+c).join("");
  }
  return result;
}
export function collectionsGlassTuningUniforms(raw){
  const s=normalizeCollectionsGlassTuning(raw);
  const rgb=[1,3,5].map(i=>parseInt(s.tint.slice(i,i+2),16)/255);
  // Two vec4<f32>s: brightness, contrast, tint strength, reserved;
  // normalized sRGB tint channels, reserved.
  return new Float32Array([
    s.brightness/100,s.contrast/100,s.tintStrength/100,0,...rgb,0
  ]);
}
export function collectionsGlassTuningPreset(raw){
  const s=normalizeCollectionsGlassTuning(raw);
  return JSON.stringify({
    target:"DoFinances / Collections / Clear strip",
    brightnessPercent:s.brightness,
    contrastPercent:s.contrast,
    tintHex:s.tint,
    tintRGB:[1,3,5].map(i=>parseInt(s.tint.slice(i,i+2),16)),
    tintStrengthPercent:s.tintStrength,
    order:"contrast -> brightness -> tint (browser sRGB)",
    temporaryControlPanel:true
  },null,2);
}
export function createCollectionsGlassTuner({doc=document,win=window,onChange=()=>{}}={}){
  const root=doc.createElement("aside");
  root.id="cs-glass-tuner";
  root.className="cs-glass-tuner";
  root.setAttribute("aria-label","Temporary Collections glass tuning");
  root.innerHTML=[
    '<div class="cs-glass-tuner-drag" title="Drag to move the tuning panel" aria-label="Drag to reposition tuning panel">',
    '<span aria-hidden="true">⠿</span> Drag to reposition</div>',
    '<details open><summary><span class="cs-glass-tuner-head">',
    '<strong>Glass tuning</strong><small>Temporary · Collections only</small>',
    '</span><span class="cs-glass-tuner-chevron" aria-hidden="true">⌄</span></summary>',
    '<div class="cs-glass-tuner-body">',
    '<p class="cs-glass-tuner-intro">Live adjustments to the strip only. These are browser preview controls, not native glass coefficients.</p>',
    '<div class="cs-glass-tuner-field">',
    '<label for="cs-glass-brightness">Brightness <output data-cs-output="brightness">100.00%</output></label>',
    '<div class="cs-glass-tuner-value-row"><input id="cs-glass-brightness" data-cs-range="brightness" type="range" min="0" max="300" step="0.1">',
    '<input data-cs-number="brightness" type="number" inputmode="decimal" min="0" max="300" step="0.01" aria-label="Brightness percent">',
    '<span aria-hidden="true">%</span></div></div>',
    '<div class="cs-glass-tuner-field">',
    '<label for="cs-glass-contrast">Contrast <output data-cs-output="contrast">100.00%</output></label>',
    '<div class="cs-glass-tuner-value-row"><input id="cs-glass-contrast" data-cs-range="contrast" type="range" min="0" max="300" step="0.1">',
    '<input data-cs-number="contrast" type="number" inputmode="decimal" min="0" max="300" step="0.01" aria-label="Contrast percent">',
    '<span aria-hidden="true">%</span></div></div>',
    '<div class="cs-glass-tuner-field">',
    '<label for="cs-glass-color">Tint color <output data-cs-output="tint">#ffffff</output></label>',
    '<div class="cs-glass-tuner-picker-row">',
    '<input id="cs-glass-color" data-cs-picker type="color" value="#ffffff" aria-label="Choose tint with full color picker">',
    '<button type="button" data-cs-open-picker class="cs-glass-tuner-picker-button">Color picker…</button>',
    '<input data-cs-hex type="text" value="#ffffff" spellcheck="false" maxlength="7" aria-label="Tint hexadecimal color" placeholder="#rrggbb">',
    '</div><div class="cs-glass-tuner-rgb">',
    '<label>R <input data-cs-rgb="r" aria-label="Red channel 0 to 255" type="number" min="0" max="255" step="1"></label>',
    '<label>G <input data-cs-rgb="g" aria-label="Green channel 0 to 255" type="number" min="0" max="255" step="1"></label>',
    '<label>B <input data-cs-rgb="b" aria-label="Blue channel 0 to 255" type="number" min="0" max="255" step="1"></label>',
    '</div></div>',
    '<div class="cs-glass-tuner-field">',
    '<label for="cs-glass-tint-strength">Tint strength <output data-cs-output="tintStrength">0.00%</output></label>',
    '<div class="cs-glass-tuner-value-row"><input id="cs-glass-tint-strength" data-cs-range="tintStrength" type="range" min="0" max="100" step="0.1">',
    '<input data-cs-number="tintStrength" type="number" inputmode="decimal" min="0" max="100" step="0.01" aria-label="Tint strength percent">',
    '<span aria-hidden="true">%</span></div></div>',
    '<div class="cs-glass-tuner-export-heading"><span>Exact settings · updates live</span></div>',
    '<textarea data-cs-preset readonly spellcheck="false" aria-label="Copyable exact glass tuning values"></textarea>',
    '<div class="cs-glass-tuner-actions">',
    '<button type="button" data-cs-reset>Reset to original</button>',
    '<button type="button" data-cs-copy>Copy values</button>',
    '</div>',
    '<p data-cs-preview-status class="cs-glass-tuner-status" role="status">Preparing WebGPU preview…</p>',
    '</div></details>'
  ].join("");
  doc.body.appendChild(root);
  let saved;
  try{saved=JSON.parse(win.sessionStorage?.getItem(STORAGE_KEY)||"null");}catch{}
  let state=normalizeCollectionsGlassTuning(saved||DEFAULT_COLLECTIONS_GLASS_TUNING);
  const one=selector=>root.querySelector(selector);
  const rgbFields=["r","g","b"];
  const rgb=()=>[1,3,5].map(i=>parseInt(state.tint.slice(i,i+2),16));
  function render(){
    for(const field of ["brightness","contrast","tintStrength"]){
      one('[data-cs-range="'+field+'"]').value=String(state[field]);
      const number=one('[data-cs-number="'+field+'"]');
      if(doc.activeElement!==number)number.value=state[field].toFixed(2);
      one('[data-cs-output="'+field+'"]').textContent=state[field].toFixed(2)+"%";
    }
    const picker=one("[data-cs-picker]"),hex=one("[data-cs-hex]");
    picker.value=state.tint;
    if(doc.activeElement!==hex)hex.value=state.tint;
    one('[data-cs-output="tint"]').textContent=state.tint;
    rgb().forEach((value,i)=>{
      const field=one('[data-cs-rgb="'+rgbFields[i]+'"]');
      if(doc.activeElement!==field)field.value=String(value);
    });
    one("[data-cs-preset]").value=collectionsGlassTuningPreset(state);
    one("[data-cs-copy]").textContent="Copy values";
  }
  function apply(update){
    state=normalizeCollectionsGlassTuning({...state,...update});
    try{win.sessionStorage?.setItem(STORAGE_KEY,JSON.stringify(state));}catch{}
    render();
    onChange({...state});
  }
  function input(event){
    const el=event.target;
    const field=el.dataset?.csRange||el.dataset?.csNumber;
    if(field&&Object.hasOwn(LIMITS,field)){
      if(el.value.trim()===""||!Number.isFinite(Number(el.value)))return;
      apply({[field]:Number(el.value)});
      return;
    }
    if(el.hasAttribute("data-cs-picker")){apply({tint:el.value});return;}
    if(el.hasAttribute("data-cs-hex")){
      const valid=/^#?[0-9a-f]{6}$/i.test(el.value.trim())||
        /^#?[0-9a-f]{3}$/i.test(el.value.trim());
      el.setAttribute("aria-invalid",String(!valid));
      if(valid)apply({tint:el.value});
      return;
    }
    if(el.dataset?.csRgb){
      if(el.value.trim()===""||!Number.isFinite(Number(el.value)))return;
      const values=rgb();
      const i=rgbFields.indexOf(el.dataset.csRgb);
      if(i<0)return;
      values[i]=Math.round(clamp(Number(el.value),0,255));
      apply({tint:"#"+values.map(v=>v.toString(16).padStart(2,"0")).join("")});
    }
  }
  // The separate handle lets the owner move the temporary panel away from
  // anything they want to inspect; it never intercepts the glass itself.
  const drag=one(".cs-glass-tuner-drag");
  let pointerStart=null;
  drag.addEventListener("pointerdown",event=>{
    if(event.pointerType==="mouse"&&event.button!==0)return;
    const r=root.getBoundingClientRect();
    pointerStart={id:event.pointerId,x:event.clientX,y:event.clientY,left:r.left,top:r.top};
    drag.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  drag.addEventListener("pointermove",event=>{
    if(!pointerStart||event.pointerId!==pointerStart.id)return;
    const x=clamp(pointerStart.left+event.clientX-pointerStart.x,8,
      Math.max(8,win.innerWidth-root.offsetWidth-8));
    const y=clamp(pointerStart.top+event.clientY-pointerStart.y,8,
      Math.max(8,win.innerHeight-root.offsetHeight-8));
    root.style.left=x+"px";root.style.top=y+"px";
    root.style.right="auto";root.style.bottom="auto";
  });
  for(const name of ["pointerup","pointercancel","lostpointercapture"])
    drag.addEventListener(name,()=>{pointerStart=null;});
  root.addEventListener("input",input);
  root.addEventListener("change",input);
  root.addEventListener("focusout",event=>{
    if(event.target.matches("[data-cs-hex]")){
      event.target.setAttribute("aria-invalid","false");
      event.target.value=state.tint;
    }else if(event.target.matches("[data-cs-number],[data-cs-rgb]")){
      render(); // restore canonical number after editing
    }
  });
  root.addEventListener("click",async event=>{
    const target=event.target.closest("button");
    if(!target)return;
    if(target.hasAttribute("data-cs-reset")){
      try{win.sessionStorage?.removeItem(STORAGE_KEY);}catch{}
      state={...DEFAULT_COLLECTIONS_GLASS_TUNING};
      render();onChange({...state});
    }else if(target.hasAttribute("data-cs-open-picker")){
      const picker=one("[data-cs-picker]");
      try{picker.showPicker();}catch{picker.click();}
    }else if(target.hasAttribute("data-cs-copy")){
      const value=collectionsGlassTuningPreset(state);
      try{
        if(!win.navigator.clipboard?.writeText)throw Error("Clipboard API unavailable");
        await win.navigator.clipboard.writeText(value);
        target.textContent="Copied";
      }catch{
        const field=one("[data-cs-preset]");
        field.focus();field.select();
        // Read-only textarea supports manual copy in restricted browser contexts.
        target.textContent="Select and copy above";
      }
    }
  });
  render();
  return {
    root,
    get value(){return {...state};},
    setVisible(visible){root.hidden=!visible;},
    setPreviewStatus(status){
      one("[data-cs-preview-status]").textContent=
        status==="ready"?"Live WebGPU preview active":
        status==="fallback"||status==="device-lost"?
          "WebGPU unavailable — values still copyable":
        "Preparing WebGPU preview…";
    },
    dispose(){root.remove();}
  };
}
