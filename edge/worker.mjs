import {handleRequest} from "./router.mjs";
// The projects layer extends auth-store-federated.mjs without changing sessions.
export {AuthStore} from "./auth-store-projects.mjs";
export {siteFolder,assetCandidates,handleRequest} from "./router.mjs";
export default {fetch(request,env){return handleRequest(request,env);}};
