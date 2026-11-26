import {readFileSync} from "node:fs";
const m=JSON.parse(readFileSync(new URL("./RELEASE_CRITERIA.json",import.meta.url),"utf8"));
const ids=["site-vector-geometry","site-coordinate-separation","site-optical-reconstruction","site-material-interaction-preservation","site-comparative-fidelity","production-performance-and-regressions"];
if(m.schema!=="dofinances-continuous-release-gate-v2"||m.gates.length!==ids.length||!ids.every(id=>m.gates.filter(g=>g.id===id).length===1)||m.gates.some(g=>!["passed","open"].includes(g.status)||(g.status==="passed"&&!g.evidence))){console.error("INVALID RELEASE CRITERIA");process.exit(2);}
const open=m.gates.filter(g=>g.status==="open");if(open.length){console.error("PRODUCTION REPLACEMENT BLOCKED");for(const g of open)console.error(g.id+": "+g.reason);process.exit(1);}
console.log("All site-specific gates have retained evidence; review before deployment.");
