import httpx
import pytest

from core.http import USER_AGENT, PoliteClient, SourceUnavailable


class FakeTime:
    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def clock(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


def make_client(handler, fake: FakeTime, rps: float = 0.5, **kwargs) -> PoliteClient:
    return PoliteClient(
        "test",
        rps,
        transport=httpx.MockTransport(handler),
        sleep=fake.sleep,
        clock=fake.clock,
        **kwargs,
    )


def test_sends_user_agent_with_contact():
    seen = {}

    def handler(request):
        seen["ua"] = request.headers["User-Agent"]
        return httpx.Response(200, json={})

    make_client(handler, FakeTime()).get("https://example.org/")
    assert seen["ua"] == USER_AGENT
    assert "@" in USER_AGENT


def test_requests_are_spaced_by_rate_limit():
    fake = FakeTime()
    client = make_client(lambda r: httpx.Response(200), fake, rps=0.5)
    for _ in range(3):
        client.get("https://example.org/")
    assert fake.sleeps == [2.0, 2.0]


def test_waits_retry_after_on_429():
    fake = FakeTime()
    responses = iter([httpx.Response(429, headers={"Retry-After": "7"}), httpx.Response(200)])
    client = make_client(lambda r: next(responses), fake, rps=1000)
    assert client.get("https://example.org/").status_code == 200
    assert 7.0 in fake.sleeps
    assert client.requests_made == 2


def test_custom_throttle_predicate():
    fake = FakeTime()
    responses = iter(
        [
            httpx.Response(200, json={"error": {"code": "maxlag"}}, headers={"Retry-After": "5"}),
            httpx.Response(200, json={"ok": True}),
        ]
    )

    def maxlag(response):
        return response.json().get("error", {}).get("code") == "maxlag"

    client = make_client(lambda r: next(responses), fake, rps=1000, is_throttled=maxlag)
    assert client.get("https://example.org/").json() == {"ok": True}
    assert 5.0 in fake.sleeps


def test_gives_up_after_max_attempts():
    fake = FakeTime()
    client = make_client(lambda r: httpx.Response(503), fake, rps=1000)
    with pytest.raises(SourceUnavailable):
        client.get("https://example.org/")


def test_client_errors_are_not_retried():
    fake = FakeTime()
    client = make_client(lambda r: httpx.Response(404), fake, rps=1000)
    with pytest.raises(httpx.HTTPStatusError):
        client.get("https://example.org/")
    assert client.requests_made == 1
