// Debug script: verify contract and account on GenLayer studionet
import { createClient, chains } from 'genlayer-js';
import { privateKeyToAccount } from 'viem/accounts';

const CONTRACT = '0xfDee7742cf23331a1Ad3add09eEAa929c32C0ae7';
const TEST_KEY  = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const account = privateKeyToAccount(TEST_KEY);
const client  = createClient({ chain: chains.studionet, account });

console.log('=== PactKeeper Debug ===');
console.log('Contract :', CONTRACT);
console.log('Account  :', account.address);

// 1. Try PactKeeper-specific function
console.log('\n--- Test 1: total_pacts() ---');
try {
  const r = await client.readContract({ address: CONTRACT, functionName: 'total_pacts', args: [] });
  console.log('total_pacts =>', r, '(type:', typeof r, ')');
} catch (e) {
  console.log('FAIL total_pacts:', e.message);
}

// 2. Try sanity contract function
console.log('\n--- Test 2: count() (sanity contract) ---');
try {
  const r = await client.readContract({ address: CONTRACT, functionName: 'count', args: [] });
  console.log('count =>', r, '  <-- THIS IS THE SANITY CONTRACT, not PactKeeper!');
} catch (e) {
  console.log('count() not found (good, means it is NOT the sanity contract):', e.message?.slice(0,80));
}

// 3. Try reading pact 0 (should return "{}" if empty)
console.log('\n--- Test 3: get_pact(0) ---');
try {
  const r = await client.readContract({ address: CONTRACT, functionName: 'get_pact', args: [BigInt(0)] });
  console.log('get_pact(0) =>', r);
} catch (e) {
  console.log('FAIL get_pact:', e.message?.slice(0,120));
}

// 4. Check account balance
console.log('\n--- Test 4: account balance ---');
try {
  const bal = await client.getBalance({ address: account.address });
  console.log('Balance of', account.address, '=>', bal.toString(), 'wei');
} catch (e) {
  console.log('FAIL getBalance:', e.message?.slice(0,80));
}
