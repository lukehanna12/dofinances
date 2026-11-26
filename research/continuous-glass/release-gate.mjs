import {readFileSync} from "node:fs";
const manifest=JSON.parse(readFileSync(new URL("./RELEASE_CRITERIA.json",import.meta.url),"utf8"));
const required=["continuous-procedural-field","coordinate-separation","fixed-source-reconstruction","complete-vector-ingestion","native-parameter-and-blur","native-numerical-semantics","native-output-semantics","native-interaction","native-heldout-output","production-performance-and-regressions"];
const got=manifest.gates??[];
const structurallyValid=manifest.schema==="continuous-glass-release-gate-v1"&&got.length===required.length&&new Set(got.map(x=>x.id)).size===required.length&&required.every(id=>got.some(x=>x.id===id))&&got.every(x=>["passed","open"].includes(x.status));
if(!structurallyValid){console.error("INVALID RELEASE CRITERIA");process.exit(2);}
const open=got.filter(x=>x.status!=="passed");
if(open.length){console.error("PRODUCTION REPLACEMENT BLOCKED");for(const x of open)console.error(x.id+": "+x.reason);process.exit(1);}
console.log("Research gate manifest records all required gates passed; verify retained evidence independently before deployment.");
