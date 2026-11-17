// node のスクリプトから public/words.json を読む
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseWordsJson } from '../src/data/words.js';

const path = fileURLToPath(new URL('../public/words.json', import.meta.url));
export const { words: WORDS, skipped: SKIPPED } = parseWordsJson(JSON.parse(readFileSync(path, 'utf8')));
