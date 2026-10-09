import { mkdir, readFile, writeFile } from 'node:fs/promises'
import JSZip from 'jszip'

const files = ['manifest.json', 'code.js', 'ui.html', 'README.md']
const zip = new JSZip()
for (const file of files) zip.file(file, await readFile(`figma-plugin/${file}`))
await mkdir('public/downloads', { recursive: true })
await writeFile('public/downloads/hmi-theme-swap-plugin.zip', await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
console.log('Packaged public/downloads/hmi-theme-swap-plugin.zip')
