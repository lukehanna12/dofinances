import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {mountProjectArtworkReveal} from "../sites/_apex/assets/project-artwork-reveal.js";

function setup(){
  const frames=[];
  const classes=new Set();
  const listeners={};
  let decodeResolve;
  const image={
    complete:true,naturalWidth:1200,isConnected:true,
    currentSrc:"https://example.test/artwork.jpg",
    src:"https://example.test/artwork.jpg",
    addEventListener:(event,callback)=>{listeners[event]=callback;},
    decode:()=>new Promise(resolve=>{decodeResolve=resolve;})
  };
  const card={classList:{add:name=>classes.add(name)}};
  mountProjectArtworkReveal(image,card,callback=>frames.push(callback));
  return {image,classes,frames,load:()=>listeners.load(),resolve:()=>decodeResolve()};
}

test("artwork reveal waits for image decoding and two separate frame commits",async()=>{
  const {image,classes,frames,load,resolve}=setup();
  const task=load();
  assert.equal(classes.has("is-photo-ready"),false);
  assert.equal(frames.length,0);
  resolve();
  await task;
  assert.equal(classes.has("is-photo-ready"),false,
    "load/decode alone must not start the 500ms zoom");
  assert.equal(frames.length,1);
  frames.shift()();
  assert.equal(classes.has("is-photo-ready"),false,
    "first frame establishes the fully zoomed, invisible image baseline");
  assert.equal(frames.length,1);
  frames.shift()();
  assert.equal(classes.has("is-photo-ready"),true);
  assert.equal(image.naturalWidth,1200);
});

test("stale or removed artwork cannot activate another image transition",async()=>{
  const state=setup();
  const task=state.load();
  state.resolve();
  await task;
  state.image.currentSrc="https://example.test/fallback.jpg";
  state.frames.shift()();
  assert.equal(state.classes.has("is-photo-ready"),false);
  assert.equal(state.frames.length,0);
  const removed=setup();
  const pending=removed.load();
  removed.image.isConnected=false;
  removed.resolve();
  await pending;
  assert.equal(removed.frames.length,0);
  assert.equal(removed.classes.has("is-photo-ready"),false);
});

test("both project views share decoded-image reveal; zoom geometry and duration stay fixed",()=>{
  const pub=readFileSync(new URL("../sites/_apex/assets/public-projects-entry.js",import.meta.url),"utf8");
  const auth=readFileSync(new URL("../sites/_apex/app/assets/project-showcase.js",import.meta.url),"utf8");
  for(const source of [pub,auth]){
    assert.match(source,/mountProjectArtworkReveal\(photo,card\)/);
    assert.match(source,/photo\.decoding="async"/);
    assert.doesNotMatch(source,/photo\.addEventListener\("load",\(\)=>card\.classList\.add\("is-photo-ready"\)/);
  }
  const pubCSS=readFileSync(new URL("../sites/_apex/assets/public-projects.css",import.meta.url),"utf8");
  const authCSS=readFileSync(new URL("../sites/_apex/app/assets/project-showcase.css",import.meta.url),"utf8");
  for(const css of [pubCSS,authCSS]){
    assert.match(css,/opacity:0;transform:scale\(1\.1\)/);
    assert.match(css,/transition:opacity \.5s ease-out,transform \.5s ease-out/);
    assert.match(css,/opacity:1;transform:scale\(1\)/);
  }
});
