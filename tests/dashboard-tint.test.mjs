import {test} from "node:test";
import assert from "node:assert/strict";
import {nativeTintMatrix,tintParameters,tintForTile,TINT_COLORS,OBSERVED_OPACITIES,
  SHOWCASE_TINTS,SHOWCASE_OPACITIES,CLEAR_FACE_INPUTS,browserFaceColor,
  browserTintColor,normalizeTintHex,rgbFromHex} from "../sites/_apex/app/assets/dashboard-tint.js";

function word(v){const a=new DataView(new ArrayBuffer(4));a.setFloat32(0,v,true);return a.getUint32(0,true);}
test("two native tint matrices preserve captured Float32 words and alpha slot 18",()=>{
  for(const scheme of ["light","dark"]){
    for(const alpha of OBSERVED_OPACITIES){
      const m=nativeTintMatrix(scheme,alpha);
      assert.equal(m.length,20);
      assert.equal(word(m[0]),0x3f438716);
      assert.equal(word(m[1]),0x3e5ba804);
      assert.equal(word(m[18]),word(Math.fround(alpha)));
      assert.equal(word(m[19]),0);
      assert.equal(word(m[4]),scheme==="light"?0xbdccccd0:0x3dccccd0);
    }
  }
});
test("native vibrancy offsets must NOT recolor tint hue by scheme",()=>{
  const dark=tintParameters("red",.37,"dark");
  const light=tintParameters("red",.37,"light");
  assert.deepEqual(dark.rgb,light.rgb);
  assert.deepEqual(light.rgb,[1,0,0]);
  assert.equal(dark.opacity,Math.fround(.37));
  assert.equal(light.opacity,Math.fround(.37));
  assert.equal(dark.filterCount,3);
  assert.equal(light.filterCount,3);
});
test("native captured 104-case graph distinguishes no-tint and zero-opacity tint",()=>{
  const neutral=tintParameters("none");
  const transparent=tintParameters("red",0);
  assert.equal(neutral.active,false);
  assert.equal(neutral.filterCount,2);
  assert.equal(transparent.active,true);
  assert.equal(transparent.filterCount,3);
  assert.equal(transparent.opacity,0);
  assert.deepEqual(Object.keys(TINT_COLORS),[
    "none","red","orange","yellow","green","teal","cyan","blue",
    "indigo","purple","magenta","pink","white","black"
  ]);
});
test("all 13 supported tint hues have finite alpha and no false native proof",()=>{
  for(const name of Object.keys(TINT_COLORS).filter(n=>n!=="none")){
    const s=tintParameters(name);
    assert.ok(s.rgb.every(x=>Number.isFinite(x)&&x>=0&&x<=1));
    assert.equal(s.nativeHueProven,false);
    assert.equal(s.nativeCompositorProven,false);
    assert.equal(s.filterCount,3);
  }
});
test("out-of-domain opacity and schemes fail closed",()=>{
  assert.throws(()=>tintParameters("red",-0.1),RangeError);
  assert.throws(()=>tintParameters("red",1.1),RangeError);
  assert.throws(()=>tintParameters("ultraviolet",.25),RangeError);
  assert.throws(()=>nativeTintMatrix("sepia",.25),RangeError);
  assert.throws(()=>tintParameters("blue",.5,"sepia"),RangeError);
});

test("mixed comparison distributes 42 squares across 14 colors and three measured alpha tiers",()=>{
  const state=tintParameters("showcase");
  const tiles=Array.from({length:42},(_,i)=>tintForTile(state,i));
  assert.deepEqual(SHOWCASE_TINTS,Object.keys(TINT_COLORS));
  assert.deepEqual(SHOWCASE_OPACITIES,[.37,.75,1]);
  assert.equal(state.mixed,true);assert.equal(state.opacity,1);
  for(let tier=0;tier<3;tier++){
    for(let hue=0;hue<14;hue++){
      const item=tiles[tier*14+hue];
      assert.equal(item.name,SHOWCASE_TINTS[hue]);
      assert.equal(item.opacity,hue===0?0:Math.fround(SHOWCASE_OPACITIES[tier]));
      assert.equal(item.filterCount,hue===0?2:3);
      assert.equal(item.nativeHueProven,false);
    }
  }
});
test("uniform tint stays uniform while mixed strength scales each colored tile",()=>{
  const uniform=tintParameters("blue",.25,"light");
  assert.equal(tintForTile(uniform,0),uniform);
  assert.equal(tintForTile(uniform,41),uniform);
  const half=tintParameters("showcase",.5,"light");
  assert.equal(tintForTile(half,1).opacity,Math.fround(.37*.5));
  assert.equal(tintForTile(half,14).opacity,0);
  assert.equal(tintForTile(half,15).name,"red");
  assert.throws(()=>tintForTile(half,-1),RangeError);
  assert.throws(()=>tintParameters("showcase",1.01),RangeError);
});

test("captured 25F80 Clear face endpoints order Light above Dark",()=>{
  assert.deepEqual(CLEAR_FACE_INPUTS.light,{
    white:Math.fround(.95),black:Math.fround(.2),fillWhiteAlpha:Math.fround(.1)
  });
  assert.deepEqual(CLEAR_FACE_INPUTS.dark,{
    white:Math.fround(.8),black:Math.fround(.05),fillWhiteAlpha:Math.fround(.05)
  });
  for(const rgb of [[0,0,0],[.15,.45,.8],[.6,.6,.6],[1,1,1]]){
    const l=browserFaceColor(rgb,"light"),d=browserFaceColor(rgb,"dark");
    assert.ok(l.every((v,i)=>v>d[i]+.14999),"Light must be brighter at each endpoint");
  }
});
test("for equal backdrop/tint alpha, Dark cannot become lighter than Light",()=>{
  for(const name of Object.keys(TINT_COLORS)){
    for(const value of [0,.2,.5,.9,1]){
      const backdrop=[value,Math.min(1,value+.05),Math.max(0,value-.05)];
      const l=browserTintColor(backdrop,tintParameters(name,.75,"light"));
      const d=browserTintColor(backdrop,tintParameters(name,.75,"dark"));
      assert.ok(l.every((v,i)=>v>d[i]),name+" back="+value);
    }
  }
});
test("expanded palette has distinguishable authored sRGB hues",()=>{
  assert.equal(Object.keys(TINT_COLORS).length,14);
  assert.ok(["cyan","purple","pink","orange","yellow","teal","indigo","magenta"]
    .every(n=>n in TINT_COLORS));
  const colors=Object.keys(TINT_COLORS).filter(n=>n!=="none");
  assert.equal(new Set(colors.map(n=>TINT_COLORS[n].rgb.join(","))).size,colors.length);
});

test("default Dark + untinted and future arbitrary hexadecimal colors remain supported",()=>{
  const clear=tintParameters("none",undefined,"dark");
  assert.equal(clear.name,"none");
  assert.equal(clear.opacity,0);
  assert.equal(clear.scheme,"dark");
  assert.equal(normalizeTintHex("#F3a"),"#ff33aa");
  assert.equal(normalizeTintHex("08ACF1"),"#08acf1");
  const custom=tintParameters("#08ACF1",.42,"dark");
  assert.equal(custom.name,"#08acf1");
  assert.deepEqual(custom.rgb,rgbFromHex("#08acf1"));
  assert.equal(custom.opacity,Math.fround(.42));
  assert.equal(custom.nativeHueProven,false);
  assert.throws(()=>normalizeTintHex("#FFFFF"),RangeError);
});
