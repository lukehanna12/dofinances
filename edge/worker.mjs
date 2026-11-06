import {handleRequest} from "./router.mjs";
export {AuthStore} from "./auth-store.mjs";
export {siteFolder,assetCandidates,handleRequest} from "./router.mjs";
export default {fetch(request,env){return handleRequest(request,env);}};
