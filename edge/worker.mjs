import {handleRequest} from "./router.mjs";
export {AuthStore} from "./auth-store-federated.mjs";
export {siteFolder,assetCandidates,handleRequest} from "./router.mjs";
export default {fetch(request,env){return handleRequest(request,env);}};
