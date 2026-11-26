// Owned-process Metal API trace; no system modifications, no external app attachment.
// Only observation hooks. No command injection or private resource readback.
#import <Foundation/Foundation.h>
#import <Metal/Metal.h>
#import <objc/runtime.h>
#include <stdio.h>
#include <stdint.h>
static NSMutableDictionary *states;
static NSObject *lock;
static unsigned eventCount;
static IMP origPipeline,origTexture,origTextures,origBytes,origBuffer,origDispatch,origThreads,origEnd;
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
 @synchronized(lock){state(e)[[NSString stringWithFormat:@"tex%lu",(unsigned long)i]]=tex(t);}
}
static void textures(id e,SEL c,const id<MTLTexture> __unsafe_unretained *t,NSRange r){
 ((void(*)(id,SEL,const id<MTLTexture> __unsafe_unretained*,NSRange))origTextures)(e,c,t,r);
 @synchronized(lock){for(NSUInteger i=0;i<r.length;i++)state(e)[[NSString stringWithFormat:@"tex%lu",(unsigned long)(r.location+i)]]=tex(t[i]);}
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
  NSMutableDictionary *s=[state(e) mutableCopy];s[@"kind"]=kind;s[@"event"]=@(eventCount);s[@"encoder"]=[NSString stringWithFormat:@"%p",e];
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
static void end(id e,SEL c){
 ((void(*)(id,SEL))origEnd)(e,c);@synchronized(lock){[states removeObjectForKey:key(e)];}
}
static IMP hook(Class cls,SEL s,IMP imp){
 Method m=class_getInstanceMethod(cls,s);if(!m){fprintf(stderr,"MISSING %s\n",sel_getName(s));abort();}
 IMP before=method_getImplementation(m);const char *enc=method_getTypeEncoding(m);
 if(!class_addMethod(cls,s,imp,enc))method_setImplementation(class_getInstanceMethod(cls,s),imp);
 return before;
}
void install_compute_trace(void){
 states=[NSMutableDictionary dictionary];lock=[NSObject new];
 id<MTLDevice>d=MTLCreateSystemDefaultDevice();id<MTLCommandQueue>q=[d newCommandQueue];
 id<MTLCommandBuffer>b=[q commandBuffer];id<MTLComputeCommandEncoder>e=[b computeCommandEncoder];
 Class c=object_getClass(e);[e endEncoding];
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
