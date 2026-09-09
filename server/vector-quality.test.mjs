import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import vm from 'node:vm'
const built = await build({entryPoints:['src/services/vectorPalette.ts'],bundle:true,write:false,format:'iife',globalName:'palette'})
const context = vm.createContext({Uint8Array,Uint8ClampedArray})
vm.runInContext(built.outputFiles[0].text,context)
const quantize = context.palette.quantizeRgba
const image = (colors) => ({width:colors.length,height:1,data:new Uint8ClampedArray(colors.flat())})
const decode = (r,p) => { const i=r.bitmaps.findIndex(b=>b[p]); return i<0 ? [0,0,0,0] : [...r.palette[i].slice(1).match(/../g).map(x=>parseInt(x,16)),r.alphas[i]*255] }
test('opaque and translucent parts of the same colour remain separate',()=>{
 const src=image(Array.from({length:100},(_,i)=>[255,0,0,i<50?255:64]))
 const r=quantize(src,4)
 assert.equal(decode(r,0)[3],255)
 assert.equal(decode(r,99)[3],64)
})
test('rare accent colours survive a dominant dark background',()=>{
 const src=image([...Array.from({length:10000},()=>[16,16,24,255]),[0,240,181,255],[255,0,0,255]])
 const r=quantize(src,8)
 assert.deepEqual(decode(r,10000),[0,240,181,255])
 assert.deepEqual(decode(r,10001),[255,0,0,255])
})
test('higher palette budget reduces visible gradient error',()=>{
 const src=image(Array.from({length:256},(_,i)=>[i,Math.round(i*.6),255-i,255]))
 const error=r=>Array.from({length:256},(_,i)=>decode(r,i).reduce((s,c,k)=>s+(c-src.data[i*4+k])**2,0)).reduce((s,v)=>s+v,0)/256
 const low=error(quantize(src,8)), high=error(quantize(src,32))
 assert.ok(high<low/2,`gradient MSE: 8 colours=${low}, 32 colours=${high}`)
 console.log(`Gradient quantization MSE: ${low.toFixed(2)} → ${high.toFixed(2)} (synthetic fixture only)`)
})
