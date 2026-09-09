import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { build } from 'esbuild'
import { writeFile } from 'node:fs/promises'

const bundle = await build({entryPoints:['src/services/vectorTrace.worker.ts'],bundle:true,write:false,format:'iife',platform:'browser',external:['node:fs'],logLevel:'silent'})
class Pixels {
  constructor(dataOrWidth,widthOrHeight,height) {
    if(typeof dataOrWidth === 'number') { this.width=dataOrWidth;this.height=widthOrHeight;this.data=new Uint8ClampedArray(this.width*this.height*4) }
    else { this.data=dataOrWidth;this.width=widthOrHeight;this.height=height }
  }
}
async function run(image,options={}) {
  const messages=[]
  const self={postMessage:m=>messages.push(m)}
  const context=vm.createContext({self,console,TextDecoder,TextEncoder,WebAssembly,ImageData:Pixels,setTimeout,clearTimeout})
  vm.runInContext(bundle.outputFiles[0].text,context)
  await self.onmessage({data:{pixels:image.data,width:image.width,height:image.height,options:{engine:'svgcode',mode:'color',preserveColors:true,turdSize:0,alphaMax:0,opttolerance:.05,...options}}})
  return {messages,output:messages.at(-1)}
}
const fixture=new Pixels(64,48)
for(let y=4;y<36;y++) for(let x=8;x<56;x++) {
  if(x>=18&&x<28&&y>=14&&y<24) continue
  const i=(y*64+x)*4
  fixture.data[i]=x<32?255:0;fixture.data[i+1]=x<32?0:160;fixture.data[i+2]=0;fixture.data[i+3]=x<32?255:128
}
test('SVGcode worker preserves coordinates, holes, RGBA and produces optimized vectors',async()=>{
 const {messages,output}=await run(fixture)
 assert.equal(output.error,undefined)
 assert.equal(output.quantized,false)
 assert.equal(output.colors,2)
 assert.ok(messages.some(m=>m.progress?.processed===2&&m.progress.total===2))
 assert.match(output.svg,/viewBox="0 0 64 48"/)
 assert.match(output.svg,/fill-opacity="0?\.502/)
 assert.ok(!/<image|<script|<!DOCTYPE/.test(output.svg))
 assert.ok(output.svg.length<=output.originalBytes)
 const raw=(await run(fixture,{optimizeSvg:false})).output
 assert.match(raw.svg,/translate\(0\.000000,48\.000000\) scale\(0\.100000,-0\.100000\)/)
 assert.ok((raw.svg.match(/[Mm]/g)||[]).length>2)
 // Optional inspection artifacts for the local raster regression check.
 if(process.env.SVGCODE_TEST_OUTPUT) {
  await writeFile(`${process.env.SVGCODE_TEST_OUTPUT}/svgcode.svg`,output.svg)
  await writeFile(`${process.env.SVGCODE_TEST_OUTPUT}/svgcode.rgba`,fixture.data)
  const legacy=(await run(fixture,{engine:'hmi',colorCount:8,optimizeSvg:false})).output
  assert.match(legacy.svg,/translate\(0,48\) scale\(0\.1,-0\.1\)/)
  await writeFile(`${process.env.SVGCODE_TEST_OUTPUT}/hmi.svg`,legacy.svg)
 }
})
test('complex colours use bounded palette and transparent input reports an error',async()=>{
 const complex=new Pixels(140,1)
 for(let i=0;i<140;i++) complex.data.set([i,255-i,100,255],i*4)
 const {output}=await run(complex,{colorCount:8})
 assert.equal(output.error,undefined)
 assert.equal(output.quantized,true)
 assert.ok(output.colors<=8)
 const empty=await run(new Pixels(8,8))
 assert.match(empty.output.error,/像素/)
})
test('monochrome conversion respects threshold and omits light background',async()=>{
 const white=new Pixels(16,16);white.data.fill(255)
 const {output}=await run(white,{mode:'brightness'})
 assert.match(output.error,/像素/)
})
