// Execute the installed target's actual QuartzCore compute functions on owned textures.
// This does not copy or redistribute Apple's metallib.
#import <Foundation/Foundation.h>
#import <Metal/Metal.h>
#import <CommonCrypto/CommonDigest.h>
#include <stdint.h>
#include <math.h>
static id<MTLDevice> dev;
static id<MTLCommandQueue> queue;
static id<MTLLibrary> library;
static NSMutableDictionary *pipelines;
static NSString *hex(const void *p,NSUInteger n){
 NSMutableString *s=[NSMutableString string];const uint8_t *b=p;
 for(NSUInteger i=0;i<n;i++)[s appendFormat:@"%02x",b[i]];return s;
}
static NSData *unhex(NSString *s){
 if(s.length%2)abort();NSMutableData *d=[NSMutableData dataWithLength:s.length/2];uint8_t *p=d.mutableBytes;
 for(NSUInteger i=0;i<d.length;i++){unsigned v=0;NSString *a=[s substringWithRange:NSMakeRange(i*2,2)];if(![[NSScanner scannerWithString:a] scanHexInt:&v])abort();p[i]=(uint8_t)v;}return d;
}
static NSString *hash(NSData *d){uint8_t b[32];CC_SHA256(d.bytes,(CC_LONG)d.length,b);return hex(b,32);}
static id<MTLComputePipelineState> pipeline(NSString *name){
 id<MTLComputePipelineState> p=pipelines[name];if(p)return p;
 NSError *error=nil;id<MTLFunction> f=[library newFunctionWithName:name];
 if(!f)abort();p=[dev newComputePipelineStateWithFunction:f error:&error];
 if(!p){NSLog(@"%@",error);abort();}pipelines[name]=p;return p;
}
static id<MTLTexture> texture(NSUInteger w,NSUInteger h,MTLPixelFormat format,BOOL mip){
 MTLTextureDescriptor *d=[MTLTextureDescriptor texture2DDescriptorWithPixelFormat:format width:w height:h mipmapped:mip];
 d.storageMode=MTLStorageModeShared;d.usage=MTLTextureUsageShaderRead|MTLTextureUsageShaderWrite;
 id<MTLTexture> t=[dev newTextureWithDescriptor:d];if(!t)abort();return t;
}
static void write(id<MTLTexture> t,NSUInteger level,NSData *data,NSUInteger bpp){
 NSUInteger w=MAX(1,t.width>>level),h=MAX(1,t.height>>level);
 if(data.length!=w*h*bpp)abort();[t replaceRegion:MTLRegionMake2D(0,0,w,h) mipmapLevel:level withBytes:data.bytes bytesPerRow:w*bpp];
}
static NSData *read(id<MTLTexture> t,NSUInteger level,NSUInteger bpp){
 NSUInteger w=MAX(1,t.width>>level),h=MAX(1,t.height>>level);NSMutableData *d=[NSMutableData dataWithLength:w*h*bpp];
 [t getBytes:d.mutableBytes bytesPerRow:w*bpp fromRegion:MTLRegionMake2D(0,0,w,h) mipmapLevel:level];return d;
}
static void dispatch(NSString *name,id<MTLTexture> input,id<MTLTexture> output,NSData *u,MTLSize grid,MTLSize group){
 id<MTLCommandBuffer> b=[queue commandBuffer];id<MTLComputeCommandEncoder> e=[b computeCommandEncoder];
 [e setComputePipelineState:pipeline(name)];[e setTexture:input atIndex:0];[e setTexture:output atIndex:1];
 [e setBytes:u.bytes length:u.length atIndex:0];
 [e dispatchThreadgroups:grid threadsPerThreadgroup:group];[e endEncoding];[b commit];[b waitUntilCompleted];
 if(b.status!=MTLCommandBufferStatusCompleted){NSLog(@"%@",b.error);abort();}
}
typedef struct {uint16_t src,dst,w,h;float dx,dy;} Down;
_Static_assert(sizeof(Down)==16,"ABI");
static void down(id<MTLTexture> t,NSUInteger src,NSString *name){
 NSUInteger w=MAX(1,t.width>>(src+1)),h=MAX(1,t.height>>(src+1));
 Down u={(uint16_t)src,(uint16_t)(src+1),(uint16_t)w,(uint16_t)h,1.0f/w,1.0f/h};
 dispatch(name,t,t,[NSData dataWithBytes:&u length:sizeof u],MTLSizeMake((w+15)/16,(h+31)/32,1),MTLSizeMake(16,16,1));
}
static uint16_t half(float x){__fp16 h=(__fp16)x;uint16_t u;memcpy(&u,&h,2);return u;}
static float fhalf(uint16_t u){__fp16 h;memcpy(&h,&u,2);return (float)h;}
static void replay(void){
 const NSUInteger w=64,h=64;NSMutableData *d=[NSMutableData dataWithLength:w*h*4];uint8_t *p=d.mutableBytes;
 for(NSUInteger y=0;y<39;y++)for(NSUInteger x=0;x<55;x++){uint8_t v=x==26?136:43;NSUInteger i=(y*w+x)*4;p[i]=p[i+1]=p[i+2]=v;p[i+3]=255;}
 id<MTLTexture> input=texture(w,h,MTLPixelFormatBGRA8Unorm,NO),surface=texture(w,h,MTLPixelFormatBGRA8Unorm,YES);
 write(input,0,d,4);
 NSData *u=unhex(@"ebffebff00000000000000003500250080008000400040000000010000000000");
 dispatch(@"variable_blur_copy_base_mip_compute",input,surface,u,MTLSizeMake(4,4,1),MTLSizeMake(20,20,1));
 printf("REPLAY input %s\n",hash(d).UTF8String);
 printf("REPLAY mip0 %s\n",hash(read(surface,0,4)).UTF8String);
 down(surface,0,@"variable_blur_downsample_compute_agx2");
 printf("REPLAY mip1 %s\n",hash(read(surface,1,4)).UTF8String);
 down(surface,1,@"variable_blur_downsample_compute_agx2");
 printf("REPLAY mip2 %s\n",hash(read(surface,2,4)).UTF8String);
}
static void impulse(void){
 const NSUInteger w=64,h=64;id<MTLTexture> t=texture(w,h,MTLPixelFormatRGBA16Float,YES);
 // Four independent channel lanes encode neighboring one-dimensional source impulses.
 // Target destination sample fixed at (16,16); source base index (32,32).
 for(int axis=0;axis<2;axis++){
  printf("IMPULSE %s",axis?"y":"x");
  for(int start=-12;start<=12;start+=4){
   NSMutableData *d=[NSMutableData dataWithLength:w*h*8];uint16_t *p=d.mutableBytes;
   for(int k=0;k<4;k++){
    int index=32+start+k;
    for(int other=0;other<64;other++){
     int x=axis?other:index,y=axis?index:other;p[(y*64+x)*4+k]=half(1);
    }
   }
   write(t,0,d,8);down(t,0,@"variable_blur_downsample_compute_agx2");
   NSData *r=read(t,1,8);const uint16_t *q=r.bytes;
   for(int k=0;k<4;k++){printf(" %d:%04x",start+k,q[(16*32+16)*4+k]);}
  }
  puts("");
 }
}
int main(int argc,const char **argv){@autoreleasepool{
 dev=MTLCreateSystemDefaultDevice();queue=[dev newCommandQueue];pipelines=[NSMutableDictionary dictionary];NSError *error=nil;
 library=[dev newLibraryWithURL:[NSURL fileURLWithPath:@"/System/Library/Frameworks/QuartzCore.framework/Versions/A/Resources/default.metallib"] error:&error];
 if(!library){NSLog(@"%@",error);return 1;}
 if(argc!=2)return 2;
 if(strcmp(argv[1],"replay")==0)replay();else if(strcmp(argv[1],"impulse")==0)impulse();else return 2;
}}
