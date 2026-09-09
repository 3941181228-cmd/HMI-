import { imageDataToSvg } from './imageToSvg'
import { convertSvgcode, type SvgcodeOptions } from '../vendor/svgcode/trace'
import { optimize } from 'svgo/browser'

self.onmessage = async (event: MessageEvent<{ pixels: Uint8ClampedArray; width: number; height: number; options: SvgcodeOptions }>) => {
  try {
    const { pixels, width, height, options } = event.data
    const image = new ImageData(new Uint8ClampedArray(pixels), width, height)
    const report = (progress: { processed: number; total: number; stage: string }) => self.postMessage({ progress })
    const result = options.engine === 'svgcode'
      ? await convertSvgcode(image, options, report)
      : { svg: await imageDataToSvg(image, options), quantized: options.mode === 'color', colors: 0 }
    const originalBytes = new TextEncoder().encode(result.svg).length
    if (options.optimizeSvg !== false) {
      report({ processed: 0, total: 1, stage: '优化 SVG' })
      // SVGcode uses SVGO's browser build. Retain colour groups for downstream editing.
      const optimized = optimize(result.svg, {
        multipass: true, floatPrecision: 4,
        plugins: [{ name: 'preset-default', params: { overrides: { collapseGroups: false, mergePaths: false, cleanupIds: false } } }],
      })
      if (optimized.data.length < result.svg.length) result.svg = optimized.data
    }
    self.postMessage({ ...result, originalBytes, engine: options.engine || 'hmi' })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '转换失败，请重试' })
  }
}
