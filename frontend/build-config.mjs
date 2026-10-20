import { writeFile } from 'node:fs/promises';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const appUrl = process.env.APP_URL || '';
if (!url || !anonKey) {
  throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY in the deployment environment.');
}
const config = `window.SUPABASE_URL = ${JSON.stringify(url)};\nwindow.SUPABASE_ANON_KEY = ${JSON.stringify(anonKey)};\nwindow.APP_URL = ${JSON.stringify(appUrl)};\n`;
await writeFile(new URL('./config.js', import.meta.url), config, 'utf8');
console.log('Generated frontend/config.js');
