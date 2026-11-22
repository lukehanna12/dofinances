/* WebGPU glass: actual GPU mip sampling of the GPU-owned live backdrop.
 * Research authority: liquid-plexiglass-oracle @ 3fd32ed3, 25F80/M2/G14G.
 *
 * Source-backed mathematical stages:
 *   airSupercircleSDF / mode4SDF / mode5SDF: canonical AIR SSA corpus
 *   refractionEnvelope: glass_background_sdf_no_bleed_lph AIR 256-271,
 *                       352-366
 *   blur distribution: same AIR 290-321, refraction-adjusted distance
 *   LOD: same AIR 329-337 / 388-396 / 443-452
 *   geometry fields: foundation/model/geometry_331_compact.json (10 finite)
 *   blur selected input: 52 heldout public geometry, 8 exact encoder joins.
 *
 * GAPS: the precise native mip producer/filter kernel, native LPH shader
 *       full half/f32/G14G rounding equivalence, public clear-state joint
 *       fields, SDF corner writer,
 *       browser presentation colorspace/Q, and universal writer/selection
 *       paths are NOT proven. Constants from separate finite families are
 *       not claimed to be a real joined public clear-style material.
 * We never infer pixel identity from visual matching.
 */
struct Globals {
  viewport: vec4<f32>, // physical W,H,elapsed seconds,DPR
  fit: vec4<f32>,
  pointer: vec4<f32>,  // x,y,enabled,unused
  tint: vec4<f32>,     // matrix-projected RGB and native Float32 opacity lane
  tintMeta: vec4<f32>, // tint branch enabled, dark scheme, native-backdrop optical overlay, reserved
};
struct Tile {
  rect: vec4<f32>,     // x,y,width,height (physical pixels)
  properties: vec4<f32>,   // radius, entrance delay, selected blur word, SDF mode
  cornerRadii: vec4<f32>,  // native logical corner lane order: TL,TR,BR,BL
  interaction: vec4<f32>,  // browser-only hover, press, local X, local Y
  motion: vec4<f32>,       // velocity XY, browser track opacity Z, spare W
};
@group(0) @binding(0) var backdrop: texture_2d<f32>;
@group(0) @binding(1) var<storage,read> tiles: array<Tile>;
@group(0) @binding(2) var<uniform> state: Globals;
@group(0) @binding(3) var<storage,read> tintTiles: array<vec4<f32>>;
// A one-channel, DOM-font-rasterized GLYPH SHAPE only, never a sampled
// wallpaper or pre-rendered glass image. All optical work stays in fsGlass.
@group(0) @binding(4) var titleGlyphAlpha: texture_2d<f32>;

struct Full {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};
@vertex
fn vsCopy(@builtin(vertex_index) i:u32) -> Full {
  var out:Full;
  let uv=vec2<f32>(f32((i<<1u)&2u),f32(i&2u));
  out.uv=uv;
  out.position=vec4<f32>(2.0*uv.x-1.0,1.0-2.0*uv.y,0.0,1.0);
  return out;
}
@fragment
fn fsCopy(input:Full)->@location(0) vec4<f32>{
  let coord=clamp(vec2<i32>(input.position.xy),vec2<i32>(0),
    vec2<i32>(textureDimensions(backdrop,0))-vec2<i32>(1));
  return textureLoad(backdrop,coord,0);
}

struct GlassOut {
  @builtin(position) position: vec4<f32>,
  @location(0) local:vec2<f32>,
  @location(1) @interpolate(flat) tileIndex:u32,
  @location(2) introAlpha:f32,
};
fn ease(t:f32)->f32 {
  // GAP INTERACTION: visual entrance timing approximates original CSS
  // cubic-bezier(.2,.78,.2,1); not a native glass parameter.
  return t*t*(3.0-2.0*t);
}
@vertex
fn vsGlass(@builtin(vertex_index) vertex:u32,
           @builtin(instance_index) instance:u32)->GlassOut{
  var corners=array<vec2<f32>,6>(
    vec2<f32>(0.0,0.0),vec2<f32>(1.0,0.0),vec2<f32>(0.0,1.0),
    vec2<f32>(0.0,1.0),vec2<f32>(1.0,0.0),vec2<f32>(1.0,1.0)
  );
  let tile=tiles[instance];
  let uv=corners[vertex];
  // A negative delay identifies a route-owned DOM glass pane (card or form
  // control). It shares EXACTLY this mosaic shader/pipeline, but not the
  // squares' own intro or dismissal geometry. The DOM Motion transform is
  // already reflected in its live rect from the renderer.
  let authPane=tile.properties.y<0.0;
  let progress=clamp((state.viewport.z-tile.properties.y)/0.4,0.0,1.0);
  let a=select(ease(progress),1.0,authPane);
  let scale=select(0.85+0.15*a,1.0,authPane);
  // Only a slight local expansion; underlying Oracle material coordinates
  // remain unchanged, and no invented large smoke cloud is emitted.
  // Route-owned panes normally keep motion.w=0, preserving sign-in and
  // Projects card optics. The Projects header explicitly reuses the *same*
  // local square dissolution lane while its own route is exiting.
  let dismiss=clamp(tile.motion.w,0.0,1.0);
  let bloom=dismiss*dismiss*(3.0-2.0*dismiss);
  let diffuseScale=vec2<f32>(1.0+0.085*bloom,1.0+0.065*bloom);
  let center=tile.rect.xy+tile.rect.zw*0.5;
  let p=center+(uv-vec2<f32>(0.5))*tile.rect.zw*scale*diffuseScale;
  var out:GlassOut;
  out.position=vec4<f32>(2.0*p.x/state.viewport.x-1.0,
    1.0-2.0*p.y/state.viewport.y,0.0,1.0);
  out.local=uv*tile.rect.zw;
  out.tileIndex=instance;
  out.introAlpha=a;
  return out;
}

// AIR supercircle_sdf returns a <3 x half> vector. If adapter.shader-f16
// is available, round at this actual source conversion point. The fallback
// is Float32 and does NOT claim to reproduce native half arithmetic.
// __ORACLE_HALF_BODY__ is replaced with a WGSL body before compilation.
fn nativeHalf3(v:vec3<f32>)->vec3<f32> {
  __ORACLE_HALF_BODY__
}
// AIR LPH explicit half-to-float boundaries. Keeping these as explicit
// conversions prevents WGSL fast-math from silently eliding source casts.
// G14G precise half operation semantics still requires native validation.
fn nativeHalf1(v:f32)->f32 {
  return nativeHalf3(vec3<f32>(v,0.0,0.0)).x;
}
fn nativeHalf2(v:vec2<f32>)->vec2<f32> {
  return nativeHalf3(vec3<f32>(v,0.0)).xy;
}
fn supercircleSDF(ax:f32,ay:f32,hw:f32,hh:f32,
                  r:f32,bx:f32,by:f32)->vec3<f32>{
  if(r==0.0){
    let d=max(ax-hw,ay-hh);
    return nativeHalf3(vec3<f32>(d,select(0.0,1.0,ax>=hw),
                           select(0.0,1.0,ay>=hh)));
  }
  let ar=abs(r);
  let k=ar*1.5286649465560913;
  let qx=ax-hw;
  let qy=ay-hh;
  let cornerAdj=mix(k,ar,max(bx,by));
  let hx=qx+cornerAdj;
  let hy=qy+cornerAdj;
  let nx0=max(0.0,(qx+k)/k);
  let ny0=max(0.0,(qy+k)/k);
  let rad=length(vec2<f32>(nx0,ny0));
  let big=max(nx0,ny0);
  let small=min(nx0,ny0);
  var u:f32=0.0;
  if(big>0.0){u=clamp(small/big,0.0,1.0);}
  let polynomial=
    (((3.1560099124908447-u*0.9260540008544922)*u
    -3.6412200927734375)*u+1.268030047416687)*u
    +0.2685309946537018;
  let denom=1.0-u*u*clamp(rad,0.0,1.0)*polynomial;
  var inverse:f32=0.0;
  if(denom!=0.0){inverse=1.0/denom;}
  let rounded=rad+1.0-inverse;
  let q2x=max(0.0,nx0*1.5286649465560913-0.5286650061607361);
  let q2y=max(0.0,ny0*1.5286649465560913-0.5286650061607361);
  let smoothValue=length(vec2<f32>(q2x,q2y))*0.6541655659675598+
      0.3458344340324402;
  let a=mix(rounded,smoothValue,bx);
  let b=mix(rounded,smoothValue,by);
  let sign=select(-1.0,1.0,ny0>nx0);
  let control=clamp(0.5-sign+sign*u,0.0,1.0);
  let signed=k*(mix(a,b,control)-1.0);
  let d=min(max(hx,hy),0.0)+signed;
  let n=vec2<f32>(max(hx,0.0),max(hy,0.0));
  let nlen=length(n);
  if(nlen>0.0){
    return nativeHalf3(vec3<f32>(d,n.x/nlen,n.y/nlen));
  }
  return nativeHalf3(vec3<f32>(d,select(0.0,1.0,hx>hy),select(1.0,0.0,hx>hy)));
}
fn cornerFactor(radius:f32,halfSize:f32)->f32{
  if(radius>=0.0){return 1.0;}
  return clamp((-1.5286649465560913-halfSize/radius)*
               -1.891557216644287,0.0,1.0);
}
/* Source: glass_background_sdf_no_bleed_lph AIR lines 864-937.
 * For mode 4, native arg2.z is one positive scalar radius, and arg2.xy
 * are the supercircle blend controls. The 8 retained native same-event joins
 * have (blendX,blendY)=(0,0), transform=identity, normalBlend=0.
 * GAP: public CSS radius -> native scalar producer still not proven.
 */
fn mode4SDF(local:vec2<f32>,size:vec2<f32>,radius:f32)->vec3<f32>{
  let xy=vec2<f32>(local.x-size.x*.5,size.y*.5-local.y);
  let v=supercircleSDF(abs(xy.x),abs(xy.y),size.x*.5,size.y*.5,
                       max(0.0,radius),0.0,0.0);
  let signX=select(-1.0,1.0,xy.x>=0.0);
  let signY=select(-1.0,1.0,xy.y>=0.0);
  // AIR lines 880-933: original Cartesian normal reflection, half
  // multiply and transform, then Y-up -> CSS Y-down.
  return nativeHalf3(vec3<f32>(v.x,v.y*signX,-v.z*signY));
}
/* Source: AIR lines 940-1041 and exact mode-5 CPU state producer.
 * Four signed corner radii are NOT equivalent to four CSS radii by proof.
 * The source signed order is TL,TR,BR,BL and follows native shuffle/order.
 */
fn mode5SDF(local:vec2<f32>,size:vec2<f32>,radii:vec4<f32>)->vec3<f32>{
  let xy=vec2<f32>(local.x-size.x*.5,size.y*.5-local.y);
  let hw=size.x*.5;
  let hh=size.y*.5;
  let r0=radii.x; // top left
  let r1=radii.y; // top right
  let r2=radii.z; // bottom right
  let r3=radii.w; // bottom left
  // AIR lines 943-954: four pairwise signed-radius means followed by
  // exact factor selection (factor=1 for nonnegative pair).
  let f0=cornerFactor((r0+r1)*.5,hw);
  let f1=cornerFactor((r0+r3)*.5,hh);
  let f2=cornerFactor((r3+r2)*.5,hw);
  let f3=cornerFactor((r1+r2)*.5,hh);
  var chosen=supercircleSDF( xy.x, xy.y,hw,hh,r1,f0,f3);
  let topLeft=supercircleSDF(-xy.x, xy.y,hw,hh,r0,f0,f1);
  if(topLeft.x>chosen.x){chosen=vec3<f32>(topLeft.x,-topLeft.y,topLeft.z);}
  let bottomRight=supercircleSDF( xy.x,-xy.y,hw,hh,r2,f2,f3);
  if(bottomRight.x>chosen.x){
    chosen=vec3<f32>(bottomRight.x,bottomRight.y,-bottomRight.z);
  }
  let bottomLeft=supercircleSDF(-xy.x,-xy.y,hw,hh,r3,f2,f1);
  if(bottomLeft.x>chosen.x){
    chosen=vec3<f32>(bottomLeft.x,-bottomLeft.y,-bottomLeft.z);
  }
  // Mode5 AIR lines 994-1039: native normalBlend=0 in retained 8 joins;
  // nonzero normal blend requires its own exact public-state producer.
  return nativeHalf3(vec3<f32>(chosen.x,chosen.y,-chosen.z));
}

/* Analytic CSS round-ended silhouette, not an Apple-native SDF mode.
 * For a square bounds this is a circle; for oblong bounds a capsule.
 * The SAME refraction, LOD, tint and interaction stages consume its
 * normal and signed distance; native mode4/mode5 remain untouched. */
fn cssCapsuleSDF(local:vec2<f32>,size:vec2<f32>)->vec3<f32>{
  let radius=0.5*min(size.x,size.y);
  let segment=max(vec2<f32>(0.0),0.5*(size-2.0*radius));
  let delta=local-0.5*size;
  let offset=delta-clamp(delta,-segment,segment);
  let magnitude=length(offset);
  let normal=select(vec2<f32>(0.0),offset/max(magnitude,0.00001),
    magnitude>0.00001);
  return nativeHalf3(vec3<f32>(magnitude-radius,normal));
}
/* AIR glass_background_sdf_no_bleed_lph lines 256-271 and 352-366:
 * uniform float -> HALF, multiply/saturate in HALF, 2-t, multiply, HALF
 * sqrt/saturate, amount*root, amount-difference; return HALF displacement.
 * The AIR adds d after this for refraction-adjusted blur distance, not UV.
 */
fn refractionEnvelope(d:f32,amount:f32,invHeight:f32)->f32{
  let halfInv=nativeHalf1(invHeight);
  let halfAmount=nativeHalf1(amount);
  let halfDistance=nativeHalf1(d);
  let t=clamp(nativeHalf1(nativeHalf1(-halfDistance)*halfInv),0.0,1.0);
  let twoMinus=nativeHalf1(2.0-t);
  let root=nativeHalf1(sqrt(nativeHalf1(twoMinus*t)));
  let clipped=clamp(root,0.0,1.0);
  let weighted=nativeHalf1(clipped*halfAmount);
  return nativeHalf1(halfAmount-weighted);
}
fn thresholdMix(d:f32)->f32{
  // 0.300048828125, -1, -.5 retained from ONE joint PRIVATE diagnostic.
  // GAP PUBLIC-CLEAR-MATERIAL: not an established public Clear selection.
  return 0.300048828125*clamp((d+1.0)*2.0,0.0,1.0);
}
fn ramp(d:f32,a:f32,b:f32)->f32{
  if(a==b){
    return select(0.0,1.0,d>a);
  }
  return clamp((d-a)/(b-a),0.0,1.0);
}
fn blurDistribution(distance:f32,minDimension:f32)->f32{
  // AIR 290-320, 369-380: 3 Float32 FMA+saturate ramps become half,
  // then half alpha multiplication, ordered half addition, half subtraction.
  // Native alpha=(1,.5,0,-.5); distances=(-.5*d,-1,0,0).
  // Zero-span last ramp uses the retained NaN->0/Inf->clamp branch.
  let near=nativeHalf1(ramp(distance,-0.5*minDimension,-1.0));
  let far=nativeHalf1(ramp(distance,0.0,0.0));
  let weightedNear=nativeHalf1(near*.5);
  let weightedFar=nativeHalf1(far*(-.5));
  let sum=nativeHalf1(nativeHalf1(weightedNear+0.0)+weightedFar);
  return nativeHalf1(1.0-sum);
}
/* AIR 321-337 and 379-397: float blur-word × half distribution -> half,
 * half branch, HALF log2, HALF max(0), then convert to Float32 sampler LOD.
 * In native G14G, exact log2/rounding semantics remain an open SR proof.
 */
fn glassLOD(blurWord:f32,dist:f32)->f32{
  let t=nativeHalf1(blurWord*nativeHalf1(dist));
  let selected=select(t,nativeHalf1(1.0+0.5*t),t<2.0);
  return nativeHalf1(max(0.0,nativeHalf1(log2(max(selected,0.000001)))));
}

/* Fully explicit bilinear+trilinear texture loads. This removes dependence
 * on driver-selected sampleLevel filtering/mipmap generation. The native
 * G14G shader's interpolation/precision is not yet proven equal to these
 * Float32 operations. GAP R-SAMPLING remains documented.
 */
fn levelBilinear(uvIn:vec2<f32>,level:i32)->vec4<f32>{
  let dims=vec2<i32>(textureDimensions(backdrop,level));
  let maxCoord=vec2<f32>(dims-vec2<i32>(1));
  let texel=clamp(uvIn*vec2<f32>(dims)-vec2<f32>(0.5),
                  vec2<f32>(0.0),maxCoord);
  let origin=vec2<i32>(floor(texel));
  let next=min(origin+vec2<i32>(1),dims-vec2<i32>(1));
  let weight=fract(texel);
  let a=textureLoad(backdrop,origin,level);
  let b=textureLoad(backdrop,vec2<i32>(next.x,origin.y),level);
  let c=textureLoad(backdrop,vec2<i32>(origin.x,next.y),level);
  let d=textureLoad(backdrop,next,level);
  let upper=mix(a,b,weight.x);
  let lower=mix(c,d,weight.x);
  return mix(upper,lower,weight.y);
}
fn mipSample(uv:vec2<f32>,lod:f32)->vec4<f32>{
  let maxLevel=f32(textureNumLevels(backdrop)-1u);
  let chosen=clamp(lod,0.0,maxLevel);
  let lo=i32(floor(chosen));
  let hi=min(lo+1,i32(maxLevel));
  return mix(levelBilinear(uv,lo),levelBilinear(uv,hi),fract(chosen));
}

/* Procedural multi-scale opacity field for dismissal only. Continuous
   interpolation prevents pixel-grid breakup. No native shader is claimed. */
fn dissolveHash(p:vec2<f32>)->f32{
  return fract(sin(dot(p,vec2<f32>(127.1,311.7)))*43758.5453);
}
fn dissolveNoise(p:vec2<f32>)->f32{
  let i=floor(p);
  let f=fract(p);
  let blend=f*f*(vec2<f32>(3.0)-2.0*f);
  let a=dissolveHash(i);
  let b=dissolveHash(i+vec2<f32>(1.0,0.0));
  let c=dissolveHash(i+vec2<f32>(0.0,1.0));
  let d=dissolveHash(i+vec2<f32>(1.0,1.0));
  return mix(mix(a,b,blend.x),mix(c,d,blend.x),blend.y);
}
fn dissolveField(p:vec2<f32>)->f32{
  let lower=dissolveNoise(p);
  let middle=dissolveNoise(p*2.03+vec2<f32>(11.3,4.7));
  let upper=dissolveNoise(p*4.07+vec2<f32>(6.2,17.4));
  return (lower*.52+middle*.31+upper*.17);
}
/* The title supplies a live alpha silhouette, not a separate glass
 * appearance. Its local alpha gradient estimates the letterform SDF normal,
 * so the *same* refraction envelope, blur LOD, glass face, rim and hover
 * calculations below apply at the edge of each individual glyph.
 * Normalized r8 input is from locally rasterizing the heading's font
 * (not a DOM screenshot, image capture, or mipmap).
 */
fn titleGlyphField(local:vec2<f32>)->vec4<f32>{
  let limit=vec2<i32>(textureDimensions(titleGlyphAlpha,0))-vec2<i32>(1);
  let p=clamp(vec2<i32>(floor(local)),vec2<i32>(0),limit);
  let a=textureLoad(titleGlyphAlpha,p,0).r;
  let left=textureLoad(titleGlyphAlpha,clamp(p+vec2<i32>(-1,0),vec2<i32>(0),limit),0).r;
  let right=textureLoad(titleGlyphAlpha,clamp(p+vec2<i32>(1,0),vec2<i32>(0),limit),0).r;
  let above=textureLoad(titleGlyphAlpha,clamp(p+vec2<i32>(0,-1),vec2<i32>(0),limit),0).r;
  let below=textureLoad(titleGlyphAlpha,clamp(p+vec2<i32>(0,1),vec2<i32>(0),limit),0).r;
  let gradient=vec2<f32>(right-left,below-above)*0.5;
  let magnitude=length(gradient);
  // alpha increases *inward*, so the outward contour normal is -gradient.
  let outward=select(vec2<f32>(0.0),-gradient/max(magnitude,0.00001),
    magnitude>0.00001);
  // Approximate a local signed contour distance in physical pixels.
  // The true antialiased glyph alpha is kept independently as coverage.
  let distance=clamp((0.5-a)/max(magnitude,0.08),-6.0,6.0);
  return vec4<f32>(distance,outward,a);
}
@fragment
fn fsGlass(in:GlassOut)->@location(0) vec4<f32>{
  let tile=tiles[in.tileIndex];
  let authPane=tile.properties.y<0.0;
  let dimensions=tile.rect.zw;
  // Exact CPU predicate: mode4 iff four NORMALIZED private lanes compare
  // equal using AArch64 FCMP/FCCMP; any inequality/NaN selects mode5.
  // Browser CSS-to-private-lane normalization remains a documented GAP.
  // AIR branches rather than evaluating both branches under eager select:
  // native compute_sdf_with_mode uses an i32 mode gate, so only the selected
  // path participates in arithmetic and its half-return rounding.
  let glassTitle=tile.properties.y == -8.0;
  var field:vec3<f32>;
  var glyphCoverage:f32=1.0;
  if(glassTitle){
    let glyph=titleGlyphField(in.local);
    field=glyph.xyz;
    glyphCoverage=glyph.w;
  }else if(tile.properties.w==6.0){
    field=cssCapsuleSDF(in.local,dimensions);
  }else if(tile.properties.w==4.0){
    field=mode4SDF(in.local,dimensions,tile.properties.x);
  }else{
    field=mode5SDF(in.local,dimensions,tile.cornerRadii);
  }
  let signed=field.x;
  // AIR lines 30-43: SDF is half, fwidth is half, the denominator is
  // max(fwidth,0xH068E), half division then Float32 +0.5/saturate and
  // final truncation to half. Derivatives' exact G14G rules remain open.
  let nativeWidth=max(nativeHalf1(fwidth(signed)),nativeHalf1(0.0001));
  let signedRatio=nativeHalf1(-signed/nativeWidth);
  // For text, use the font rasterizer's own antialiased glyph coverage;
  // the estimated distance/normal still drives the identical glass optics.
  let coverage=select(nativeHalf1(clamp(0.5+signedRatio,0.0,1.0)),
    glyphCoverage,glassTitle);
  let dismiss=clamp(tile.motion.w,0.0,1.0);
  // Preserve the original rounded rect discard outside a transition.
  // During dismissal, a thin refractive edge extends into the expanded quad.
  if(coverage<=0.0&&dismiss<=0.0){discard;}
  // Oracle's finite geometry relationship uses EACH resolved glass
  // surface's minimum dimension. The first-square proxy was incorrect.
  let d=min(dimensions.x,dimensions.y);
  let innerAmount=max(-60.0,-0.8*d);
  let innerInvHeight=1.0/min(20.0,0.25*d);
  let outerAmount=0.2*d;
  let outerInvHeight=1.0/(0.125*d);
  let inner=refractionEnvelope(signed,innerAmount,innerInvHeight);
  let outer=refractionEnvelope(signed,outerAmount,outerInvHeight);
  // GAP NATIVE-UV-TO-CSS: normalized native displacement matrix
  // (+1/(4*texW),0,0,-1/(4*texH)) with selected input surfaceScale=.25
  // projects to 1 CSS px per material amount for equal-sized extents.
  // This cross-domain assumption is not a universal proof.
  let displacementFactor=1.0/(4.0*0.25);
  // AIR 323-328 / 383-387: convert base UV to half2, multiply native
  // half displacement × half2 matrix, HALF add, then promote to sample UV.
  // GAP NATIVE-UV-TO-CSS still applies to the CSS/texture scale mapping.
  // Sign-in glass lives in a *scrolling* document-sized framebuffer, but
  // its photograph still lives in the original fixed viewport scene.
  // The auth uniform carries scene height in fit.w and scrollTop in pointer.w.
  // No change to the homepage square optical math or material parameters.
  var backdropExtent=state.viewport.xy;
  var backdropPosition=in.position.xy;
  if(authPane){
    backdropExtent.y=max(1.0,state.fit.w);
    backdropPosition.y-=state.pointer.w;
  }
  let baseUV=nativeHalf2(backdropPosition/backdropExtent);
  let innerUV=nativeHalf2(baseUV+nativeHalf2(
    field.yz*inner*displacementFactor/backdropExtent));
  let outerUV=nativeHalf2(baseUV+nativeHalf2(
    field.yz*outer*displacementFactor/backdropExtent));
  // GAP INTERACTIVE-NATIVE: per-square browser-only perturbation, not an
  // Apple material coefficient. The base AIR SDF/refraction/LOD inputs above
  // remain untouched and the effect decays to exactly zero when inactive.
  let delta=in.local-tile.interaction.zw;
  let localRadius=max(24.0,d*.8);
  // Browser-authored elongated hotspot; aspect 1 preserves square law.
  let reach=localRadius*clamp(dimensions/max(d,1.0),
    vec2<f32>(1.0),vec2<f32>(2.4));
  let relative=delta/max(reach,vec2<f32>(1.0));
  let proximity=exp(-dot(relative,relative));
  let hover=clamp(tile.interaction.x,0.0,1.0);
  let pressed=clamp(tile.interaction.y,0.0,1.0);
  let radial=relative;
  let shiftPx=proximity*(radial*(hover*0.55+pressed*1.1)+
    tile.motion.xy*(hover*0.42+pressed*0.65));
  let shiftUV=shiftPx/backdropExtent;
  let interactiveInnerUV=innerUV+shiftUV;
  let interactiveOuterUV=outerUV+shiftUV;
  let rim=exp(-abs(signed)*1.16);
  let edge=clamp(rim*0.28,0.0,0.28);
  // Explicitly provisional; not derived from Apple event-dependent light.
  // Only the hovered/pressed square changes, and lighting follows local
  // pointer coordinates instead of leaking to neighboring tiles.
  // Identical pointer/press lighting for squares AND Home capsules.
  // The negative Home material tag must not introduce an alternate
  // light response; capsule silhouette alone is set by the shared SDF.
  let pointerLight=proximity*(hover*0.075+pressed*0.06)+
    rim*proximity*pressed*0.035;
  // Native compositing owns the photographic pixels in this scrolling
  // route. Only the old shader's optical SDF rim and independent hover
  // spring remain in WebGPU, so the glass cannot carry an outdated view
  // of the stationary wallpaper into the next compositor scroll frame.
  // The unchanged full WebGPU refraction remains for the homepage squares
  // and the original full WebGPU sign-in default.
  if(authPane && state.tintMeta.z>0.5){
    var tintStrength=select(0.25,0.60,authPane);
    if(tile.properties.y == -4.0){tintStrength=0.82;}
    else if(tile.properties.y == -5.0){tintStrength=0.62;}
    else if(tile.properties.y == -6.0){tintStrength=0.40;}
    let pigment=tintTiles[in.tileIndex];
    let transmission=1.0-clamp(pigment.w,0.0,1.0)*tintStrength;
    let reflection=clamp((edge+pointerLight)*0.75*transmission,0.0,0.32);
    return vec4<f32>(vec3<f32>(1.0),
      coverage*clamp(tile.motion.z,0.0,1.0)*reflection);
  }
  let innerLOD=glassLOD(tile.properties.z,
    blurDistribution(nativeHalf1(signed+inner),d));
  let outerLOD=glassLOD(tile.properties.z,
    blurDistribution(nativeHalf1(signed+outer),d));
  let glass=mix(mipSample(interactiveInnerUV,innerLOD),
                mipSample(interactiveOuterUV,outerLOD),thresholdMix(signed));
  // GAP PUBLIC-CLEAR-COLOR/OUTPUT Q: no proof for face color, Fresnel,
  // specular brightness or native display color transfer.
  // Preserve source-backed sampled optics and the restrained browser rim.
  let baseColor=clamp(glass.rgb+vec3<f32>(edge+pointerLight),vec3<f32>(0.0),vec3<f32>(1.0));
  // GAP CLEAR-FACE-OUTPUT: 25F80 Clear face matrix input endpoints are
  // measured, but their executed native equation is NOT recovered. The
  // browser applies a linear interpolation between recorded endpoint
  // inputs: light black/white = 0.20/0.95, dark = 0.05/0.80.
  // Both face endpoints are lower in dark; tint hue stays independent.
  // One material face for EVERY glass instance, including the card and
  // controls. The separate site light/dark UI switch chooses the form's
  // neutral pigment but cannot silently change the untinted face.
  let darkFace=state.tintMeta.y>0.5;
  let faceBlack=select(0.20,0.05,darkFace);
  let faceWhite=select(0.95,0.80,darkFace);
  var color=vec3<f32>(faceBlack)+baseColor*(faceWhite-faceBlack);
  // Back button, card and homepage squares all use this exact untinted
  // material face. No extra back-arrow brightening is applied.
  let localTint=tintTiles[in.tileIndex];
  if(localTint.w>0.0){
    // The shared square film is 0.25, including the tinted capsule (-9).
    // The dark green is a hue/opacity INPUT to the original tint mixer,
    // never a different film strength, transmission or color equation.
    // Other route-specific form controls retain their established films.
    let squareFilmStrength=0.25;
    var filmStrength=select(0.25,0.60,authPane);
    if(tile.properties.y == -9.0){filmStrength=squareFilmStrength;}
    else if(tile.properties.y == -4.0){filmStrength=0.82;}
    else if(tile.properties.y == -5.0){filmStrength=0.62;}
    else if(tile.properties.y == -6.0){filmStrength=0.40;}
    color=mix(color,localTint.rgb,clamp(localTint.w,0.0,1.0)*filmStrength);
  }
  // Only route panes with the explicit motion.w dismissal lane enter the
  // homepage squares' identical SDF/noise/fringe dissolution below.
  // Sign-in and normal Projects panes preserve their original appearance.
  if(authPane&&dismiss<=0.0){
    return vec4<f32>(color,coverage*clamp(tile.motion.z,0.0,1.0));
  }
  // Public homepage ONLY: attenuate the alpha of glass squares within
  // 0.75 square widths of the LEFT/RIGHT window edges, from 25% -> 100%.
  // Fragment position is in physical viewport pixels. This does not touch
  // the opaque scene copy, background photograph, Doof or button layers.
  // Authenticated Dashboard's separate shader is intentionally unchanged.
  let fadeWidth=max(1.0,0.75*tile.rect.z);
  let edgeDistance=min(in.position.x,state.viewport.x-in.position.x);
  let edgeOpacity=mix(0.25,1.0,clamp(edgeDistance/fadeWidth,0.0,1.0));
  // Public-home title aperture: elliptic ALPHA dip on glass fragments only.
  // The original 65x40px oval was effectively invisible because the
  // title sits above EMPTY lattice cells. The 140x100px oval reaches
  // adjacent populated squares without introducing a colored overlay.
  // The logo moved another full tile: its offset is now 2.5 tile heights.
  // Match the public CSS mask's sampled quadratic radial stops.
  let logoCenter=vec2<f32>(
    state.viewport.x*0.5,
    state.viewport.y*0.5-2.5*(950.0/11.0)*state.viewport.w);
  let ovalRadii=vec2<f32>(140.0,100.0)*state.viewport.w;
  let ovalUV=(in.position.xy-logoCenter)/ovalRadii;
  let ovalDistance=clamp(length(ovalUV),0.0,1.0);
  let logoOpacity=mix(0.60,1.0,ovalDistance*ovalDistance);
  // The homepage spatial edge/brand fades do not belong on the Projects
  // header. The exact same local optical decoherence works at full alpha.
  let routeSpatialAlpha=select(edgeOpacity*logoOpacity,1.0,authPane);
  let baseAlpha=coverage*in.introAlpha*
    clamp(tile.motion.z,0.0,1.0)*routeSpatialAlpha;
  // Normal frames remain exactly the recovered SDF/refraction/color path.
  if(dismiss<=0.0){return vec4<f32>(color,baseAlpha);}
  if(dismiss>=1.0){return vec4<f32>(color,0.0);}
  // Dissolve the original refracting material instead of painting fake
  // gray clouds. Continuous value noise introduces soft local holes;
  // the model is browser-authored, NOT an extracted 26.5.1 effect.
  let uv=(in.local/tile.rect.zw-vec2<f32>(0.5))*2.0;
  let seed=f32(in.tileIndex)*0.367;
  let noiseField=dissolveField(uv*3.0+vec2<f32>(seed,seed*.49)+
    vec2<f32>(0.02*dismiss,-0.10*dismiss));
  let fine=dissolveNoise(uv*9.0+vec2<f32>(seed*1.7,seed*.53+0.5));
  let edgeExposure=1.0-clamp(-signed/11.0,0.0,1.0);
  let amount=clamp((dismiss-0.09+
    (noiseField-0.5)*0.30+(fine-0.5)*0.11+edgeExposure*0.07)/0.82,0.0,1.0);
  let smoothAmount=amount*amount*(3.0-2.0*amount);
  let retained=1.0-smoothAmount;
  // Residual fringe samples the ORIGINAL glass color and vanishes early.
  let fringeWindow=smoothstep(0.12,0.28,dismiss)*
    (1.0-smoothstep(0.54,0.84,dismiss));
  let fringe=(1.0-coverage)*fringeWindow*0.09*
    (0.45+0.55*noiseField)*exp(-abs(signed)*0.18);
  let alpha=(coverage*retained+fringe)*in.introAlpha*
    clamp(tile.motion.z,0.0,1.0)*routeSpatialAlpha;
  return vec4<f32>(color,clamp(alpha,0.0,1.0));
}
