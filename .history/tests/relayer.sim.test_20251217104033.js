import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const run = promisify(exec);

test('sim-run creates relayer state file', async () => {
  // Run the sim-run script
  await run('node src/relayer/sim-run.js');
  const raw = await fs.readFile('.relayer_state.json', 'utf8');
  const state = JSON.parse(raw);
  expect(state).toHaveProperty('lastProcessedBlock');
  expect(Array.isArray(state.nullifiers)).toBe(true);
});
