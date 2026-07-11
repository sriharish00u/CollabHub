#!/usr/bin/env node
/**
 * Reads root .env and generates assets/js/config.js from the template.
 * Usage: node scripts/build-config.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'assets', 'js', 'config.template.js');
const OUTPUT = path.join(ROOT, 'assets', 'js', 'config.js');
const ENV_FILE = path.join(ROOT, '.env');

function loadEnv(filePath) {
  const vars = {};
  if (!fs.existsSync(filePath)) return vars;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    vars[key] = value;
  }
  return vars;
}

function main() {
  const env = loadEnv(ENV_FILE);
  const apiUrl = env.API_BASE_URL || 'http://localhost:8000';

  if (!fs.existsSync(TEMPLATE)) {
    console.error('Template not found:', TEMPLATE);
    process.exit(1);
  }

  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const output = template.replace(/\{\{API_BASE_URL\}\}/g, apiUrl);

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, output, 'utf8');
  console.log(`Generated ${path.relative(ROOT, OUTPUT)} with API_BASE_URL=${apiUrl}`);
}

main();
