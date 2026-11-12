/* WebGPU glass: actual GPU mip sampling of the GPU-owned live backdrop.
 * Research authority: liquid-plexiglass-oracle @ 3fd32ed3, 25F80/M2/G14G.
 *
 * Source-backed mathematical stages:
 *   airSupercircleSDF / airMode5SDF: canonical 12 AIR SSA shader corpus
 *   refractionEnvelope: glass_background_sdf_no_bleed_lph AIR 256-271,
 *                       352-366
 *   blur distribution: same AIR 290-321, refraction-adjusted distance
 *   LOD: same AIR 329-337 / 388-396 / 443-452
 *   geometry fields: foundation/model/geometry_331_compact.json (10 finite)
 *   blur selected input: 52 heldout public geometry, 8 exact encoder joins.
 *
 * GAPS: the precise native mip producer/filter kernel, native LPH shader
 *       half/f32 rounding, public clear-state joint fields, SDF corner writer,
 *       browser presentation colorspace/Q, and universal writer/selection
 *       paths are NOT proven. Constants from separate finite families are
 *       not claimed to be a real joined public clear-style material.
 * We never infer pixel identity from visual matching.
 */
struct Globals {
  viewport: vec4<f32>, // physical W,H,elapsed seconds,DPR
  fit: vec4<f32>,
  pointer: vec4<f32>,  // x,y,enabled,unused
};
struct Tile {
  rect: vec4<f32>,     // x,y,width,height (physical pixels)
  meta: vec4<f32>,     // CSS border radius, entrance delay, native blurWord, unused
};
@group(0) @binding(0) var backdrop: texture_2d<f32>;
@group(0) @binding(1) var<storage,read> tiles: array<Tile>;
@group(0) @binding(2) var<uniform> state: Globals;

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
  let progress=clamp((state.viewport.z-tile.meta.y)/0.4,0.0,1.0);
  let a=ease(progress);
  let scale=0.85+0.15*a;
  let center=tile.rect.xy+tile.rect.zw*0.5;
  let p=center+(uv-vec2<f32>(0.5))*tile.rect.zw*scale;
  var out:GlassOut;
  out.position=vec4<f32>(2.0*p.x/state.viewport.x-1.0,
    1.0-2.0*p.y/state.viewport.y,0.0,1.0);
  out.local=uv*tile.rect.zw;
  out.tileIndex=instance;
  out.introAlpha=a;
  return out;
}

fn supercircleSDF(ax:f32,ay:f32,hw:f32,hh:f32,
                  r:f32,bx:f32,by:f32)->vec3<f32>{
  if(r==0.0){
    let d=max(ax-hw,ay-hh);
    return vec3<f32>(d,select(0.0,1.0,ax>=hw),
                           select(0.0,1.0,ay>=hh));
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
  let smooth=length(vec2<f32>(q2x,q2y))*0.6541655659675598+
      0.3458344340324402;
  let a=mix(rounded,smooth,bx);
  let b=mix(rounded,smooth,by);
  let sign=select(-1.0,1.0,ny0>nx0);
  let control=clamp(0.5-sign+sign*u,0.0,1.0);
  let signed=k*(mix(a,b,control)-1.0);
  let d=min(max(hx,hy),0.0)+signed;
  let n=vec2<f32>(max(hx,0.0),max(hy,0.0));
  let nlen=length(n);
  if(nlen>0.0){
    return vec3<f32>(d,n.x/nlen,n.y/nlen);
  }
  return vec3<f32>(d,select(0.0,1.0,hx>hy),select(1.0,0.0,hx>hy));
}
fn cornerFactor(radius:f32,halfSize:f32)->f32{
  if(radius>=0.0){return 1.0;}
  return clamp((-1.5286649465560913-halfSize/radius)*
               -1.891557216644287,0.0,1.0);
}
fn mode5SDF(local:vec2<f32>,size:vec2<f32>,corner:f32)->vec3<f32>{
  let xy=vec2<f32>(local.x-size.x*0.5,size.y*0.5-local.y);
  let hw=size.x*0.5;
  let hh=size.y*0.5;
  // GAP PUBLIC-SDF-WRITER: four equal negative signed radii assume that the
  // user's four equal CSS radii map into the retained private four-corner
  // SDF arg2 lanes. No public writer equivalence is established.
  let r=-max(corner,0.009999999776482582);
  let fx=cornerFactor(r,hw);
  let fy=cornerFactor(r,hh);
  var chosen=supercircleSDF( xy.x, xy.y,hw,hh,r,fx,fy);
  let topLeft=supercircleSDF(-xy.x, xy.y,hw,hh,r,fx,fy);
  if(topLeft.x>chosen.x){chosen=vec3<f32>(topLeft.x,-topLeft.y,topLeft.z);}
  let bottomRight=supercircleSDF( xy.x,-xy.y,hw,hh,r,fx,fy);
  if(bottomRight.x>chosen.x){
    chosen=vec3<f32>(bottomRight.x,bottomRight.y,-bottomRight.z);
  }
  let bottomLeft=supercircleSDF(-xy.x,-xy.y,hw,hh,r,fx,fy);
  if(bottomLeft.x>chosen.x){
    chosen=vec3<f32>(bottomLeft.x,-bottomLeft.y,-bottomLeft.z);
  }
  // Normal y is Cartesian positive-up in retained AIR; flip to web y-down.
  return vec3<f32>(chosen.x,chosen.y,-chosen.z);
}
fn refractionEnvelope(d:f32,amount:f32,invHeight:f32)->f32{
  let t=clamp(-d*invHeight,0.0,1.0);
  return amount*(1.0-clamp(sqrt(clamp(t*(2.0-t),0.0,1.0)),0.0,1.0));
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
  // Native alpha=(1,.5,0,-.5); dist=(-.5*d,-1,0,0).
  let near=ramp(distance,-0.5*minDimension,-1.0);
  let far=ramp(distance,0.0,0.0);
  return 1.0-(0.5*near-0.5*far);
}
fn glassLOD(blurWord:f32,dist:f32)->f32{
  let t=blurWord*dist;
  let selected=select(t,1.0+0.5*t,t<2.0);
  return max(0.0,log2(max(selected,0.000001)));
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

@fragment
fn fsGlass(in:GlassOut)->@location(0) vec4<f32>{
  let tile=tiles[in.tileIndex];
  let dimensions=tile.rect.zw;
  let field=mode5SDF(in.local,dimensions,tile.meta.x);
  let signed=field.x;
  let coverage=clamp(0.5-signed/max(fwidth(signed),0.0001),0.0,1.0);
  if(coverage<=0.0){discard;}
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
  let innerUV=(in.position.xy+field.yz*inner*displacementFactor)/
     state.viewport.xy;
  let outerUV=(in.position.xy+field.yz*outer*displacementFactor)/
     state.viewport.xy;
  let innerLOD=glassLOD(tile.meta.z,blurDistribution(signed+inner,d));
  let outerLOD=glassLOD(tile.meta.z,blurDistribution(signed+outer,d));
  let glass=mix(mipSample(innerUV,innerLOD),
                mipSample(outerUV,outerLOD),thresholdMix(signed));
  let rim=exp(-abs(signed)*1.16);
  let edge=clamp(rim*0.28,0.0,0.28);
  var pointerLight:f32=0.0;
  if(state.pointer.z>0.5){
    let delta=in.position.xy-state.pointer.xy;
    let radius=max(34.0,dimensions.x*1.4);
    pointerLight=exp(-dot(delta,delta)/(radius*radius))*0.06;
  }
  // GAP PUBLIC-CLEAR-COLOR/OUTPUT Q: no proof for face color, Fresnel,
  // specular brightness or native display color transfer.
  // Preserve real sampled color and apply a restrained rim only.
  let color=clamp(glass.rgb+vec3<f32>(edge+pointerLight),vec3<f32>(0.0),vec3<f32>(1.0));
  return vec4<f32>(color,coverage*in.introAlpha);
}
