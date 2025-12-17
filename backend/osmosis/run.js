
import { OsmosisRelayer, defaultConfig } from './relayer.js';

async function main() {
    const relayer = new OsmosisRelayer(defaultConfig);
    await relayer.initialize();
    relayer.start();
}

main().catch(console.error);
