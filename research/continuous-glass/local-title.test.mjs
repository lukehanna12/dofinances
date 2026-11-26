import test from "node:test";
import assert from "node:assert/strict";
import {alphaContours,contourDeviation} from "../../sites/_apex/assets/home-dashboard/dashboard-glass-local-title.js";
function grid(w,h,fn){return Uint8Array.from({length:w*h},(_,i)=>fn(i%w,Math.floor(i/w))?255:0);}
function inside(contours,x,y){let parity=false;for(const c of contours)for(const [[ax,ay],[bx,by]] of c)if((ay>y)!==(by>y)&&x<ax+(y-ay)*(bx-ax)/(by-ay))parity=!parity;return parity;}
test("local title contour retains holes and closed boundaries",()=>{
 const r=alphaContours(grid(12,12,(x,y)=>x>=2&&x<10&&y>=2&&y<10&&!(x>=5&&x<7&&y>=5&&y<7)),12,12,1,.01);
 assert.equal(r.contours.length,2);
 for(const c of r.contours){assert.deepEqual(c[0][0],c.at(-1)[1]);for(let i=1;i<c.length;i++)assert.deepEqual(c[i-1][1],c[i][0]);}
 assert.equal(inside(r.contours,3.5,3.5),true);assert.equal(inside(r.contours,6,6),false);assert.equal(inside(r.contours,1,1),false);
 assert.equal(contourDeviation(r.contours,r.contours),0);
});
test("local title contour keeps independent glyph components",()=>{
 const r=alphaContours(grid(12,12,(x,y)=>(x>=2&&x<4||x>=7&&x<10)&&y>=2&&y<10),12,12,1,.01);
 assert.equal(r.contours.length,2);assert.equal(inside(r.contours,3,5),true);assert.equal(inside(r.contours,5,5),false);assert.equal(inside(r.contours,8,5),true);
});
test("local title contour rejects unresolved or clipped topology",()=>{
 assert.throws(()=>alphaContours(grid(6,6,(x,y)=>x===2&&y===2||x===3&&y===3),6,6,1),/saddle/);
 assert.throws(()=>alphaContours(grid(6,6,(x,y)=>x<2&&y>1&&y<4),6,6,1),/Open/);
 assert.throws(()=>alphaContours(new Uint8Array(4),2,2,1),/Empty/);
});
test("logical contour coordinates remain scale-independent",()=>{
 const make=s=>alphaContours(grid(12*s,12*s,(x,y)=>x>=2*s&&x<10*s&&y>=3*s&&y<9*s),12*s,12*s,s,.001).contours;
 const a=make(8),b=make(16);
 assert.ok(contourDeviation(a,b)<.07);assert.ok(contourDeviation(b,a)<.07);
 for(const c of [a,b]){assert.equal(inside(c,6,6),true);assert.equal(inside(c,1,1),false);}
});
