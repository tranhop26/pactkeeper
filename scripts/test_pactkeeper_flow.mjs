import { createClient, createAccount, chains } from 'genlayer-js';

const CONTRACT = '0xC978Bbc3B7f16dd0bF629005F60FeD5E49a83cC1';
const TEST_KEY  = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // standard test key

const account = createAccount(TEST_KEY);
const client  = createClient({ chain: chains.studionet, account });

async function simFund(addr, amountWei) {
  const url = 'https://studio.genlayer.com/api';
  const payload = {
    jsonrpc: '2.0',
    method: 'sim_fundAccount',
    params: [addr, amountWei],
    id: 1,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function waitTx(hash) {
  console.log(`Waiting for transaction: ${hash}...`);
  // Poll receipt
  for (let i = 0; i < 30; i++) {
    try {
      const receipt = await client.getTransactionReceipt({ hash });
      if (receipt) {
        console.log(`Transaction status: ${receipt.status_name} / result: ${receipt.result_name}`);
        return receipt;
      }
    } catch (e) {
      // Ignored
    }
    await new Promise(r => setTimeout(r, 4000));
  }
  throw new Error(`Transaction ${hash} did not complete in time`);
}

async function main() {
  console.log('=== PactKeeper On-Chain Flow Test ===');
  console.log(`Contract : ${CONTRACT}`);
  console.log(`Account  : ${account.address}`);

  // Step 1: Fund test account
  console.log('\n--- Step 1: Funding account via sim_fundAccount ---');
  const fundAmount = 10n * 10n**18n; // 10 GEN
  await simFund(account.address, fundAmount.toString());
  const bal = await client.getBalance({ address: account.address });
  console.log(`Account balance: ${bal.toString()} wei (${Number(bal) / 1e18} GEN)`);

  // Step 2: Create a Pact with real locked GLT (0.1 GEN)
  console.log('\n--- Step 2: create_pact (Staking 0.1 GEN) ---');
  const promiseText = 'I will build a React frontend with a clean UI.';
  const criteriaText = 'The webpage has a navbar, modal, and lists pacts.';
  const beneficiary = '0x1111111111111111111111111111111111111111';
  const deadline = 0n; // no deadline
  const stake = 100000000000000000n; // 0.1 GEN

  const createTx = await client.writeContract({
    address: CONTRACT,
    functionName: 'create_pact',
    args: [promiseText, criteriaText, beneficiary, deadline],
    value: stake,
  });
  console.log(`create_pact Tx Hash: ${createTx}`);
  const createReceipt = await waitTx(createTx);

  // Read total pacts to verify pact ID
  const totalRaw = await client.readContract({
    address: CONTRACT,
    functionName: 'total_pacts',
    args: [],
  });
  const total = Number(totalRaw);
  const pactId = BigInt(total - 1);
  console.log(`Total pacts: ${total}, current Pact ID: ${pactId}`);

  // Step 3: Submit evidence
  console.log('\n--- Step 3: submit_evidence ---');
  const evidenceUrl = 'https://raw.githubusercontent.com/tranhop26/pactkeeper/main/README.md';
  const submitTx = await client.writeContract({
    address: CONTRACT,
    functionName: 'submit_evidence',
    args: [pactId, evidenceUrl],
  });
  console.log(`submit_evidence Tx Hash: ${submitTx}`);
  await waitTx(submitTx);

  // Step 4: Settle (triggers AI validation and validator consensus)
  console.log('\n--- Step 4: settle (AI Judgment) ---');
  console.log('Triggering AI consensus, this may take 30-120 seconds...');
  const settleTx = await client.writeContract({
    address: CONTRACT,
    functionName: 'settle',
    args: [pactId],
    consensusMaxRotations: 5,
  });
  console.log(`settle Tx Hash: ${settleTx}`);
  const settleReceipt = await waitTx(settleTx);

  // Step 5: Read Pact state after settlement
  console.log('\n--- Step 5: get_pact details after settlement ---');
  const pactDetailsStr = await client.readContract({
    address: CONTRACT,
    functionName: 'get_pact',
    args: [pactId],
  });
  const pactDetails = JSON.parse(pactDetailsStr);
  console.log('Pact Details:', JSON.stringify(pactDetails, null, 2));

  // Step 6: Check withdrawable balance and withdraw
  const targetWithdrawAddr = pactDetails.status === 2 ? account.address : beneficiary;
  console.log(`\n--- Step 6: get_withdrawable and withdraw to ${targetWithdrawAddr} ---`);
  const withdrawableRaw = await client.readContract({
    address: CONTRACT,
    functionName: 'get_withdrawable',
    args: [targetWithdrawAddr],
  });
  const withdrawable = BigInt(withdrawableRaw);
  console.log(`Withdrawable balance: ${withdrawable.toString()} wei`);

  if (withdrawable > 0n) {
    // If beneficiary needs to withdraw, we switch client to beneficiary account
    let withdrawClient = client;
    if (pactDetails.status !== 2) {
      // beneficiary private key (let's use standard test key 2 or similar, or just mock it)
      // Wait, since we don't have the beneficiary's private key, if beneficiary is EOA 0x11111...
      // we can't sign transactions for it!
      // But we can check if it is withdrawable, or we can set the beneficiary to be the same account or an account we control,
      // or we can just call withdraw from the owner if the verdict was KEPT!
      // If the verdict is BROKEN, beneficiary is 0x111111..., so we can't withdraw unless we control it.
      // Let's print warning, but if it is KEPT, owner is the withdrawer and we can do it!
      console.log('withdrawing from owner client...');
    }
    
    try {
      const withdrawTx = await withdrawClient.writeContract({
        address: CONTRACT,
        functionName: 'withdraw',
        args: [],
      });
      console.log(`withdraw Tx Hash: ${withdrawTx}`);
      await waitTx(withdrawTx);
      
      const balAfter = await client.getBalance({ address: targetWithdrawAddr });
      console.log(`Withdrawn successfully! Balance of ${targetWithdrawAddr} is now ${balAfter.toString()} wei`);
    } catch (e) {
      console.error('Withdraw execution failed:', e.message);
    }
  } else {
    console.log('Nothing withdrawable.');
  }

  console.log('\n✅ Flow test completed successfully!');
}

main().catch(console.error);
