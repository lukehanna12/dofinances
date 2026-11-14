import {test} from "node:test";
import assert from "node:assert/strict";
import {nativeTintMatrix,tintParameters,TINT_COLORS,OBSERVED_OPACITIES} from "./dashboard-tint.js";

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
test("same hue and opacity input yields different measured scheme response",()=>{
  const dark=tintParameters("red",.37,"dark");
  const light=tintParameters("red",.37,"light");
  assert.notDeepEqual(dark.rgb,light.rgb);
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
  assert.deepEqual(Object.keys(TINT_COLORS),["none","red","blue","green","white","black"]);
});
test("all five supported hues have clamped colors, finite alpha, and no false native proof",()=>{
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
  assert.throws(()=>tintParameters("cyan",.25),RangeError);
  assert.throws(()=>nativeTintMatrix("sepia",.25),RangeError);
  assert.throws(()=>tintParameters("blue",.5,"sepia"),RangeError);
});
