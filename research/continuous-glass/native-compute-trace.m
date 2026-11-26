// Owned-process Metal API trace; no system modifications, no external app attachment.
// Only observation hooks. No command injection or private resource readback.
#import <Foundation/Foundation.h>
#import <Metal/Metal.h>
#import <objc/runtime.h>
#include <stdio.h>
#include <stdint.h>
#import <CommonCrypto/CommonDigest.h>
#include <zlib.h>
static NSMutableDictionary *states,*parents,*objects,*selected;
static BOOL readback;
static NSObject *lock;
static unsigned eventCount;
static IMP origPipeline,origTexture,origTextures,origBytes,origBuffer,origDispatch,origThreads,origEnd,origCreate,origCreateType,origCreateDesc;
static NSValue *key(id e){return [NSValue valueWithPointer:(__bridge void*)e];}
static NSMutableDictionary *state(id e){
 NSValue *k=key(e);NSMutableDictionary *s=states[k];
 if(!s){s=[NSMutableDictionary dictionary];states[k]=s;}return s;
}
static NSString *hex(const void *p,NSUInteger n){
 if(!p||n>128)return @"";
 const unsigned char *b=p;NSMutableString *s=[NSMutableString string];
 for(NSUInteger i=0;i<n;i++)[s appendFormat:@"%02x",b[i]];return s;
}
static NSDictionary *tex(id<MTLTexture> t){
 if(!t)return @{};
 return @{@"ptr":[NSString stringWithFormat:@"%p",t],@"w":@(t.width),@"h":@(t.height),@"mips":@(t.mipmapLevelCount),@"format":@(t.pixelFormat),@"usage":@(t.usage),@"storage":@(t.storageMode),@"label":t.label?:@""};
}
static void pipeline(id e,SEL c,id<MTLComputePipelineState> p){
 ((void(*)(id,SEL,id))origPipeline)(e,c,p);
 @synchronized(lock){state(e)[@"pipeline"]=p.label?:@"";}
}
static void texture(id e,SEL c,id<MTLTexture> t,NSUInteger i){
 ((void(*)(id,SEL,id,NSUInteger))origTexture)(e,c,t,i);
 @synchronized(lock){state(e)[[NSString stringWithFormat:@"tex%lu",(unsigned long)i]]=tex(t);if(readback){NSMutableDictionary *d=objects[key(e)]?:[NSMutableDictionary dictionary];objects[key(e)]=d;if(t)d[@(i)]=t;else[d removeObjectForKey:@(i)];}}
}
static void textures(id e,SEL c,const id<MTLTexture> __unsafe_unretained *t,NSRange r){
 ((void(*)(id,SEL,const id<MTLTexture> __unsafe_unretained*,NSRange))origTextures)(e,c,t,r);
 @synchronized(lock){for(NSUInteger i=0;i<r.length;i++){state(e)[[NSString stringWithFormat:@"tex%lu",(unsigned long)(r.location+i)]]=tex(t[i]);if(readback){NSMutableDictionary *d=objects[key(e)]?:[NSMutableDictionary dictionary];objects[key(e)]=d;if(t[i])d[@(r.location+i)]=t[i];else[d removeObjectForKey:@(r.location+i)];}}}
}
static void bytes(id e,SEL c,const void *p,NSUInteger n,NSUInteger i){
 ((void(*)(id,SEL,const void*,NSUInteger,NSUInteger))origBytes)(e,c,p,n,i);
 if(i==0)@synchronized(lock){state(e)[@"uniform"]=@{@"kind":@"inline",@"length":@(n),@"hex":hex(p,n)};}
}
static void buffer(id e,SEL c,id<MTLBuffer> b,NSUInteger o,NSUInteger i){
 ((void(*)(id,SEL,id,NSUInteger,NSUInteger))origBuffer)(e,c,b,o,i);
 if(i==0)@synchronized(lock){
  NSUInteger n=b && o<b.length?MIN(32,b.length-o):0;
  const void *p=(n&&b.storageMode==MTLStorageModeShared&&b.contents)?(const char*)b.contents+o:NULL;
  state(e)[@"uniform"]=@{@"kind":@"buffer",@"offset":@(o),@"length":@(n),@"hex":hex(p,n)};
 }
}
static void emit(id e,NSString *kind,MTLSize grid,MTLSize group){
 @synchronized(lock){
  if(eventCount>=64)return;eventCount++;
  NSMutableDictionary *s=[state(e) mutableCopy];
  if(readback&&[s[@"pipeline"] containsString:@"variable_blur_"]){
   NSMutableDictionary *d=selected[key(e)]?:[NSMutableDictionary dictionary];selected[key(e)]=d;
   for(id<MTLTexture> t in [objects[key(e)] allValues])if(t)d[key(t)]=t;
  }
  s[@"kind"]=kind;s[@"event"]=@(eventCount);s[@"encoder"]=[NSString stringWithFormat:@"%p",e];
  s[@"grid"]=@[@(grid.width),@(grid.height),@(grid.depth)];s[@"group"]=@[@(group.width),@(group.height),@(group.depth)];
  NSData *d=[NSJSONSerialization dataWithJSONObject:s options:NSJSONWritingSortedKeys error:nil];
  fprintf(stdout,"COMPUTE %s\n",[[[NSString alloc]initWithData:d encoding:NSUTF8StringEncoding] UTF8String]);fflush(stdout);
 }
}
static void dispatch(id e,SEL c,MTLSize g,MTLSize t){
 emit(e,@"threadgroups",g,t);((void(*)(id,SEL,MTLSize,MTLSize))origDispatch)(e,c,g,t);
}
static void threads(id e,SEL c,MTLSize g,MTLSize t){
 emit(e,@"threads",g,t);((void(*)(id,SEL,MTLSize,MTLSize))origThreads)(e,c,g,t);
}
static id created(id b,id e){
 if(readback&&e)@synchronized(lock){parents[key(e)]=b;}return e;
}
static id create(id b,SEL c){return created(b,((id(*)(id,SEL))origCreate)(b,c));}
static id createType(id b,SEL c,NSUInteger type){return created(b,((id(*)(id,SEL,NSUInteger))origCreateType)(b,c,type));}
static id createDesc(id b,SEL c,id desc){return created(b,((id(*)(id,SEL,id))origCreateDesc)(b,c,desc));}
static void end(id e,SEL c){
 ((void(*)(id,SEL))origEnd)(e,c);
 id<MTLCommandBuffer> parent=nil;NSArray *texturesToRead=nil;
 @synchronized(lock){
  parent=parents[key(e)];texturesToRead=[selected[key(e)] allValues];
  [states removeObjectForKey:key(e)];[parents removeObjectForKey:key(e)];[objects removeObjectForKey:key(e)];[selected removeObjectForKey:key(e)];
 }
 if(!readback||!texturesToRead.count)return;
 if(!parent||texturesToRead.count>4){fprintf(stdout,"READBACK_REJECT parent_or_count\n");return;}
 NSMutableArray *copies=[NSMutableArray array];
 id<MTLBlitCommandEncoder> blit=nil;
 for(id<MTLTexture> t in texturesToRead){
  if(t.textureType!=MTLTextureType2D||t.pixelFormat!=MTLPixelFormatBGRA8Unorm||t.framebufferOnly||t.width>256||t.height>256||t.mipmapLevelCount>8){
   fprintf(stdout,"READBACK_REJECT texture %p\n",t);continue;
  }
  if(!blit)blit=[parent blitCommandEncoder];
  for(NSUInteger m=0;m<t.mipmapLevelCount;m++){
   NSUInteger w=MAX(1,t.width>>m),h=MAX(1,t.height>>m),stride=(w*4+255)&~255;
   id<MTLBuffer> dest=[t.device newBufferWithLength:stride*h options:MTLResourceStorageModeShared];
   if(!dest)abort();
   [blit copyFromTexture:t sourceSlice:0 sourceLevel:m sourceOrigin:MTLOriginMake(0,0,0) sourceSize:MTLSizeMake(w,h,1) toBuffer:dest destinationOffset:0 destinationBytesPerRow:stride destinationBytesPerImage:stride*h];
   [copies addObject:@{@"tex":tex(t),@"level":@(m),@"w":@(w),@"h":@(h),@"stride":@(stride),@"buffer":dest}];
  }
 }
 if(!blit)return;
 [blit endEncoding];
 [parent addCompletedHandler:^(id<MTLCommandBuffer> cb){
  @synchronized(lock){
   if(cb.status!=MTLCommandBufferStatusCompleted){fprintf(stdout,"READBACK_REJECT command_status %lu\n",(unsigned long)cb.status);return;}
   for(NSDictionary *v in copies){
    NSUInteger w=[v[@"w"] unsignedIntegerValue],h=[v[@"h"] unsignedIntegerValue],stride=[v[@"stride"] unsignedIntegerValue];
    id<MTLBuffer> dest=v[@"buffer"];NSMutableData *raw=[NSMutableData dataWithLength:w*h*4];
    for(NSUInteger y=0;y<h;y++)memcpy((char*)raw.mutableBytes+y*w*4,(char*)dest.contents+y*stride,w*4);
    unsigned char sha[CC_SHA256_DIGEST_LENGTH];CC_SHA256(raw.bytes,(CC_LONG)raw.length,sha);
    uLongf cap=compressBound(raw.length);NSMutableData *z=[NSMutableData dataWithLength:cap];
    if(compress2(z.mutableBytes,&cap,raw.bytes,raw.length,Z_BEST_COMPRESSION)!=Z_OK)abort();
    z.length=cap;
    NSMutableDictionary *out=[v mutableCopy];[out removeObjectForKey:@"buffer"];[out removeObjectForKey:@"stride"];
    out[@"sha256"]=hex(sha,sizeof sha);out[@"rawBytes"]=@(raw.length);out[@"zlib64"]=[z base64EncodedStringWithOptions:0];
    NSData *json=[NSJSONSerialization dataWithJSONObject:out options:NSJSONWritingSortedKeys error:nil];
    fprintf(stdout,"READBACK %s\n",[[[NSString alloc]initWithData:json encoding:NSUTF8StringEncoding] UTF8String]);fflush(stdout);
   }
  }
 }];
}
static IMP hook(Class cls,SEL s,IMP imp){
 Method m=class_getInstanceMethod(cls,s);if(!m){fprintf(stderr,"MISSING %s\n",sel_getName(s));abort();}
 IMP before=method_getImplementation(m);const char *enc=method_getTypeEncoding(m);
 if(!class_addMethod(cls,s,imp,enc))method_setImplementation(class_getInstanceMethod(cls,s),imp);
 return before;
}
void install_compute_trace(void){
 states=[NSMutableDictionary dictionary];parents=[NSMutableDictionary dictionary];objects=[NSMutableDictionary dictionary];selected=[NSMutableDictionary dictionary];lock=[NSObject new];readback=getenv("LG_NATIVE_READBACK")!=NULL;
 id<MTLDevice>d=MTLCreateSystemDefaultDevice();id<MTLCommandQueue>q=[d newCommandQueue];
 id<MTLCommandBuffer>b=[q commandBuffer];id<MTLComputeCommandEncoder>e=[b computeCommandEncoder];
 Class c=object_getClass(e),bc=object_getClass(b);[e endEncoding];
 if(readback){origCreate=hook(bc,@selector(computeCommandEncoder),(IMP)create);if(class_getInstanceMethod(bc,@selector(computeCommandEncoderWithDispatchType:)))origCreateType=hook(bc,@selector(computeCommandEncoderWithDispatchType:),(IMP)createType);if(class_getInstanceMethod(bc,@selector(computeCommandEncoderWithDescriptor:)))origCreateDesc=hook(bc,@selector(computeCommandEncoderWithDescriptor:),(IMP)createDesc);}
 origPipeline=hook(c,@selector(setComputePipelineState:),(IMP)pipeline);
 origTexture=hook(c,@selector(setTexture:atIndex:),(IMP)texture);
 origTextures=hook(c,@selector(setTextures:withRange:),(IMP)textures);
 origBytes=hook(c,@selector(setBytes:length:atIndex:),(IMP)bytes);
 origBuffer=hook(c,@selector(setBuffer:offset:atIndex:),(IMP)buffer);
 origDispatch=hook(c,@selector(dispatchThreadgroups:threadsPerThreadgroup:),(IMP)dispatch);
 origThreads=hook(c,@selector(dispatchThreads:threadsPerThreadgroup:),(IMP)threads);
 origEnd=hook(c,@selector(endEncoding),(IMP)end);
 fprintf(stdout,"TRACE_CLASS %s\n",class_getName(c));fflush(stdout);
}
