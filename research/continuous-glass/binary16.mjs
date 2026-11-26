// Portable IEEE-754 binary16 serialization for retained numerical witnesses.
// Avoid DataView.setFloat16, which is not available in the project's Node 22 CI.
// Round directly from binary64 to binary16 (no intervening float32 rounding).
function roundEven(x){const q=Math.floor(x),f=x-q;return q+(f>.5||(f===.5&&q%2===1)?1:0);}
export function binary16Bits(x){
 if(Number.isNaN(x))return 0x7e00;
 const sign=x<0||Object.is(x,-0)?0x8000:0,a=Math.abs(x);
 if(a>=65520)return sign|0x7c00;
 if(a<2**-14)return sign|roundEven(a*2**24);
 let e=Math.floor(Math.log2(a));
 if(a<2**e)e--;else if(a>=2**(e+1))e++;
 let m=roundEven(a/2**(e-10));
 if(m===2048){e++;m=1024;}
 return sign|((e+15)<<10)|(m-1024);
}
export function setBinary16LE(view,offset,x){view.setUint16(offset,binary16Bits(x),true);}
export function decodeBinary16(bits){
 const s=bits&0x8000?-1:1,e=(bits>>>10)&31,f=bits&1023;
 return e===31?(f?NaN:s*Infinity):e===0?s*f*2**-24:s*(1024+f)*2**(e-25);
}
