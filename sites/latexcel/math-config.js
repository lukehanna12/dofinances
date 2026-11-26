/* Restrict MathJax to the bundled base and AMS math packages. */
globalThis.MathJax={
 loader:{load:[]},
 tex:{packages:["base","ams"],maxBuffer:8192,maxMacros:1000},
 svg:{fontCache:"none"},
 startup:{typeset:false},
 options:{enableMenu:false}
};
