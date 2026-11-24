/**
 * Shared public dropdown surface. Native evidence: E-P-APPKIT-POPUP-MENU-FILTER-FINITE,
 * 25F80 / Apple M2 / G14G. Two active processes, 2/4/8 native popup rows in
 * each scheme; finite filter inputs, not a universal native output law.
 * The native menu is neither the public Clear nor the public Regular profile.
 */
import {observedBlurWord} from "./sidebar-glass-oracle.js";
export const GLASS_DROPDOWN_METRICS=Object.freeze({
 cornerRadius:12,inset:5,rowHeight:24,rowRadius:7,
 nativeInputLayerScale:.25,rowBackdropScale:.125,rowBlurRadius:30,
 rowFillOpacity:.75
});
export const DROPDOWN_ACCENT=Object.freeze({
 light:Object.freeze([.03922000527381897,.5098000168800354,1]),
 dark:Object.freeze([.09020001450005832,.413474287014596,.9011678930430325])
});
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function resolveDropdownMaterial({width,height,scale=1,scheme="dark",row=[0,0,0,0]}={}){
 if(![width,height,scale].every(v=>Number.isFinite(v)&&v>0))throw new RangeError("Positive finite dropdown geometry required");
 if(!["dark","light"].includes(scheme))throw new RangeError("Unknown dropdown scheme");
 if(!Array.isArray(row)||row.length!==4||row.some(v=>!Number.isFinite(v))||row[2]<0||row[3]<0)throw new RangeError("Finite dropdown row bounds required");
 const d=Math.min(width,height),light=scheme==="light";
 // Fitted finite input curve, reproducing observed d=58,87,94,190.
 // Outside the measured domain, bounded interpolation/extrapolation is authored.
 const radius=clamp(1+(d-34)/42,1,4);
 return Object.freeze({material:"dropdown",scheme,minDimension:d,
  innerAmount:Math.max(-60,-.8*d)*scale,innerHeight:Math.min(20,.25*d)*scale,
  outerAmount:.2*d*scale,outerHeight:.125*d*scale,
  nativeInputBlurRadius:radius,nativeInputLayerScale:.25,
  blurWord:observedBlurWord(radius,1,.25),lodBias:2,
  faceBlack:light?.5:Math.fround(.2),faceWhite:light?Math.fround(1.03):Math.fround(.6),
  faceFillGray:light?1:0,faceFillAlpha:Math.fround(.4),
  rowRadius:GLASS_DROPDOWN_METRICS.rowRadius*scale,
  // Explicit GPU mip footprint projection of native Gaussian input; exact
  // CoreAnimation Gaussian kernel/row backdrop compositor remain unproved.
  rowLOD:Math.log2(Math.max(1,GLASS_DROPDOWN_METRICS.rowBlurRadius*scale)),
  row:Object.freeze(row.map(v=>v*scale)),
  faceScope:"finite native menu filter inputs; browser endpoint/fill projection"
 });
}
// Preserve the existing 16-float material ABI. Type=2 is a new profile,
// independently selected from route tags, and does not change Clear/Regular.
export function dropdownMaterialLanes(p){
 return [2,p.innerAmount,p.innerHeight,p.lodBias,
  p.outerAmount,p.outerHeight,p.faceBlack,p.faceWhite,
  p.faceFillGray,p.faceFillAlpha,p.rowRadius,p.rowLOD,...p.row];
}
export function dropdownRowBounds(panel){
 if(!panel||panel.inert||panel.hidden)return [0,0,0,0];
 const option=panel.querySelector("[data-glass-dropdown-option]:focus-visible:not(:disabled):not([aria-disabled=true])")||
   panel.querySelector("[data-glass-dropdown-option]:hover:not(:disabled):not([aria-disabled=true])");
 if(!option)return [0,0,0,0];
 const p=panel.getBoundingClientRect(),r=option.getBoundingClientRect();
 return [r.left-p.left,r.top-p.top,r.width,r.height];
}
/** Mark any panel in the public shell's route stage as a native-profile
 * dropdown. The caller owns opening, selection and domain actions. This
 * helper owns the reusable surface registration and keyboard row navigation.
 * Ordinary HTML buttons remain the accessible foreground, no optical CSS.
 */
export function registerGlassDropdown(panel,{options}={}){
 if(!panel?.setAttribute)throw new TypeError("Dropdown panel element required");
 panel.setAttribute("data-glass-dropdown","");
 panel.setAttribute("data-glass-material","dropdown");
 panel.setAttribute("data-glass-backdrop-layer","2");
 for(const node of options??panel.querySelectorAll("button,[role=menuitem],[role=option]"))node.setAttribute("data-glass-dropdown-option","");
 const abort=new AbortController(),wake=()=>window.dispatchEvent(new Event("dofinances:glass-dropdown-change"));
 for(const type of ["pointerover","pointerout","focusin","focusout"])panel.addEventListener(type,wake,{signal:abort.signal});
 panel.addEventListener("keydown",event=>{
  if(!["ArrowUp","ArrowDown","Home","End"].includes(event.key))return;
  const rows=[...panel.querySelectorAll("[data-glass-dropdown-option]:not(:disabled):not([aria-disabled=true])")].filter(el=>!el.hidden);
  if(!rows.length)return;
  const i=rows.indexOf(panel.ownerDocument.activeElement);
  const next=event.key==="Home"?0:event.key==="End"?rows.length-1:
   event.key==="ArrowDown"?(i+1)%rows.length:(i<0?rows.length-1:(i+rows.length-1)%rows.length);
  rows[next].focus({preventScroll:true});event.preventDefault();wake();
 },{signal:abort.signal});
 return ()=>{abort.abort();panel.removeAttribute("data-glass-dropdown");panel.removeAttribute("data-glass-material");panel.removeAttribute("data-glass-backdrop-layer");wake()};
}
