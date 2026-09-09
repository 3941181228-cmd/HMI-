import { imageDataToSvg, type SvgTraceOptions } from './imageToSvg'

self.onmessage = async (event: MessageEvent<{ pixels: Uint8ClampedArray; width: number; height: number; options: SvgTraceOptions }>) => {
  try {
    const { pixels, width, height, options } = event.data
    const svg = await imageDataToSvg(new ImageData(new Uint8ClampedArray(pixels), width, height), options)
    self.postMessage({ svg })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '转换失败，请重试' })
  }
}
