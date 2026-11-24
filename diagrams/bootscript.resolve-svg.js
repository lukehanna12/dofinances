(async()=>{
 document.documentElement.setAttribute('data-theme','dark');
 document.documentElement.setAttribute('data-preset','classic');
 await document.fonts.ready;
 const source=document.querySelector('svg[aria-labelledby="archify-diagram-title archify-diagram-description"]');
 const clone=source.cloneNode(true);
 const keys=['fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','opacity','font-family','font-size','font-weight','font-style','text-anchor','dominant-baseline','letter-spacing','paint-order','visibility','display','color','stop-color','stop-opacity'];
 const a=[source,...source.querySelectorAll('*')],b=[clone,...clone.querySelectorAll('*')];
 for(let i=0;i<a.length;i++){
   const computed=getComputedStyle(a[i]);
   if(['style','script','title','desc'].includes(a[i].localName))continue;
   b[i].removeAttribute('class');b[i].removeAttribute('style');
   for(const key of keys){
     let value=computed.getPropertyValue(key);
     if(value.includes('url('))value=value.replace(/url\(["']?[^)]*#([^"')]+)["']?\)/g,'url(#$1)');
     if(value)b[i].setAttribute(key,value);
   }
 }
 clone.querySelectorAll('style,script,animate,animateTransform').forEach(x=>x.remove());
 clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
 clone.removeAttribute('width');clone.removeAttribute('height');
 clone.setAttribute('style','display:block;width:100%;height:auto');
 const pre=document.createElement('pre');pre.id='resolved-svg';pre.textContent=clone.outerHTML;document.body.append(pre);
})();
