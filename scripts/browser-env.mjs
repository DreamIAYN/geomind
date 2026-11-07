import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.HOME = path.join(root, '.chrome-home');
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, '.pw-browsers');
export const ROOT = root;
