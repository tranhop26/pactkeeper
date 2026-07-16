# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json

class Contract(gl.Contract):
    def __init__(self):
        pass

    @gl.public.view
    def get_time(self) -> str:
        try:
            t = gl.tx.timestamp
            return f"gl.tx.timestamp: type={type(t)}, val={t}"
        except Exception as e:
            return f"Error gl.tx.timestamp: {e}"

    @gl.public.view
    def get_message_attr(self) -> str:
        try:
            attrs = dir(gl.message)
            return f"gl.message: {attrs}"
        except Exception as e:
            return f"Error gl.message: {e}"

    @gl.public.view
    def get_now_check(self) -> str:
        # Let's check how we can read block_timestamp
        try:
            t = gl.message.block_timestamp
            return f"gl.message.block_timestamp: type={type(t)}, val={t}"
        except Exception as e:
            return f"Error gl.message.block_timestamp: {e}"

    @gl.public.view
    def get_more_checks(self) -> str:
        res = {}
        try:
            res["trace_time_micro"] = gl.trace_time_micro()
        except Exception as e:
            res["trace_time_micro_err"] = str(e)
        try:
            import time
            res["time_import"] = "OK"
            res["time_val"] = time.time()
        except Exception as e:
            res["time_val_err"] = str(e)
        return json.dumps(res)
