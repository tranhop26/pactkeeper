// Check all 3 contracts on GenLayer Studionet
import { createClient, chains } from 'genlayer-js';

const client = createClient({ chain: chains.studionet });

const CONTRACTS = {
  PactKeeper:  '0xC978Bbc3B7f16dd0bF629005F60FeD5E49a83cC1',
  TruthMarket: '0x0ba8A1f3A816236237CE4d2a9FE1633a00dd81bD',
  CredChain:   '0x9DCED4d359A2969EA094c5DF674e01f3AB309CBf',
};

async function check() {
  console.log('=== Checking 3 contracts on Studionet ===\n');

  // PactKeeper — total_pacts()
  try {
    const r = await client.readContract({
      address: CONTRACTS.PactKeeper,
      functionName: 'total_pacts',
      args: [],
    });
    console.log(`✅ PactKeeper (${CONTRACTS.PactKeeper})`);
    console.log(`   total_pacts() = ${r}`);
  } catch (e) {
    console.log(`❌ PactKeeper ERROR: ${e.message}`);
  }

  // TruthMarket — get_all_markets_summary()
  try {
    const r = await client.readContract({
      address: CONTRACTS.TruthMarket,
      functionName: 'get_all_markets_summary',
      args: [],
    });
    const markets = JSON.parse(r);
    console.log(`\n✅ TruthMarket (${CONTRACTS.TruthMarket})`);
    console.log(`   get_all_markets_summary() = ${markets.length} markets`);
  } catch (e) {
    console.log(`\n❌ TruthMarket ERROR: ${e.message}`);
  }

  // CredChain — get_request_counter()
  try {
    const r = await client.readContract({
      address: CONTRACTS.CredChain,
      functionName: 'get_request_counter',
      args: [],
    });
    console.log(`\n✅ CredChain (${CONTRACTS.CredChain})`);
    console.log(`   get_request_counter() = ${r}`);
  } catch (e) {
    console.log(`\n❌ CredChain ERROR: ${e.message}`);
  }

  console.log('\n=== Done ===');
}

check().catch(console.error);
