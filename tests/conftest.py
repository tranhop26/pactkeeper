import pytest
import json
import datetime
import sys
from pathlib import Path

class ContractWrapper:
    def __init__(self, instance, direct_vm):
        self._instance = instance
        self._direct_vm = direct_vm

    @property
    def address(self):
        return str(self._instance.address)

    @property
    def functions(self):
        return self

    def __getattr__(self, name):
        attr = getattr(self._instance, name)
        if callable(attr):
            def _wrapped(*args, **kwargs):
                sender = kwargs.pop('sender', None)
                value = kwargs.pop('value', None)
                
                old_sender = self._direct_vm.sender
                old_value = self._direct_vm.value
                
                if sender is not None:
                    self._direct_vm.sender = sender
                if value is not None:
                    sender_bytes = self._direct_vm._to_bytes(self._direct_vm.sender)
                    self._direct_vm._balances[sender_bytes] = self._direct_vm._balances.get(sender_bytes, 0) + int(value)
                    self._direct_vm.value = int(value)
                
                # Robustly find and update gl.message in all contract modules' referenced genlayer.gl instances
                for mod_name, mod in list(sys.modules.items()):
                    if mod_name.startswith('_contract_') or mod_name.startswith('_deployed_'):
                        gl_proxy = mod.__dict__.get('gl')
                        if gl_proxy is not None:
                            cached_gl = getattr(gl_proxy, '_cached_gl', None)
                            if cached_gl is not None:
                                try:
                                    from genlayer.py.types import Address, u256
                                    addr_bytes = self._direct_vm._to_bytes(self._direct_vm.sender)
                                    sender_addr = Address(addr_bytes)
                                    origin_bytes = self._direct_vm._to_bytes(self._direct_vm.origin)
                                    origin_addr = Address(origin_bytes)
                                    
                                    if hasattr(cached_gl, 'message') and cached_gl.message is not None:
                                        cached_gl.message = cached_gl.MessageType(
                                            contract_address=cached_gl.message.contract_address,
                                            sender_address=sender_addr,
                                            origin_address=origin_addr,
                                            value=u256(self._direct_vm.value),
                                            chain_id=u256(self._direct_vm._chain_id),
                                        )
                                except Exception:
                                    pass
                
                try:
                    ret = attr(*args, **kwargs)
                    class ReturnWrapper:
                        def __init__(self, val):
                            self.return_value = val
                    return ReturnWrapper(ret)
                finally:
                    self._direct_vm.sender = old_sender
                    self._direct_vm.value = old_value
            return _wrapped
        return attr

class GenLayerTestWrapper:
    def __init__(self, direct_vm, direct_deploy, accounts):
        self._direct_vm = direct_vm
        self._direct_deploy = direct_deploy
        self._raw_accounts = accounts
        self._contract_registry = {}
        
        # Expose the default sender (owner)
        from gltest.direct.loader import create_address
        self.owner = create_address("default_sender")
        
        # Install the gl_call hook on VMContext
        self._direct_vm._gl_call_hook = self._gl_call_hook
        
        self._timestamp = 1767225600
        self._sync_time()

    @property
    def accounts(self):
        from genlayer.py.types import Address
        return [Address(self._direct_vm._to_bytes(acc)) for acc in self._raw_accounts]

    def _sync_time(self):
        dt = datetime.datetime.fromtimestamp(self._timestamp, tz=datetime.timezone.utc)
        iso_str = dt.isoformat().replace('+00:00', 'Z')
        self._direct_vm.warp(iso_str)

    def get_timestamp(self) -> int:
        return self._timestamp

    def advance_time(self, hours: int = 0, seconds: int = 0):
        self._timestamp += hours * 3600 + seconds
        self._sync_time()

    def deploy(self, contract_path, args=None):
        if args is None:
            args = []
        inst = self._direct_deploy(contract_path, *args)
        wrapper = ContractWrapper(inst, self._direct_vm)
        self._contract_registry[str(inst.address)] = wrapper
        return wrapper

    def mock_web_render(self, url: str, text: str):
        self._direct_vm.mock_web(url, {"status": 200, "body": text})

    def mock_web_render_error(self, url: str, exception: Exception):
        import re
        pattern = re.compile(url)
        self._direct_vm._web_mocks.append((pattern, {"error": str(exception)}))

    def mock_exec_prompt(self, result: str):
        self._direct_vm.mock_llm(".*", result)

    def clear_mocks(self):
        self._direct_vm.clear_mocks()

    def get_balance(self, account) -> int:
        addr_bytes = self._direct_vm._to_bytes(account)
        return self._direct_vm._balances.get(addr_bytes, 0)

    def _gl_call_hook(self, vm, request):
        if not isinstance(request, dict):
            return None
            
        op = None
        if "PostMessage" in request:
            op = "PostMessage"
        elif "CallContract" in request:
            op = "CallContract"
            
        if op:
            data = request[op]
            target_addr = str(data["address"])
            calldata_obj = data["calldata"]
            method_name = calldata_obj.get("method")
            args = calldata_obj.get("args", [])
            kwargs = calldata_obj.get("kwargs", {})
            value = int(data.get("value", 0))
            
            # Execute value transfer
            if value > 0:
                sender_bytes = vm._to_bytes(vm._contract_address)
                target_bytes = vm._to_bytes(target_addr)
                vm._balances[sender_bytes] = max(0, vm._balances.get(sender_bytes, 0) - value)
                vm._balances[target_bytes] = vm._balances.get(target_bytes, 0) + value
            
            target_wrapper = self._contract_registry.get(target_addr)
            if target_wrapper is not None:
                old_sender = vm.sender
                old_value = vm.value
                
                # Caller is the contract address making the call
                vm.sender = vm._contract_address
                vm.value = value
                
                # Update gl.message in all contract modules
                self._update_all_gl_messages(vm)
                
                try:
                    method = getattr(target_wrapper._instance, method_name)
                    res = method(*args, **kwargs)
                    return {"ok": res}
                finally:
                    vm.sender = old_sender
                    vm.value = old_value
                    self._update_all_gl_messages(vm)
            else:
                return {"ok": None}
        return None

    def _update_all_gl_messages(self, vm):
        for mod_name, mod in list(sys.modules.items()):
            if mod_name.startswith('_contract_') or mod_name.startswith('_deployed_'):
                gl_proxy = mod.__dict__.get('gl')
                if gl_proxy is not None:
                    cached_gl = getattr(gl_proxy, '_cached_gl', None)
                    if cached_gl is not None:
                        try:
                            from genlayer.py.types import Address, u256
                            sender_addr = Address(vm._to_bytes(vm.sender))
                            origin_addr = Address(vm._to_bytes(vm.origin))
                            if hasattr(cached_gl, 'message') and cached_gl.message is not None:
                                cached_gl.message = cached_gl.MessageType(
                                    contract_address=cached_gl.message.contract_address,
                                    sender_address=sender_addr,
                                    origin_address=origin_addr,
                                    value=u256(vm.value),
                                    chain_id=u256(vm._chain_id),
                                )
                            if hasattr(cached_gl, 'message_raw') and cached_gl.message_raw is not None:
                                cached_gl.message_raw['sender_address'] = sender_addr
                                cached_gl.message_raw['origin_address'] = origin_addr
                                cached_gl.message_raw['datetime'] = vm._datetime
                        except Exception:
                            pass

@pytest.fixture
def genlayer_test(direct_vm, direct_deploy, direct_accounts):
    return GenLayerTestWrapper(direct_vm, direct_deploy, direct_accounts)
