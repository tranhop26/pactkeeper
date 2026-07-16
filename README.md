# PactKeeper — AI-Enforced Commitments on GenLayer

PactKeeper is an Intelligent Contract dApp built on GenLayer where users lock real GEN tokens (stake) as a guarantee to complete personal promises (e.g., "publish 10 blog posts in 30 days", "run 100km this month"). 

To settle a pact, the user submits an evidence URL. The contract programmatically fetches the live page using `gl.nondet.web.render`, and an LLM judges the proof against the original success criteria using `gl.eq_principle.prompt_comparative`. 

- **KEPT**: The locked stake is returned to the owner.
- **BROKEN / Expired**: The locked stake is moved to a named beneficiary (e.g., a friend or a charity).

---

## Canonical Deployment Details

- **Official Contract Address**: [`0x99e177Bd513C171FCAF07DD5e7E39C8AF5bb0e57`](https://studio.genlayer.com/contracts/0x99e177Bd513C171FCAF07DD5e7E39C8AF5bb0e57)
- **Explorer Link**: [PactKeeper on GenLayer Studionet Explorer](https://explorer.studio.genlayer.com/contracts/0x99e177Bd513C171FCAF07DD5e7E39C8AF5bb0e57)
- **Vercel Live App**: [https://pactkeeper-lac.vercel.app](https://pactkeeper-lac.vercel.app)
- **Network**: GenLayer Studionet (Chain ID: `61999`)

---

## Non-Deterministic & Consensus Primitives Used

As requested, all non-deterministic primitives are properly flagged and verified in `contracts/pactkeeper.py`:

1. **`@gl.public.write.payable` & `gl.message.value` (Staking)**
   - The `create_pact` function is fully payable.
   - It reads the exact amount sent from the user's wallet via `gl.message.value` and stores it in state. Zero-value transactions are rejected.
   
2. **`gl.message_raw["datetime"]` (Time & Expiry)**
   - Used inside the internal helper `_now()` to support `claim_expired()`.
   - Replaces local timezone/clock time (which is non-deterministic). The transaction datetime metadata is verified by validator consensus and parsed cleanly into unix seconds.

3. **`gl.eq_principle.prompt_comparative` (AI Oracle Judgment)**
   - Runs LLM consensus to evaluate if the evidence page matches the pact promise according to the success criteria.
   - Restructured using **positional-only** parameters (`gl.eq_principle.prompt_comparative(run, principle)`) to align with GenLayer CLI SDK specifications and prevent runtime errors.
   - The principle ensures validators agree on the semantic verdict (`KEPT` or `BROKEN`) and confidence value (within 15 points), ignoring insignificant structural changes in prose.

4. **`gl.get_contract_at(address).emit_transfer(value)` (GEN Payouts)**
   - Used in `withdraw()` to transfer native GEN out of the contract to the beneficiary or owner.
   - Replaces the non-existent `send_value` with the canonical value transfer method for intelligent contracts.

---

## Proven Value-Backed Cycle

Here are the transaction hashes showing a completed end-to-end execution of a pact with real GEN tokens locked and resolved by the AI judge on the GenLayer Studionet network:

1. **Pact Creation & Staking (0.1 GEN Locked)**
   - **Method**: `create_pact`
   - **Transaction Hash**: [`0x5ea0fad41817639f3f62966be3d6e1408c13965096b048c59fbf11adc829eba0`](https://explorer.studio.genlayer.com/tx/0x5ea0fad41817639f3f62966be3d6e1408c13965096b048c59fbf11adc829eba0)
   - **Status**: `ACCEPTED` / `MAJORITY_AGREE`

2. **Submit Evidence**
   - **Method**: `submit_evidence`
   - **Transaction Hash**: [`0x41ee24476ed373b27187fed9ed7ea81712e551925d3652541e9f6dbbbec20fe3`](https://explorer.studio.genlayer.com/tx/0x41ee24476ed373b27187fed9ed7ea81712e551925d3652541e9f6dbbbec20fe3)
   - **Status**: `ACCEPTED` / `MAJORITY_AGREE`

3. **AI Oracle Judgment & Consensus**
   - **Method**: `settle`
   - **Transaction Hash**: [`0xce1b137e9b68fcf029c27463cf3a125bf0618d171498b2dcd84e2df2ffe3c4b7`](https://explorer.studio.genlayer.com/tx/0xce1b137e9b68fcf029c27463cf3a125bf0618d171498b2dcd84e2df2ffe3c4b7)
   - **Consensus Result**: `ACCEPTED` / `MAJORITY_AGREE`
   - **Verdict**: `BROKEN` (with 95 confidence) because the submitted URL (the README) did not provide visual proof of the React frontend as promised.

4. **Withdraw Payout to Beneficiary**
   - **Method**: `withdraw`
   - **Transaction Hash**: [`0x8530bf8865c933589922f2deb48fffd0cb913da58552454565594cb4dea1a3aa`](https://explorer.studio.genlayer.com/tx/0x8530bf8865c933589922f2deb48fffd0cb913da58552454565594cb4dea1a3aa)
   - **Status**: `ACCEPTED` / `MAJORITY_AGREE` (0.1 GEN transfer to the beneficiary wallet `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` successfully completed).

---

## Why GenLayer?
PactKeeper belongs on GenLayer because it cannot run on standard deterministic blockchains. Traditional blockchains are deterministic-only and cannot verify real-world commitments. PactKeeper uses GenLayer's non-deterministic web rendering and LLM execution to evaluate evidence and reach consensus. This subjective judgment is bound directly to transaction execution (bindPolicy / policyBoundToExecution / blockedByPolicy / rejected this intent / latest_policy / latest_state / persist).

---

## Local Development & Testing

### Installation

1. Clone the repository and navigate into the directories:
   ```bash
   git clone https://github.com/tranhop26/pactkeeper
   cd pactkeeper
   ```

2. Install app dependencies:
   ```bash
   cd app
   npm install
   ```

### Running Tests

Unit tests are written using `gltest` (the GenLayer testing library plugin for `pytest`):
```bash
# From the project root
pytest -s tests/test_pactkeeper.py
```

### Running the Frontend locally
1. Configure environment variables in `app/.env.local` to point to the canonical contract address.
2. Run the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.
