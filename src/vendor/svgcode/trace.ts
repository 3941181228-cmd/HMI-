/**
 * SVGcode—Convert raster images to SVG vector graphics
 * Copyright (C) 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */


// Adapted for HMI, 2026-09-09. Upstream: tomayac/SVGcode
// d8837bbe0bee4e1e8203bb2b5484fea60f574596/src/js/colorworker.js.
// Changes: typed worker API, bounded colour preprocessing, sequential masks,
// preserved transforms/alpha, explicit errors and native-pixel stroke units.
import { potrace, init } from '../esm-potrace-wasm/index.js'
import { quantizeRgba } from '../../services/vectorPalette'
import type { SvgTraceOptions } from '../../services/imageToSvg'

export interface SvgcodeOptions extends Partial<SvgTraceOptions> {
  engine?: 'svgcode' | 'hmi'
  preserveColors?: boolean
  strokeWidth?: number
  optimizeSvg?: boolean
}
export interface TraceProgress { processed: number; total: number; stage: string }
export interface SvgcodeResult { svg: string; colors: number; quantized: boolean }

// Based on SVGcode's extractColors. Stop early on complex images, avoiding an
// unbounded table containing millions of distinct colours.
function extractColors(image: ImageData, maximum: number) {
  const colors = new Map<string, number[]>()
  for (let i = 0; i < image.data.length; i += 4) {
    const [r,g,b,a] = image.data.subarray(i,i+4)
    if (a === 0) continue
    const rgba = `${r},${g},${b},${a}`
    const locations = colors.get(rgba)
    if (locations) locations.push(i)
    else {
      if (colors.size >= maximum) return null
      colors.set(rgba,[i])
    }
  }
  return colors
}

export async function convertSvgcode(input: ImageData, options: SvgcodeOptions = {}, progress: (p: TraceProgress) => void = () => {}): Promise<SvgcodeResult> {
  const { width, height } = input
  if (!width || !height || width * height > 4_000_000) throw new Error('图片需小于 400 万像素')
  progress({ processed: 0, total: 1, stage: '分析颜色' })
  let image = input
  if (options.mode === 'brightness') {
    image = new ImageData(width,height)
    const threshold = Math.min(1,Math.max(0,options.brightnessThreshold ?? .45))
    for (let i=0;i<input.data.length;i+=4) {
      const l=(input.data[i]+input.data[i+1]+input.data[i+2])/765
      image.data[i+3]=input.data[i+3]>=128 && l<threshold ? 255 : 0
    }
  }
  let colors = options.preserveColors === false && options.mode !== 'brightness' ? null : extractColors(image,128)
  const quantized = colors === null
  if (!colors) {
    // HMI adaptation: bound the upstream per-RGBA tracing workload with our
    // alpha-aware palette when the original image has more than 128 colours.
    const reduced=quantizeRgba(image,options.colorCount ?? 32)
    const data=new ImageData(width,height)
    reduced.bitmaps.forEach((bitmap,index)=>{
      const rgb=reduced.palette[index].slice(1).match(/../g)!.map(v=>parseInt(v,16))
      const alpha=Math.round(reduced.alphas[index]*255)
      for(let p=0;p<bitmap.length;p++) if(bitmap[p]) {
        const i=p*4;data.data[i]=rgb[0];data.data[i+1]=rgb[1];data.data[i+2]=rgb[2];data.data[i+3]=alpha
      }
    })
    colors=extractColors(data,128)!
  }
  if (!colors?.size) throw new Error('未找到可描摹的像素，请检查透明度或亮度阈值')
  await init()
  const bodies: string[]=[]
  let processed=0
  const strokeWidth=Math.min(1,Math.max(0,options.strokeWidth ?? 0))
  for(const [color,occurrences] of colors) {
    const mask=new ImageData(width,height);mask.data.fill(255)
    for(const location of occurrences) mask.data[location]=mask.data[location+1]=mask.data[location+2]=0
    const native=await potrace(mask,{
      pathonly:false,extractcolors:false,
      turdsize:options.turdSize ?? 0, alphamax:options.alphaMax ?? .8,
      turnpolicy:4,opticurve:options.curveOptimization === false ? 0 : 1,
      opttolerance:options.opttolerance ?? .05,
    })
    if(typeof native !== 'string') throw new Error('描摹引擎未返回完整 SVG')
    const body=native.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/)?.[1]
    if(!body) throw new Error('描摹引擎返回的 SVG 格式无效')
    const [r,g,b,a]=color.split(',').map(Number)
    const fill=`rgb(${r},${g},${b})`
    // Potrace's local path coordinates are 10x source pixels and vertically
    // flipped. Preserve the original group transform when combining layers.
    const paint=body.replace('fill="#000000" stroke="none"',
      `fill="${fill}" fill-opacity="${(a/255).toFixed(5)}" stroke="${strokeWidth && a===255 ? fill : 'none'}" stroke-width="${strokeWidth*10}" stroke-linejoin="round"`)
    if (/<path\b/.test(paint)) bodies.push(paint)
    progress({processed:++processed,total:colors.size,stage:'逐色描摹'})
  }
  if(!bodies.length) throw new Error('轮廓已被去噪过滤，请降低去除小斑点参数')
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${bodies.join('')}</svg>`
  return {svg,colors:colors.size,quantized}
}
