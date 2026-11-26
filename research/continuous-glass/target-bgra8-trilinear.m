// Owned public G14G BGRA8 normalized bilinear/trilinear half4 sampler.
#import <Foundation/Foundation.h>
#import <Metal/Metal.h>
#include <stdint.h>
static NSString* hex(const void*p,NSUInteger n){NSMutableString*s=[NSMutableString string];const uint8_t*b=p;for(NSUInteger i=0;i<n;i++)[s appendFormat:@"%02x",b[i]];return s;}
static uint32_t mix(uint32_t n){n^=n>>16;n*=0x7feb352dU;n^=n>>15;n*=0x846ca68bU;return n^(n>>16);}
int main(int argc,const char **argv){@autoreleasepool{
 BOOL heldout=argc==2 && strcmp(argv[1],"heldout")==0;
 id<MTLDevice>d=MTLCreateSystemDefaultDevice();NSError*err=nil;
 NSString*code=@"#include <metal_stdlib>\nusing namespace metal;\nkernel void probe(texture2d<half,access::sample> t [[texture(0)]], device const float4 *p [[buffer(0)]],device half4 *o [[buffer(1)]],uint i [[thread_position_in_grid]]){constexpr sampler s(coord::normalized,address::clamp_to_edge,filter::linear,mip_filter::linear);o[i]=t.sample(s,p[i].xy,level(p[i].z));}";
 id<MTLLibrary>lib=[d newLibraryWithSource:code options:nil error:&err];if(!lib){NSLog(@"%@",err);return 1;}
 id<MTLComputePipelineState>ps=[d newComputePipelineStateWithFunction:[lib newFunctionWithName:@"probe"] error:&err];if(!ps){NSLog(@"%@",err);return 1;}
 id<MTLCommandQueue>q=[d newCommandQueue];
 const int dims[2][4][2]={{{16,16},{29,19},{7,11},{1,9}},{{15,21},{33,9},{128,65},{11,1}}};
 for(int i=0;i<4;i++){
  int k=i+(heldout?11:0),w=dims[heldout][i][0],h=dims[heldout][i][1],n=heldout?4096:2048;
  MTLTextureDescriptor*td=[MTLTextureDescriptor texture2DDescriptorWithPixelFormat:MTLPixelFormatBGRA8Unorm width:w height:h mipmapped:YES];td.storageMode=MTLStorageModeShared;td.usage=MTLTextureUsageShaderRead;
  id<MTLTexture>t=[d newTextureWithDescriptor:td];
  for(int l=0;l<t.mipmapLevelCount;l++){
   int a=MAX(1,w>>l),b=MAX(1,h>>l);NSMutableData*data=[NSMutableData dataWithLength:a*b*4];uint8_t*p=data.mutableBytes;
   for(int j=0;j<a*b*4;j++)p[j]=mix(j+10007*k+5011*l)&255;
   [t replaceRegion:MTLRegionMake2D(0,0,a,b) mipmapLevel:l withBytes:p bytesPerRow:a*4];
  }
  id<MTLBuffer>p=[d newBufferWithLength:n*16 options:MTLResourceStorageModeShared],o=[d newBufferWithLength:n*8 options:MTLResourceStorageModeShared];
  float*v=p.contents;
  for(int j=0;j<n;j++){
   int x=(int)(mix(j+313*k)%(w+2))-1,y=(int)(mix(j+701*k+17)%(h+2))-1;
   int u=mix(j+907*k+57)%1024,z=mix(j+2017*k+113)%1024;
   v[4*j]=(x+.5f+u/1024.0f)/w;v[4*j+1]=(y+.5f+z/1024.0f)/h;
   v[4*j+2]=(int)(mix(j+3079*k+19)%((t.mipmapLevelCount+1)*2048))/2048.0f-.5f;v[4*j+3]=0;
  }
  id<MTLCommandBuffer>b=[q commandBuffer];id<MTLComputeCommandEncoder>e=[b computeCommandEncoder];[e setComputePipelineState:ps];[e setTexture:t atIndex:0];[e setBuffer:p offset:0 atIndex:0];[e setBuffer:o offset:0 atIndex:1];[e dispatchThreads:MTLSizeMake(n,1,1) threadsPerThreadgroup:MTLSizeMake(32,1,1)];[e endEncoding];[b commit];[b waitUntilCompleted];if(b.status!=MTLCommandBufferStatusCompleted)return 2;
  printf("CASE %d %d %d %s %s\n",k,w,h,hex(p.contents,n*16).UTF8String,hex(o.contents,n*8).UTF8String);
 }
}}
