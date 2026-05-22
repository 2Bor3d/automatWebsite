import base64
import hashlib
import hmac
import json
import os
import secrets
import time

import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

_KEY_ID = os.environ['HMAC_KEY_ID']
_SECRET = os.environ['HMAC_SECRET']


def _dumps(obj) -> str:
    return json.dumps(obj, separators=(',', ':'))


def _sign(body: str = "") -> dict:
    timestamp = str(int(time.time()))
    nonce = secrets.token_hex(16)
    data = f"{_KEY_ID}:{timestamp}:{nonce}:{body}"
    signature = hmac.new(
        _SECRET.encode('utf-8'),
        data.encode('utf-8'),
        hashlib.sha256,
    ).digest()
    return {
        "X-API-KEY-ID": _KEY_ID,
        "X-TIMESTAMP": timestamp,
        "X-NONCE": nonce,
        "X-SIGNATURE": base64.b64encode(signature).decode('utf-8'),
        "Content-Type": "application/json",
    }


def get(url: str, **kwargs) -> requests.Response:
    return requests.get(url, headers=_sign(), **kwargs)


def delete(url: str, json_body=None, **kwargs) -> requests.Response:
    body_str = _dumps(json_body) if json_body is not None else ""
    return requests.delete(url, headers=_sign(body_str), data=body_str or None, **kwargs)


def post(url: str, json_body=None, data=None, **kwargs) -> requests.Response:
    if json_body is not None:
        body_str = _dumps(json_body)
        return requests.post(url, headers=_sign(body_str), data=body_str, **kwargs)
    body_str = data if isinstance(data, str) else (data.decode() if data else "")
    return requests.post(url, headers=_sign(body_str), data=data, **kwargs)
