// src/relayer/storage.js
import fs from 'fs/promises';
import path from 'path';

const STATE_FILE = path.resolve(process.cwd(), '.relayer_state.json');

export async function loadState() {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { lastProcessedBlock: 0, nullifiers: [] };
  }
}

export async function saveState(state) {
  const toWrite = JSON.stringify(state, null, 2);
  await fs.writeFile(STATE_FILE, toWrite, 'utf8');
}
