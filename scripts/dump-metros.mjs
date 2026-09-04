#!/usr/bin/env node
/** Dump the METROS object from count-metro-courses.mjs to JSON for the Python pipeline. */
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync(new URL('./count-metro-courses.mjs', import.meta.url), 'utf8');
const m = src.match(/const METROS = (\{[\s\S]*?\n\});/);
if (!m) throw new Error('METROS object not found in count-metro-courses.mjs');
const METROS = eval('(' + m[1] + ')');
writeFileSync(new URL('./metros.json', import.meta.url), JSON.stringify(METROS, null, 2));
console.log('dumped', Object.keys(METROS).length, 'metros to scripts/metros.json');
