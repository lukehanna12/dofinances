import {test} from "node:test";
import assert from "node:assert/strict";
import {continuousRequested} from "../sites/_apex/assets/home-dashboard/dashboard-glass-continuous.js";
const limits={maxComputeInvocationsPerWorkgroup:256,maxComputeWorkgroupSizeZ:64,maxTextureArrayLayers:256,maxTextureDimension2D:8192};
test("continuous public renderer is default for qualified WebGPU, with explicit legacy override",()=>{
 assert.equal(continuousRequested("",true,limits,1400,880),true);
 assert.equal(continuousRequested("?glass-renderer=baseline",true,limits,1400,880),false);
 assert.equal(continuousRequested("",false,limits,1400,880),false);
 assert.equal(continuousRequested("?glass-renderer=continuous",false,limits,1400,880),true);
});
test("automatic continuous selection respects workgroup and logical-source limits",()=>{
 for(const [k,v] of Object.entries({maxComputeInvocationsPerWorkgroup:128,maxComputeWorkgroupSizeZ:4,maxTextureArrayLayers:16,maxTextureDimension2D:2048})){
  assert.equal(continuousRequested("",true,{...limits,[k]:v},1400,880),false,k);
 }
 assert.equal(continuousRequested("",true,limits,5000,1000),false);
});
