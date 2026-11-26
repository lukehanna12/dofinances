import Foundation
import Metal

// Owned Metal arithmetic experiment, NOT invocation of Apple's Glass shader.
// Compare explicit AIR half cast placement with one final half cast.
// Input: 4 float32 lanes per row. Output: two unsigned binary16 bit patterns.
let source = """
#include <metal_stdlib>
using namespace metal;
kernel void probe(device const float4 *in [[buffer(0)]],device ushort2 *out [[buffer(1)]],uint i [[thread_position_in_grid]]) {
  float4 x=in[i];
  half n=half(x.y);
  half scaled=half(x.x*float(n));
  half inner=min(max(half(x.z),half(x.w)),half(0));
  half staged=inner+scaled;
  half finalOnly=half(min(max(x.z,x.w),0.0f)+x.x*x.y);
  out[i]=ushort2(as_type<ushort>(staged),as_type<ushort>(finalOnly));
}
"""
guard let device=MTLCreateSystemDefaultDevice(),let queue=device.makeCommandQueue() else {fatalError("Metal unavailable")}
let options=MTLCompileOptions();options.fastMathEnabled=false
let lib=try device.makeLibrary(source:source,options:options)
let pipe=try device.makeComputePipelineState(function:lib.makeFunction(name:"probe")!)
let input=try Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1]))
guard input.count>0 && input.count%16==0 else {fatalError("bad input")}
let count=input.count/16
let src=input.withUnsafeBytes{device.makeBuffer(bytes:$0.baseAddress!,length:input.count,options:.storageModeShared)!}
let dst=device.makeBuffer(length:count*4,options:.storageModeShared)!
let command=queue.makeCommandBuffer()!, encoder=command.makeComputeCommandEncoder()!
encoder.setComputePipelineState(pipe);encoder.setBuffer(src,offset:0,index:0);encoder.setBuffer(dst,offset:0,index:1)
encoder.dispatchThreads(MTLSize(width:count,height:1,depth:1),threadsPerThreadgroup:MTLSize(width:min(count,pipe.maxTotalThreadsPerThreadgroup),height:1,depth:1))
encoder.endEncoding();command.commit();command.waitUntilCompleted()
guard command.status == .completed else {fatalError("GPU failed: \(String(describing:command.error))")}
try Data(bytes:dst.contents(),count:count*4).write(to:URL(fileURLWithPath:CommandLine.arguments[2]))
print("TARGET \(ProcessInfo.processInfo.operatingSystemVersionString) / \(device.name) / \(count) rows")
