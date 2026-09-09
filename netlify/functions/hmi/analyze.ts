import analyze from '../../../server/hmi-analysis.mjs'
export default async function handler(event: any) { return analyze(event, process.env) }
