from starlette.requests import Request

from app.auth import create_access_token
from app.limiter import rate_limit_key


def _fake_request(headers: dict) -> Request:
    encoded_headers = [(k.lower().encode(), v.encode()) for k, v in headers.items()]
    scope = {
        "type": "http",
        "headers": encoded_headers,
        "client": ("203.0.113.5", 12345),
    }
    return Request(scope)


def test_rate_limit_key_differs_for_different_users_on_same_ip():
    token_a = create_access_token("doctor-a", "doctor")
    token_b = create_access_token("doctor-b", "doctor")

    key_a = rate_limit_key(_fake_request({"authorization": f"Bearer {token_a}"}))
    key_b = rate_limit_key(_fake_request({"authorization": f"Bearer {token_b}"}))

    assert key_a != key_b
    assert key_a == "user:doctor-a"
    assert key_b == "user:doctor-b"


def test_rate_limit_key_same_user_gets_same_key_regardless_of_ip():
    token = create_access_token("doctor-a", "doctor")

    key_1 = rate_limit_key(_fake_request({"authorization": f"Bearer {token}"}))
    key_2 = rate_limit_key(_fake_request({"authorization": f"Bearer {token}"}))

    assert key_1 == key_2 == "user:doctor-a"


def test_rate_limit_key_falls_back_to_ip_without_valid_token():
    no_token = rate_limit_key(_fake_request({}))
    bad_token = rate_limit_key(_fake_request({"authorization": "Bearer not-a-real-token"}))

    assert no_token == "203.0.113.5"
    assert bad_token == "203.0.113.5"
