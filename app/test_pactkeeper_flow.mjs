import { createClient, createAccount, chains } from 'genlayer-js';

const CONTRACT = '0xC978Bbc3B7f16dd0bF629005F60FeD5E49a83cC1';
const CREATOR_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // test key 1
const BENEFICIARY_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // test key 2

const creatorAcc = createAccount(CREATOR_KEY);
const beneficiaryAcc = createAccount(BENEFICIARY_KEY);

const creatorClient = createClient({ chain: chains.studionet, account: creatorAcc });
const beneficiaryClient = createClient({ chain: chains.studionet, account: beneficiaryAcc });

async function simFund(addr, amountWei) {
  const url = 'https://studio.genlayer.com/api';
  const payloadStr = `{"jsonrpc":"2.0","method":"sim_fundAccount","params":["${addr}", ${amountWei}],"id":1}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payloadStr,
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function waitTx(client, hash) {
  console.log(`Waiting for transaction: ${hash}...`);
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
  console.log(`Creator  : ${creatorAcc.address}`);
  console.log(`Beneficiary: ${beneficiaryAcc.address}`);

  // Step 1: Fund accounts
  console.log('\n--- Step 1: Funding creator and beneficiary accounts ---');
  const fundAmount = 10n * 10n**18n; // 10 GEN
  await simFund(creatorAcc.address, fundAmount.toString());
  await simFund(beneficiaryAcc.address, fundAmount.toString());
  
  const creatorBal = await creatorClient.getBalance({ address: creatorAcc.address });
  const beneficiaryBal = await beneficiaryClient.getBalance({ address: beneficiaryAcc.address });
  console.log(`Creator balance: ${Number(creatorBal) / 1e18} GEN`);
  console.log(`Beneficiary balance: ${Number(beneficiaryBal) / 1e18} GEN`);

  // Step 2: Create a Pact with real locked GLT (0.1 GEN)
  console.log('\n--- Step 2: create_pact (Staking 0.1 GEN) ---');
  const promiseText = 'I will build a React frontend with a clean UI.';
  const criteriaText = 'The webpage has a navbar, modal, and lists pacts.';
  const stake = 100000000000000000n; // 0.1 GEN
  const deadline = 0n; // no deadline

  const createTx = await creatorClient.writeContract({
    address: CONTRACT,
    functionName: 'create_pact',
    args: [promiseText, criteriaText, beneficiaryAcc.address, deadline],
    value: stake,
  });
  console.log(`create_pact Tx Hash: ${createTx}`);
  await waitTx(creatorClient, createTx);

  // Read total pacts to verify pact ID
  const totalRaw = await creatorClient.readContract({
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
  const submitTx = await creatorClient.writeContract({
    address: CONTRACT,
    functionName: 'submit_evidence',
    args: [pactId, evidenceUrl],
  });
  console.log(`submit_evidence Tx Hash: ${submitTx}`);
  await waitTx(creatorClient, submitTx);

  // Step 4: Settle (triggers AI validation and validator consensus)
  console.log('\n--- Step 4: settle (AI Judgment) ---');
  console.log('Triggering AI consensus, this may take 15-30 seconds...');
  const settleTx = await creatorClient.writeContract({
    address: CONTRACT,
    functionName: 'settle',
    args: [pactId],
    consensusMaxRotations: 5,
  });
  console.log(`settle Tx Hash: ${settleTx}`);
  await waitTx(creatorClient, settleTx);

  // Step 5: Read Pact state after settlement
  console.log('\n--- Step 5: get_pact details after settlement ---');
  const pactDetailsStr = await creatorClient.readContract({
    address: CONTRACT,
    functionName: 'get_pact',
    args: [pactId],
  });
  const pactDetails = JSON.parse(pactDetailsStr);
  console.log('Pact Details:', JSON.stringify(pactDetails, null, 2));

  // Step 6: Check withdrawable balance and withdraw
  const targetWithdrawAddr = pactDetails.status === 2 ? creatorAcc.address : beneficiaryAcc.address;
  const withdrawClient = pactDetails.status === 2 ? creatorClient : beneficiaryClient;
  const withdrawAcc = pactDetails.status === 2 ? creatorAcc : beneficiaryAcc;

  console.log(`\n--- Step 6: get_withdrawable and withdraw to ${targetWithdrawAddr} ---`);
  const withdrawableRaw = await creatorClient.readContract({
    address: CONTRACT,
    functionName: 'get_withdrawable',
    args: [targetWithdrawAddr],
  });
  const withdrawable = BigInt(withdrawableRaw);
  console.log(`Withdrawable balance: ${withdrawable.toString()} wei (${Number(withdrawable) / 1e18} GEN)`);

  if (withdrawable > 0n) {
    console.log(`Withdrawing from ${withdrawAcc.address}...`);
    try {
      const withdrawTx = await withdrawClient.writeContract({
        address: CONTRACT,
        functionName: 'withdraw',
        args: [],
      });
      console.log(`withdraw Tx Hash: ${withdrawTx}`);
      await waitTx(withdrawClient, withdrawTx);
      
      const balAfter = await withdrawClient.getBalance({ address: targetWithdrawAddr });
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
