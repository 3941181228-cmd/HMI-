import { readFile, readdir, mkdir, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { build } from 'esbuild'

// Embed this small Vite bundle so the existing app and API share one Worker origin.
const assets = {}
async function collect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'server' || entry.name === '_redirects') continue
    const relative = `${prefix}/${entry.name}`
    if (entry.isDirectory()) await collect(join(directory, entry.name), relative)
    else assets[relative] = await readFile(join(directory, entry.name), 'utf8')
  }
}
await collect('dist')
await mkdir('dist/server', { recursive: true })
await mkdir('dist/.openai', { recursive: true })
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json')
const source = `import { handleApi } from './server/sites-api.mjs';
const assets = ${JSON.stringify(assets)};
export default { async fetch(request, env) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return handleApi(request, env);
  if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed', {status:405});
  if (url.pathname.startsWith('/images/')) return Response.redirect('https://raw.githubusercontent.com/3941181228-cmd/HMI-/5a50fee575e1dd1eaed1dc702fb3426ce65cd6a9/public'+url.pathname,302);
  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  const body = assets[path];
  if (body === undefined) return new Response('Not found',{status:404});
  const type = path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html';
  return new Response(request.method === 'HEAD' ? null : body, {headers:{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-cache'}});
}};`
await build({ stdin: { contents: source, resolveDir: process.cwd(), sourcefile: 'sites-entry.mjs' },
  outfile: 'dist/server/index.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true })
console.log('Built Sites app and Jimeng API Worker')
