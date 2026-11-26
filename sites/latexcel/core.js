/* LaTeXceL shared expression engine. No host APIs or network calls. */
var Latexcel = (() => {
  "use strict";
  const MAX = 8192, MAX_CELLS = 10000;
  class InputError extends Error {
    constructor(message) { super(message); this.name = "LatexcelInputError"; }
  }
  function text(value, label = "Expression") {
    if (value === null || value === undefined) return "";
    if (!["string", "number", "boolean"].includes(typeof value)) throw new InputError(label + " must be a scalar.");
    if (typeof value === "number" && !Number.isFinite(value)) throw new InputError(label + " must be finite.");
    const s = String(value);
    if (s.length > MAX) throw new InputError(label + " exceeds " + MAX + " characters.");
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s)) throw new InputError(label + " contains control characters.");
    if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(s)) throw new InputError(label + " contains invalid Unicode.");
    return s;
  }
  const group = x => "{" + text(x) + "}";
  const command = (name, x) => "\\" + name + group(x);
  const escapeMap = {"\\":"\\backslash{}","{":"\\{","}":"\\}","$":"\\$","&":"\\&","#":"\\#","%":"\\%","_":"\\_","^":"\\^{}","~":"\\~{}"};
  const literal = x => text(x).replace(/[\\{}$&#%_^~]/g, c => escapeMap[c]);
  const greek = Object.freeze({
    alpha:"alpha",beta:"beta",gamma:"gamma",delta:"delta",epsilon:"epsilon",varepsilon:"varepsilon",zeta:"zeta",eta:"eta",theta:"theta",vartheta:"vartheta",iota:"iota",kappa:"kappa",lambda:"lambda",mu:"mu",nu:"nu",xi:"xi",omicron:"mathrm{o}",pi:"pi",varpi:"varpi",rho:"rho",varrho:"varrho",sigma:"sigma",varsigma:"varsigma",tau:"tau",upsilon:"upsilon",phi:"phi",varphi:"varphi",chi:"chi",psi:"psi",omega:"omega",
    Alpha:"mathrm{A}",Beta:"mathrm{B}",Gamma:"Gamma",Delta:"Delta",Epsilon:"mathrm{E}",Zeta:"mathrm{Z}",Eta:"mathrm{H}",Theta:"Theta",Iota:"mathrm{I}",Kappa:"mathrm{K}",Lambda:"Lambda",Mu:"mathrm{M}",Nu:"mathrm{N}",Xi:"Xi",Omicron:"mathrm{O}",Pi:"Pi",Rho:"mathrm{P}",Sigma:"Sigma",Tau:"mathrm{T}",Upsilon:"Upsilon",Phi:"Phi",Chi:"mathrm{X}",Psi:"Psi",Omega:"Omega"
  });
  const accents = Object.freeze({h:"widehat",hat:"widehat",b:"overline",bar:"overline",t:"widetilde",tilde:"widetilde",dot:"dot",ddot:"ddot",vec:"vec",check:"check",breve:"breve",acute:"acute",grave:"grave"});
  const fonts = Object.freeze({rm:"mathrm",roman:"mathrm",it:"mathit",italic:"mathit",bf:"mathbf",bold:"mathbf",bb:"mathbb",blackboard:"mathbb",cal:"mathcal",calligraphic:"mathcal",sf:"mathsf",sans:"mathsf",tt:"mathtt",mono:"mathtt",frak:"mathfrak",fraktur:"mathfrak"});
  function lookup(map,key,label) {
    const name=text(key,label);
    if (!Object.prototype.hasOwnProperty.call(map,name)) throw new InputError("Unsupported "+label+": "+name);
    return map[name];
  }
  function integer(v,label,min,max) {
    if (v === "" || v === null || v === undefined || typeof v === "boolean" || !Number.isInteger(Number(v)) || Number(v)<min || Number(v)>max)
      throw new InputError(label+" must be an integer from "+min+" to "+max+".");
    return Number(v);
  }
  const has = x => x !== "" && x !== undefined && x !== null;
  const bracket = x => "\\left("+text(x)+"\\right)";
  const methods = Object.freeze({
    RM: x=>command("mathrm",x),
    FONT: (x,style)=>command(lookup(fonts,text(style).toLowerCase(),"font"),x),
    TEXT: x=>command("text",literal(x)),
    SUB: (term,sub)=>text(term)+"_"+group(sub),
    SUPER: (term,sup)=>text(term)+"^"+group(sup),
    SCRIPTS: (term,sub,sup)=>text(term)+(has(sub)?"_"+group(sub):"")+(has(sup)?"^"+group(sup):""),
    INTERACTION: (a,b)=>text(a)+"\\times"+text(b),
    TIMES: (a,b)=>text(a)+"\\times{}"+text(b),
    FRAC: (a,b)=>"\\frac"+group(a)+group(b),
    SQRT: x=>command("sqrt",x),
    ROOT: (degree,x)=>"\\sqrt["+integer(degree,"Root degree",2,99)+"]"+group(x),
    PAREN: bracket,
    ABS: x=>"\\left|"+text(x)+"\\right|",
    NORM: x=>"\\left\\lVert "+text(x)+"\\right\\rVert",
    NATLOG: x=>"\\ln("+text(x)+")",
    LOG: (base,x)=>"\\log_"+group(base)+bracket(x),
    ACCENT: (x,accent)=>command(lookup(accents,text(accent).toLowerCase(),"accent"),x),
    HAT: x=>command("widehat",x),
    BAR: x=>command("overline",x),
    TILDE: x=>command("widetilde",x),
    GREEK: name=>"\\"+lookup(greek,name,"Greek letter"),
    INDICATOR: x=>"\\mathbb{1}"+group("\\left\\{"+text(x)+"\\right\\}"),
    SUM: (lower,upper,x)=>"\\sum_{"+text(lower)+"}^{"+text(upper)+"} "+text(x),
    PROD: (lower,upper,x)=>"\\prod_{"+text(lower)+"}^{"+text(upper)+"} "+text(x),
    INTEGRAL: (lower,upper,x,variable)=>"\\int_{"+text(lower)+"}^{"+text(upper)+"} "+text(x)+"\\,\\mathrm{d}"+text(variable),
    LIMIT: (variable,target,x)=>"\\lim_{"+text(variable)+"\\to "+text(target)+"} "+text(x),
    DERIV: (x,variable)=>"\\frac{\\mathrm{d}"+text(x)+"}{\\mathrm{d}"+text(variable)+"}",
    PARTIAL: (x,variable)=>"\\frac{\\partial "+text(x)+"}{\\partial "+text(variable)+"}",
    EXPECT: x=>"\\mathbb{E}\\left["+text(x)+"\\right]",
    PROB: x=>"\\mathbb{P}\\left("+text(x)+"\\right)",
    SET: x=>"\\left\\{"+text(x)+"\\right\\}",
    BINOM: (n,k)=>"\\binom"+group(n)+group(k),
    VECTOR: x=>command("vec",x),
    TEXMOD: (base,font,accent,sub,sup,logarithm)=>{
      let out=text(base);
      if(has(font))out=command(lookup(fonts,text(font).toLowerCase(),"font"),out);
      if(has(accent))out=command(lookup(accents,text(accent).toLowerCase(),"accent"),out);
      out+= (has(sub)?"_"+group(sub):"")+(has(sup)?"^"+group(sup):"");
      const flag=text(logarithm).toLowerCase();
      if(!["","0","1","false","true"].includes(flag))throw new InputError("Logarithm must be TRUE or FALSE.");
      return flag==="1"||flag==="true"?"\\ln("+out+")":out;
    },
    MATRIX: (value,environment)=>{
      const env=text(environment);
      if(!["matrix","pmatrix","bmatrix","Bmatrix","vmatrix","Vmatrix"].includes(env))throw new InputError("Unsupported matrix delimiter.");
      const rows=text(value).split(";").map(r=>r.split(",").map(c=>c.trim()));
      if(rows.length>20||rows[0].length>20||rows.some(r=>r.length!==rows[0].length||r.some(c=>!c)))throw new InputError("Matrix must be rectangular, with 1 to 20 nonempty rows and columns.");
      return "\\begin{"+env+"}"+rows.map(r=>r.join("&")).join("\\\\")+"\\end{"+env+"}";
    },
    CASES: value=>{
      const rows=text(value).split(";").map(r=>r.split(",").map(c=>c.trim()));
      if(rows.length>20||rows.some(r=>r.length!==2||r.some(c=>!c)))throw new InputError("Use expression,condition pairs separated by semicolons.");
      return "\\begin{cases}"+rows.map(r=>r.join("&")).join("\\\\")+"\\end{cases}";
    },
    EQ: (a,b)=>text(a)+"="+text(b),
    ALIGNED: value=>{
      const rows=text(value).split(";").map(r=>r.trim());
      if(rows.length>20||rows.some(r=>!r||!r.includes("&")))throw new InputError("Use & alignment markers and semicolon-separated rows.");
      return "\\begin{aligned}"+rows.join("\\\\")+"\\end{aligned}";
    },
    TEXURL: tex=>"https://latex.codecogs.com/png.image?\\dpi{180}\\small"+encodeURIComponent(text(tex)),
    URL: (tex,dpi)=>"https://latex.codecogs.com/png.image?\\dpi{"+integer(dpi,"DPI",72,600)+"}\\small"+encodeURIComponent(text(tex))
  });
  // TEXMOD is a new explicit contract inspired by Covariates, not an inferred legacy definition.
  const examples=Object.freeze({RM:["WT"],FONT:["R","bb"],TEXT:["sample & data"],SUB:["x","i"],SUPER:["x","2"],SCRIPTS:["x","i","2"],INTERACTION:["x","\\beta"],TIMES:["x","y"],FRAC:["a","b"],SQRT:["x"],ROOT:["3","x"],PAREN:["x+y"],ABS:["x"],NORM:["x"],NATLOG:["x"],LOG:["2","x"],ACCENT:["x","hat"],HAT:["x"],BAR:["x"],TILDE:["x"],GREEK:["alpha"],INDICATOR:["x>0"],SUM:["i=1","n","x_i"],PROD:["i=1","n","x_i"],INTEGRAL:["0","1","x^2","x"],LIMIT:["x","0","\\frac{\\sin x}{x}"],DERIV:["f(x)","x"],PARTIAL:["f","x"],EXPECT:["X"],PROB:["X>0"],SET:["x,y"],BINOM:["n","k"],VECTOR:["x"],TEXURL:["x"],URL:["x","180"],TEXMOD:["WT","rm","hat","d","2","false"],MATRIX:["a,b;c,d","pmatrix"],CASES:["x,x>0;0,x\\leq 0"],EQ:["a","b"],ALIGNED:["a&=b;c&=d"]});
  const definitions = [
    ["RM","Roman math font",["term"],"Typography"],["FONT","Choose a math font: rm, it, bf, bb, cal, sf, tt, frak",["term","style"],"Typography"],["TEXT","Escape literal text for a math expression",["text"],"Typography"],
    ["SUB","Attach a subscript",["term","subscript"],"Scripts"],["SUPER","Attach a superscript",["term","superscript"],"Scripts"],["SCRIPTS","Attach subscript and superscript; blanks omitted",["term","subscript","superscript"],"Scripts"],
    ["INTERACTION","Legacy Covariates interaction, exact concatenation",["factor1","factor2"],"Algebra"],["TIMES","Multiply with a safe command boundary",["factor1","factor2"],"Algebra"],["FRAC","Build a fraction",["numerator","denominator"],"Algebra"],["SQRT","Square root",["term"],"Algebra"],["ROOT","Nth root, integer degree 2 to 99",["degree","term"],"Algebra"],["PAREN","Scalable parentheses",["term"],"Algebra"],["ABS","Absolute value",["term"],"Algebra"],["NORM","Norm",["term"],"Algebra"],["NATLOG","Natural logarithm",["term"],"Algebra"],["LOG","Logarithm with base",["base","term"],"Algebra"],["BINOM","Binomial coefficient",["n","k"],"Algebra"],
    ["ACCENT","Accent: hat, bar, tilde, dot, ddot, vec, check, breve, acute, grave",["term","accent"],"Symbols"],["HAT","Wide hat",["term"],"Symbols"],["BAR","Overline",["term"],"Symbols"],["TILDE","Wide tilde",["term"],"Symbols"],["VECTOR","Vector arrow",["term"],"Symbols"],["GREEK","Greek letter by case-sensitive name",["name"],"Symbols"],["SET","Set notation",["term"],"Symbols"],
    ["SUM","Summation with limits",["lower","upper","term"],"Calculus"],["PROD","Product with limits",["lower","upper","term"],"Calculus"],["INTEGRAL","Definite integral",["lower","upper","term","variable"],"Calculus"],["LIMIT","Limit",["variable","target","term"],"Calculus"],["DERIV","Ordinary derivative",["term","variable"],"Calculus"],["PARTIAL","Partial derivative",["term","variable"],"Calculus"],
    ["INDICATOR","Indicator expression",["condition"],"Statistics"],["EXPECT","Expected value",["term"],"Statistics"],["PROB","Probability",["term"],"Statistics"],
    ["TEXMOD","Compose font, accent, subscript, superscript and optional natural log",["base","font","accent","subscript","superscript","logarithm"],"Composition"],["MATRIX","Matrix: comma-separated cells, semicolon-separated rows, delimiter environment",["entries","environment"],"Composition"],["CASES","Piecewise cases: expression,condition pairs separated by semicolons",["entries"],"Composition"],["EQ","Equality",["left","right"],"Composition"],["ALIGNED","Aligned equations: & marks alignment; semicolons separate rows",["equations"],"Composition"],
    ["TEXURL","Legacy CodeCogs PNG URL, 180 DPI; no network call",["tex"],"External rendering"],["URL","CodeCogs PNG URL at chosen DPI (72 to 600); no network call",["tex","dpi"],"External rendering"]
  ].map(([name,description,args,category])=>Object.freeze({name,description,args:Object.freeze(args),category,example:Object.freeze(examples[name])}));
  function call(name,...args) {
    const spec=definitions.find(d=>d.name===name);
    if (!spec) throw new InputError("Unknown function: "+name);
    if(args.length!==spec.args.length) throw new InputError(name+" requires "+spec.args.length+" argument(s).");
    return text(methods[name](...args),"Result");
  }
  // Spreadsheet array broadcasting: scalar or rectangular matrix; identical shape only.
  function broadcast(name,...args) {
    const grids=args.filter(Array.isArray);
    if(!grids.length) return call(name,...args);
    const rows=grids[0].length, cols=Array.isArray(grids[0][0])?grids[0][0].length:0;
    if(!rows||!cols||rows*cols>MAX_CELLS) throw new InputError("Range must contain 1 to "+MAX_CELLS+" cells.");
    for(const g of grids) if(g.length!==rows||g.some(row=>!Array.isArray(row)||row.length!==cols)) throw new InputError("All input ranges must have the same rectangular dimensions.");
    let total=0;
    return Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>{
      const value=call(name,...args.map(a=>Array.isArray(a)?a[i][j]:a));
      total+=value.length;
      if(total>1000000)throw new InputError("Range output exceeds one million characters.");
      return value;
    }));
  }
  function formulaLiteral(s) { return '"'+text(s).replace(/"/g,'""')+'"'; }
  // Input is TeX, not a user-provided spreadsheet formula. Always quote it.
  function imageFormula(tex,host,dpi=180) {
    if(!["excel","sheets"].includes(host)) throw new InputError("Unsupported spreadsheet host.");
    const url=call("URL",tex,dpi);
    if(host==="excel"&&url.length>255)throw new InputError("Excel literal image URLs are limited to 255 characters. Use an equation cell reference instead.");
    // Encoded URLs and explicit formula literal prevent formula injection.
    return host==="sheets"?'=IMAGE('+formulaLiteral(url)+',1)':'=IMAGE('+formulaLiteral(url)+',"LaTeX equation",0)';
  }
  function cellReference(value) {
    const s=text(value,"Cell reference").toUpperCase().trim();
    const m=/^\$?([A-Z]{1,3})\$?([1-9][0-9]{0,6})$/.exec(s);
    if(!m||Number(m[2])>1048576||[...m[1]].reduce((n,c)=>26*n+c.charCodeAt(0)-64,0)>16384)
      throw new InputError("Enter a single local A1 cell reference, such as A1 or $B$2.");
    return s;
  }
  function functionFormula(host,name,args) {
    if(!["excel","sheets"].includes(host)) throw new InputError("Unsupported spreadsheet host.");
    const spec=definitions.find(d=>d.name===name);
    if(!spec||!Array.isArray(args)||args.length!==spec.args.length)throw new InputError("Invalid function signature.");
    const hasRef=args.some(a=>a&&typeof a==="object");
    if(!hasRef)call(name,...args);
    const encoded=args.map(a=>{
      if(a&&typeof a==="object"){
        if(a.kind!=="reference"||typeof a.address!=="string")throw new InputError("Invalid reference argument.");
        return cellReference(a.address);
      }
      return formulaLiteral(a);
    });
    return "="+(host==="excel"?"LATEXCEL.":"LATEXCEL_")+name+"("+encoded.join(",")+")";
  }
  function imageFormulaReference(reference,host){
    const cell=cellReference(reference);
    if(host==="sheets")return "=IMAGE(LATEXCEL_TEXURL("+cell+"),1)";
    if(host==="excel")return '=IMAGE(LATEXCEL.TEXURL('+cell+'),"LaTeX equation",0)';
    throw new InputError("Unsupported spreadsheet host.");
  }
  // Recover the original prototype URL without fetching it or accepting arbitrary URLs.
  function decodeLegacyURL(value){
    const s=text(value);
    const prefix="https://latex.codecogs.com/png.image?";
    if(!s.startsWith(prefix))return null;
    let decoded;
    try{decoded=decodeURIComponent(s.slice(prefix.length));}
    catch{throw new InputError("Malformed CodeCogs expression URL.");}
    const m=/^\\dpi\{([0-9]{2,3})\}\\small([\s\S]+)$/.exec(decoded);
    if(!m||Number(m[1])<72||Number(m[1])>600)throw new InputError("Unsupported CodeCogs expression URL.");
    return renderInput(m[2]);
  }
  // Bound and reject potentially active TeX before handing it to MathJax.
  function renderInput(value) {
    const s=text(value).trim();
    if(!s) throw new InputError("Enter a LaTeX expression.");
    if(/\\(?:require|href|url|style|class|cssId|htmlId|htmlClass|htmlStyle|htmlData|includegraphics|input|include|openout|write|read|def|gdef|edef|xdef|newcommand|renewcommand|providecommand|newenvironment|renewenvironment|csname|catcode|let|futurelet|loop|repeat|special|unicode)\b/i.test(s)) throw new InputError("Active links, external resources, and macro definitions are not supported.");
    return s;
  }
  return Object.freeze({version:"1.0.0-rc.1",MAX,MAX_CELLS,InputError,definitions:Object.freeze(definitions),call,broadcast,text,formulaLiteral,imageFormula,imageFormulaReference,cellReference,functionFormula,decodeLegacyURL,renderInput});
})();
if(typeof module!=="undefined"&&module.exports) module.exports=Latexcel;
