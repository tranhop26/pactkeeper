import pytest

@pytest.fixture
def scratch_contract(genlayer_test):
    return genlayer_test.deploy("contracts/scratch_helper.py")

def test_message_attributes(scratch_contract):
    r = scratch_contract.functions.get_message_attr().return_value
    print("\n[TEST] get_message_attr:", r)

def test_now_check(scratch_contract):
    r = scratch_contract.functions.get_now_check().return_value
    print("\n[TEST] get_now_check:", r)

def test_time(scratch_contract):
    r = scratch_contract.functions.get_time().return_value
    print("\n[TEST] get_time:", r)

def test_more_checks(scratch_contract):
    r = scratch_contract.functions.get_more_checks().return_value
    print("\n[TEST] get_more_checks:", r)
