/** Frequency-weighted RGBA palette. Alpha participates in clustering, so translucent
 * regions never dilute opaque pixels of the same RGB colour. No random sampling. */
export function quantizeRgba(image: { data: Uint8ClampedArray; width: number; height: number }, limit: number) {
  const { data, width, height } = image
  type Bin = { count: number; rgba: number[]; feature: number[]; label: number }
  const bins = new Map<number, Bin>()
  const keyAt = (i: number) => ((data[i] >> 3) << 14) | ((data[i + 1] >> 3) << 9) | ((data[i + 2] >> 3) << 4) | (data[i + 3] >> 4)
  // Premultiplied colour and alpha jointly measure visible differences.
  const feature = (v: number[]) => { const a = v[3] / 255; return [v[0] * a * .55, v[1] * a * .75, v[2] * a * .45, v[3] * .8] }
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue
    const key = keyAt(i), bin = bins.get(key)
    if (bin) { bin.count++; for (let c = 0; c < 4; c++) bin.rgba[c] += data[i + c] }
    else bins.set(key, { count: 1, rgba: Array.from(data.slice(i, i + 4)), feature: [], label: 0 })
  }
  const points = [...bins.values()]
  for (const p of points) { p.rgba = p.rgba.map(v => v / p.count); p.feature = feature(p.rgba) }
  if (!points.length) return { bitmaps: [], palette: [], alphas: [] }
  const mean = (ps: Bin[]) => { const sum = [0,0,0,0]; let n = 0; for (const p of ps) { n += p.count; p.feature.forEach((v,c) => sum[c] += v * p.count) } return sum.map(v => v / n) }
  const describe = (ps: Bin[]) => {
    const m = mean(ps), variance = [0,0,0,0]
    for (const p of ps) p.feature.forEach((v,c) => variance[c] += (v-m[c]) ** 2 * p.count)
    const axis = variance.indexOf(Math.max(...variance))
    return { ps, axis, score: variance[axis] }
  }
  const groups = [describe(points)]
  while (groups.length < Math.min(64, Math.max(2, limit))) {
    let idx = 0; groups.forEach((g,i) => { if (g.score > groups[idx].score) idx = i })
    const g = groups[idx]; if (g.score < 1e-6 || g.ps.length < 2) break
    const sorted = [...g.ps].sort((a,b) => a.feature[g.axis]-b.feature[g.axis])
    const middle = mean(sorted)[g.axis]
    let split = sorted.findIndex(p => p.feature[g.axis] > middle)
    if (split < 1) split = Math.floor(sorted.length / 2)
    groups.splice(idx, 1, describe(sorted.slice(0,split)), describe(sorted.slice(split)))
  }
  let centers = groups.map(g => mean(g.ps))
  // Lloyd refinement reduces reconstruction error over the variance-split seeds.
  for (let iteration = 0; iteration < 5; iteration++) {
    const sums = centers.map(() => [0,0,0,0]), counts = centers.map(() => 0)
    for (const p of points) {
      let distance = Infinity
      centers.forEach((center,c) => { const d = p.feature.reduce((s,v,j) => s+(v-center[j])**2,0); if (d < distance) { distance=d; p.label=c } })
      counts[p.label] += p.count
      p.feature.forEach((v,j) => sums[p.label][j] += v*p.count)
    }
    centers = centers.map((v,i) => counts[i] ? sums[i].map(s => s/counts[i]) : v)
  }
  const sums = centers.map(() => [0,0,0,0]), counts = centers.map(() => 0)
  for (const p of points) { counts[p.label] += p.count; p.rgba.forEach((v,c) => sums[p.label][c] += v*p.count) }
  const palette = sums.map((s,i) => '#' + s.slice(0,3).map(v => Math.round(v/(counts[i]||1)).toString(16).padStart(2,'0')).join(''))
  const alphas = sums.map((s,i) => s[3]/(counts[i]||1)/255)
  const bitmaps = centers.map(() => new Uint8Array(width*height))
  for (let p=0;p<width*height;p++) { const i=p*4; if (data[i+3]>=8) bitmaps[bins.get(keyAt(i))!.label][p]=1 }
  return { bitmaps, palette, alphas }
}
