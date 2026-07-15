import pytest
import json

@pytest.fixture
def pactkeeper_contract(genlayer_test):
    return genlayer_test.deploy("contracts/pactkeeper.py")

def test_full_successful_flow(pactkeeper_contract, genlayer_test):
    owner = genlayer_test.accounts[0]
    beneficiary = genlayer_test.accounts[1]
    
    # 1. Create pact (staking 1 GEN)
    stake_amount = 1 * 10**18  # 1 GEN
    deadline = genlayer_test.get_timestamp() + 3600 * 24 * 30  # 30 days
    
    result = pactkeeper_contract.functions.create_pact(
        "I will publish 10 blog posts within 30 days.",
        "My blog shows >=10 posts published after today.",
        beneficiary,
        deadline,
        sender=owner,
        value=stake_amount
    )
    
    pact_id = result.return_value
    assert pact_id == 0, "pact_id should be 0"
    
    # Verify pact details
    pact_details_str = pactkeeper_contract.functions.get_pact(pact_id).return_value
    pact_details = json.loads(pact_details_str)
    assert pact_details["owner"].lower() == owner.as_hex.lower()
    assert pact_details["beneficiary"].lower() == beneficiary.as_hex.lower()
    assert pact_details["stake"] == stake_amount
    assert pact_details["status"] == 0  # ACTIVE
    
    # 2. Submit evidence
    evidence_url = "https://raw.githubusercontent.com/tranhop26/pactkeeper/main/README.md"
    pactkeeper_contract.functions.submit_evidence(
        pact_id,
        evidence_url,
        sender=owner
    )
    
    pact_details_str = pactkeeper_contract.functions.get_pact(pact_id).return_value
    pact_details = json.loads(pact_details_str)
    assert pact_details["status"] == 1  # SUBMITTED
    assert pact_details["evidence_url"] == evidence_url
    
    # 3. Settle (AI consensus mock)
    # Mock web page render
    genlayer_test.mock_web_render(evidence_url, "Blog posts: 10 published posts after today's date.")
    # Mock LLM verdict KEPT
    mock_ai_response = json.dumps({
        "verdict": "KEPT",
        "confidence": 95,
        "reason": "The user has successfully published 10 blog posts as verified on the page."
    })
    genlayer_test.mock_exec_prompt(mock_ai_response)
    
    pactkeeper_contract.functions.settle(pact_id)
    
    pact_details_str = pactkeeper_contract.functions.get_pact(pact_id).return_value
    pact_details = json.loads(pact_details_str)
    assert pact_details["status"] == 2  # KEPT
    assert pact_details["reason"] == "The user has successfully published 10 blog posts as verified on the page."
    assert pact_details["confidence"] == 95
    
    # Verify withdrawable balance
    withdrawable_owner = pactkeeper_contract.functions.get_withdrawable(owner).return_value
    assert withdrawable_owner == stake_amount
    
    # 4. Withdraw
    owner_bal_before = genlayer_test.get_balance(owner)
    pactkeeper_contract.functions.withdraw(sender=owner)
    
    # Remaining withdrawable state should be updated to 0
    withdrawable_owner_after = pactkeeper_contract.functions.get_withdrawable(owner).return_value
    assert withdrawable_owner_after == 0
    
    owner_bal_after = genlayer_test.get_balance(owner)
    assert owner_bal_after == owner_bal_before + stake_amount

def test_broken_flow_and_claim_expired(pactkeeper_contract, genlayer_test):
    owner = genlayer_test.accounts[0]
    beneficiary = genlayer_test.accounts[1]
    
    # 1. Create pact (staking 1 GEN)
    stake_amount = 1 * 10**18
    deadline = genlayer_test.get_timestamp() + 3600 * 24 * 30  # 30 days
    
    result = pactkeeper_contract.functions.create_pact(
        "I will publish 10 blog posts within 30 days.",
        "My blog shows >=10 posts published after today.",
        beneficiary,
        deadline,
        sender=owner,
        value=stake_amount
    )
    pact_id = result.return_value
    
    # 2. Advance time past deadline
    genlayer_test.advance_time(hours=24 * 31)  # 31 days later
    
    # 3. Claim expired by beneficiary or anyone
    pactkeeper_contract.functions.claim_expired(pact_id, sender=beneficiary)
    
    # Verify status is BROKEN
    pact_details_str = pactkeeper_contract.functions.get_pact(pact_id).return_value
    pact_details = json.loads(pact_details_str)
    assert pact_details["status"] == 3  # BROKEN
    
    # Verify beneficiary has withdrawable balance
    withdrawable_beneficiary = pactkeeper_contract.functions.get_withdrawable(beneficiary).return_value
    assert withdrawable_beneficiary == stake_amount
    
    # 4. Withdraw
    beneficiary_bal_before = genlayer_test.get_balance(beneficiary)
    pactkeeper_contract.functions.withdraw(sender=beneficiary)
    
    withdrawable_beneficiary_after = pactkeeper_contract.functions.get_withdrawable(beneficiary).return_value
    assert withdrawable_beneficiary_after == 0
    
    beneficiary_bal_after = genlayer_test.get_balance(beneficiary)
    assert beneficiary_bal_after == beneficiary_bal_before + stake_amount
