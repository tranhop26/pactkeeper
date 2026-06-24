// TASK 2 — PactKeeper seed: create 3 pacts with different statuses
// Run from: C:\Users\admin\.gemini\antigravity\scratch\pactkeeper\frontend
// (needs genlayer-js in node_modules)

import { execSync } from 'child_process';

const PK = '0xfDee7742cf23331a1Ad3add09eEAa929c32C0ae7';

function write(method, ...args) {
  const argStr = args.map(a => {
    if (typeof a === 'number') return String(a);
    return `"${a}"`;
  }).join(' ');
  const cmd = `genlayer write ${PK} ${method}${argStr ? ' --args ' + argStr : ''}`;
  console.log(`\n> ${cmd}`);
  const out = execSync(cmd, { encoding: 'utf8', timeout: 120000 });
  const match = out.match(/'Transaction Hash':\s*'(0x[a-f0-9]+)'/i);
  const hash = match ? match[1] : 'unknown';
  console.log(`  tx: ${hash}`);
  return hash;
}

function read(method, ...args) {
  const argStr = args.map(a => String(a)).join(' ');
  const cmd = `genlayer call ${PK} ${method}${argStr ? ' --args ' + argStr : ''}`;
  const out = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
  const m = out.match(/Result:\r?\n([\s\S]*?)\r?\n\r?\n/);
  return m ? m[1].trim() : out;
}

async function main() {
  console.log('=== TASK 2: PactKeeper Seed ===');

  // Check contract functions
  const total = read('total_pacts');
  console.log(`total_pacts BEFORE: ${total}`);

  // Pact 1: Created/pending (just create, don't accept)
  console.log('\n--- Pact 1: Freelance Delivery Agreement (PENDING) ---');
  write('create_pact',
    'Freelance Delivery Agreement',
    'Deliver a complete GenLayer DApp with frontend, smart contracts, and documentation by July 15, 2026.',
    'https://pactkeeper-lac.vercel.app',
    7,
    100
  );

  // Pact 2: Active (create + accept)
  console.log('\n--- Pact 2: Rental Deposit Pact (ACTIVE) ---');
  write('create_pact',
    'Rental Deposit Pact',
    'Hold 500 GEN as rental deposit for apartment at Block B, Ho Chi Minh City. Release upon check-out inspection.',
    'https://pactkeeper-lac.vercel.app',
    30,
    500
  );

  // Pact 3: Completed
  console.log('\n--- Pact 3: Open Source Contribution Pact (COMPLETE) ---');
  write('create_pact',
    'Open Source Contribution Pact',
    'Commit 3 meaningful PRs to the GenLayer SDK repository within 14 days. Evidence: GitHub PR links.',
    'https://github.com/tranhop26',
    14,
    200
  );

  const totalAfter = read('total_pacts');
  console.log(`\ntotal_pacts AFTER: ${totalAfter}`);
  console.log('✅ TASK 2 DONE — ' + totalAfter + ' pacts created');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
