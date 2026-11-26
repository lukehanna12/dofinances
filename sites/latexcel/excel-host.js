/* Excel task-pane adapter. No workbook read or write until user action. */
globalThis.LatexcelHost=(()=>{
 "use strict";
 let canInsert=false;
 async function ready(){
   if(typeof Office==="undefined")throw Error("Open this add-in in Microsoft Excel.");
   const info=await Office.onReady();
   if(info.host!==Office.HostType.Excel)throw Error("Open this add-in in Microsoft Excel.");
   canInsert=Office.context.requirements.isSetSupported("ExcelApi","1.9");
 }
 async function snapshot(ctx){
   const range=ctx.workbook.getSelectedRange();
   range.load("address,rowCount,columnCount");
   range.worksheet.load("id");
   await ctx.sync();
   if(range.rowCount!==1||range.columnCount!==1)throw Error("Select exactly one cell.");
   range.load("values,formulas");await ctx.sync();
   const value=range.values[0][0],formula=range.formulas[0][0];
   return {range,value,formula:typeof formula==="string"&&formula.startsWith("=")?formula:"",occupied:value!==""&&value!==null||typeof formula==="string"&&formula.startsWith("="),address:range.address,token:JSON.stringify([range.worksheet.id,range.address,value,formula])};
 }
 async function read(){return Excel.run(async ctx=>{const {range,...s}=await snapshot(ctx);return s;});}
 async function write(req){
   return Excel.run(async ctx=>{
     const s=await snapshot(ctx);
     if(s.token!==req.target)throw Error("Selection changed. Retry at the intended cell.");
     if(req.mode!=="png"&&s.occupied&&!req.overwrite)throw Error("The target cell is occupied.");
     const p=req.payload;
     if(req.mode==="source"){
       const raw=Latexcel.text(p.tex);
       s.range.values=[[/^[=+\-@']/.test(raw)?"'"+raw:raw]];
     }else if(req.mode==="function"){
       s.range.formulas=[[Latexcel.functionFormula("excel",p.name,p.args)]];
     }else if(req.mode==="external"){
       if(p.consent!==true)throw Error("External rendering requires consent.");
       s.range.formulas=[[p.reference?Latexcel.imageFormulaReference(p.reference,"excel"):Latexcel.imageFormula(Latexcel.renderInput(p.tex),"excel")]];
     }else if(req.mode==="png"){
       if(!canInsert)throw Error("ExcelApi 1.9 is required for image insertion.");
       if(typeof p.base64!=="string"||!p.base64.startsWith("iVBORw0KGgo")||p.base64.length>2700000)throw Error("Invalid or oversized PNG.");
       if(![p.width,p.height,p.displayWidth,p.displayHeight].every(v=>Number.isFinite(v)&&v>0))throw Error("Invalid image dimensions.");
       s.range.load("top,left");await ctx.sync();
       const shape=s.range.worksheet.shapes.addImage(p.base64);
       shape.left=s.range.left;shape.top=s.range.top;
       shape.width=Math.max(1,Math.min(500,p.displayWidth*.75));
       shape.height=Math.max(1,shape.width*p.height/p.width);
       shape.name="LaTeXceL "+Date.now();
     }else throw Error("Unsupported insertion mode.");
     await ctx.sync();
   });
 }
 return {kind:"excel",label:"Excel",get canInsertImage(){return canInsert;},ready,read,write};
})();
