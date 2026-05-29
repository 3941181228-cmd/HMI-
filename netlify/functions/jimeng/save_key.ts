import { JIMENG_API_KEY } from '../../_shared'

// For Netlify Functions, since we can't persist state, we just return ok using the env var
export default async function handler(_req: any, res: any) {
  // In Netlify deployment, API keys are configured via environment variables
  // The save_key endpoint is kept for backwards compatibility
  return {
    statusCode: 200,
    body: JSON.stringify({ 
      ok: true, 
      message: JIMENG_API_KEY ? 'API Key 已通过环境变量配置' : '请在 Netlify 控制台配置环境变量' 
    })
  }
}
