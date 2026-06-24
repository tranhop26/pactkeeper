# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

import json

# ============================================================================
# PACTKEEPER — Self-staked commitments, verified on-chain by AI
# ----------------------------------------------------------------------------
# A user stakes their own money on a personal promise ("publish 10 blog posts in
# 30 days", "run 100km"), names a beneficiary that receives the stake on FAILURE
# (e.g. a charity or a friend), and a deadline. The user submits an evidence URL;
# the Intelligent Contract READS that page from the live web and an LLM judges
# whether the promise was genuinely fulfilled. Success -> stake returns to the
# user. Failure / no valid proof by the deadline -> stake goes to the beneficiary.
#
# WHY THIS CANNOT BE A SOLIDITY CONTRACT:
#   Solidity cannot open a blog, a Strava page, or a profile, read it, and judge
#   "did this person actually keep their promise?". PactKeeper's settlement
#   decision is exactly that subjective judgment, executed on-chain via
#   web.render + exec_prompt under validator consensus.
# ============================================================================

# Pact status (small ints to stay storage-safe).
P_ACTIVE = u8(0)       # staked, awaiting evidence/settlement
P_SUBMITTED = u8(1)    # evidence submitted, awaiting AI review
P_KEPT = u8(2)         # AI confirmed -> stake returned to owner
P_BROKEN = u8(3)       # failed / expired -> stake sent to beneficiary


class Contract(gl.Contract):
    # ----- storage (parallel TreeMaps keyed by pact_id) ---------------------
    # Parallel maps instead of a nested storage struct (struct decorator syntax
    # for v0.2.16 is unverified here).
    # TODO: verify struct syntax; if available, collapse into one struct.
    pact_count: u256

    owner: TreeMap[u256, Address]
    beneficiary: TreeMap[u256, Address]
    promise_text: TreeMap[u256, str]
    success_criteria: TreeMap[u256, str]

    stake_amount: TreeMap[u256, u256]
    deadline_ts: TreeMap[u256, u256]      # unix seconds; 0 = no deadline
    status: TreeMap[u256, u8]

    evidence_url: TreeMap[u256, str]
    reason: TreeMap[u256, str]            # AI explanation of last decision
    confidence: TreeMap[u256, u256]

    # ----- pull-withdrawal ledger -------------------------------------------
    withdrawable: TreeMap[Address, u256]

    def __init__(self):
        # Only scalars assigned here. TreeMaps auto-init to empty.
        self.pact_count = u256(0)

    # ======================================================================
    # CREATE PACT  (owner stakes their own money on a promise)
    # ======================================================================
    @gl.public.write
    def create_pact(
        self,
        promise: str,
        criteria: str,
        beneficiary_addr: Address,
        deadline_unix: u256,
        stake: u256,
    ) -> u256:
        if len(promise) == 0:
            raise Exception("Promise text required")
        if len(criteria) == 0:
            raise Exception("Success criteria required")

        owner_addr = gl.message.sender_address
        if beneficiary_addr == owner_addr:
            raise Exception("Beneficiary must differ from the owner")

        pact_id = self.pact_count
        self.pact_count = self.pact_count + u256(1)

        self.owner[pact_id] = owner_addr
        self.beneficiary[pact_id] = beneficiary_addr
        self.promise_text[pact_id] = promise
        self.success_criteria[pact_id] = criteria
        self.stake_amount[pact_id] = stake
        self.deadline_ts[pact_id] = deadline_unix
        self.status[pact_id] = P_ACTIVE

        return pact_id

    # ======================================================================
    # SUBMIT EVIDENCE  (owner attaches proof of fulfilment)
    # ======================================================================
    @gl.public.write
    def submit_evidence(self, pact_id: u256, url: str) -> None:
        self._require_pact(pact_id)
        if gl.message.sender_address != self.owner[pact_id]:
            raise Exception("Only the pact owner can submit evidence")
        st = self.status[pact_id]
        if st == P_KEPT or st == P_BROKEN:
            raise Exception("Pact is already settled")
        if len(url) == 0:
            raise Exception("Evidence URL required")

        self.evidence_url[pact_id] = url
        self.status[pact_id] = P_SUBMITTED

    # ======================================================================
    # SETTLE  (runs the non-deterministic AI judgment, then pays out)
    # ======================================================================
    @gl.public.write
    def settle(self, pact_id: u256) -> None:
        self._require_pact(pact_id)
        st = self.status[pact_id]
        if st == P_KEPT or st == P_BROKEN:
            raise Exception("Pact is already settled")
        if st != P_SUBMITTED:
            raise Exception("No evidence submitted yet")

        promise = self.promise_text[pact_id]
        criteria = self.success_criteria[pact_id]
        url = self.evidence_url[pact_id]

        # ---- the core non-deterministic judgment ----
        raw = self._judge_pact(promise, criteria, url)

        kept = False
        why = "Could not parse a valid decision."
        conf = u256(0)
        try:
            parsed = json.loads(raw)
            verdict = str(parsed.get("verdict", "BROKEN")).upper()
            kept = (verdict == "KEPT")
            why = str(parsed.get("reason", ""))
            conf_int = int(parsed.get("confidence", 0))
            if conf_int < 0:
                conf_int = 0
            if conf_int > 100:
                conf_int = 100
            conf = u256(conf_int)
        except Exception:
            # On any parse failure, do NOT pay the owner. The promise is unproven.
            kept = False
            why = "Malformed decision JSON; treated as not proven."
            conf = u256(0)

        self.reason[pact_id] = why
        self.confidence[pact_id] = conf

        stake = self.stake_amount[pact_id]
        if kept:
            self._credit(self.owner[pact_id], stake)
            self.status[pact_id] = P_KEPT
        else:
            self._credit(self.beneficiary[pact_id], stake)
            self.status[pact_id] = P_BROKEN

    # ======================================================================
    # CLAIM EXPIRED  (deadline passed with no successful settlement)
    # ----------------------------------------------------------------------
    # Anyone may call this after the deadline; the stake goes to the beneficiary.
    # This prevents an owner from simply never submitting to lock funds forever.
    # ======================================================================
    @gl.public.write
    def claim_expired(self, pact_id: u256) -> None:
        self._require_pact(pact_id)
        st = self.status[pact_id]
        if st == P_KEPT or st == P_BROKEN:
            raise Exception("Pact is already settled")

        deadline = self.deadline_ts[pact_id]
        if deadline == u256(0):
            raise Exception("Pact has no deadline; cannot be claimed as expired")

        now = self._now()
        if now < deadline:
            raise Exception("Deadline has not passed yet")

        self.reason[pact_id] = "Deadline passed without a kept verdict."
        self.confidence[pact_id] = u256(0)
        self._credit(self.beneficiary[pact_id], self.stake_amount[pact_id])
        self.status[pact_id] = P_BROKEN

    # ======================================================================
    # WITHDRAW  (pull pattern)
    # ======================================================================
    @gl.public.write
    def withdraw(self) -> None:
        who = gl.message.sender_address
        amount = u256(0)
        if who in self.withdrawable:
            amount = self.withdrawable[who]
        if amount == u256(0):
            raise Exception("Nothing to withdraw")
        self.withdrawable[who] = u256(0)
        # TODO: verify the native transfer primitive name on GenLayer.
        gl.message.send_value(who, amount)

    # ======================================================================
    # VIEWS
    # ======================================================================
    @gl.public.view
    def get_pact(self, pact_id: u256) -> str:
        if pact_id not in self.status:
            return "{}"
        out = {
            "id": int(pact_id),
            "owner": self._addr(self.owner, pact_id),
            "beneficiary": self._addr(self.beneficiary, pact_id),
            "promise": self._str(self.promise_text, pact_id),
            "criteria": self._str(self.success_criteria, pact_id),
            "stake": self._int(self.stake_amount, pact_id),
            "deadline": self._int(self.deadline_ts, pact_id),
            "status": int(self.status[pact_id]),
            "evidence_url": self._str(self.evidence_url, pact_id),
            "reason": self._str(self.reason, pact_id),
            "confidence": self._int(self.confidence, pact_id),
        }
        return json.dumps(out)

    @gl.public.view
    def get_withdrawable(self, who: Address) -> u256:
        if who in self.withdrawable:
            return self.withdrawable[who]
        return u256(0)

    @gl.public.view
    def total_pacts(self) -> u256:
        return self.pact_count

    # ======================================================================
    # INTERNAL — non-deterministic judgment
    # ======================================================================
    def _judge_pact(self, promise: str, criteria: str, url: str) -> str:
        def run() -> str:
            # Read the evidence page live from the web, on-chain.
            evidence = gl.nondet.web.render(url, mode="text")

            task = f"""You are an impartial verifier deciding whether a person kept a
personal commitment they staked money on.

THE PROMISE:
{promise}

SUCCESS CRITERIA (what counts as kept):
{criteria}

EVIDENCE PAGE CONTENT submitted by the person:
---
{evidence}
---

Judge whether the evidence genuinely proves the promise was kept according to the
success criteria. Be skeptical of:
- empty / unreachable pages, or pages unrelated to the promise
- vague claims with no verifiable proof
- fabricated or clearly insufficient evidence

If the evidence is missing, unreachable, or does not clearly prove fulfilment,
you MUST return "BROKEN".

Respond with ONLY a JSON object, no surrounding prose:
{{"verdict": "KEPT" | "BROKEN",
  "confidence": <integer 0-100>,
  "reason": "<one or two sentence explanation>"}}"""
            return gl.nondet.exec_prompt(task, response_format="json")

        # Consensus on the MEANING of the decision (KEPT vs BROKEN must match,
        # confidence within 15 points) — not on exact JSON bytes. This is what
        # makes the settlement trustworthy rather than a schema coincidence.
        # TODO: verify that gl.eq_principle.prompt_comparative exists in v0.2.16.
        #       If not, fall back to gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        #       with a validator_fn that parses both and checks the verdict equal.
        return gl.eq_principle.prompt_comparative(
            run,
            principle=(
                "The 'verdict' field must be identical across validators and the "
                "'confidence' values must be within 15 points of each other."
            ),
        )

    # ======================================================================
    # INTERNAL — helpers
    # ======================================================================
    def _now(self) -> u256:
        # TODO: verify the correct way to read block/consensus time on GenLayer.
        #       Likely something like gl.message.block_timestamp or a gl.vm time.
        #       If unavailable, expiry must be driven by an off-chain caller
        #       passing a verified time, or by reading a time source via web.render.
        return u256(gl.message.block_timestamp)

    def _credit(self, who: Address, amount: u256) -> None:
        current = u256(0)
        if who in self.withdrawable:
            current = self.withdrawable[who]
        self.withdrawable[who] = current + amount

    def _require_pact(self, pact_id: u256) -> None:
        if pact_id not in self.status:
            raise Exception("Pact does not exist")

    # ---- safe-read helpers ----
    def _str(self, m: TreeMap[u256, str], k: u256) -> str:
        if k in m:
            return m[k]
        return ""

    def _int(self, m: TreeMap[u256, u256], k: u256) -> int:
        if k in m:
            return int(m[k])
        return 0

    def _addr(self, m: TreeMap[u256, Address], k: u256) -> str:
        if k in m:
            a = m[k]
            return a.as_hex if hasattr(a, "as_hex") else str(a)
        return ""
