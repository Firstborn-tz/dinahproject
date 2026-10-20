import { writeFile } from 'node:fs/promises';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
// APP_URL can be set explicitly, while Vercel's production domain provides a
// safe fallback for deployments where that variable was not configured.
const isLocalUrl = (value) => {
  try {
    const hostname = new URL(value).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
};
const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
const vercelUrl = vercelDomain ? `https://${vercelDomain}` : '';
const configuredAppUrl = (process.env.APP_URL || '').trim();
const appUrl = process.env.VERCEL
  ? (configuredAppUrl && !isLocalUrl(configuredAppUrl) ? configuredAppUrl : vercelUrl)
  : configuredAppUrl;
if (!url || !anonKey) {
  throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY in the deployment environment.');
}
const config = `window.SUPABASE_URL = ${JSON.stringify(url)};\nwindow.SUPABASE_ANON_KEY = ${JSON.stringify(anonKey)};\nwindow.APP_URL = ${JSON.stringify(appUrl)};\n`;
await writeFile(new URL('./config.js', import.meta.url), config, 'utf8');
console.log('Generated frontend/config.js');
