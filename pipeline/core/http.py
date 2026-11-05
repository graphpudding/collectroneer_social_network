"""Polite HTTP client shared by all adapters (docs/SPEC.md, section 9).

One client per source: requests are sequential, spaced by the source's rate limit,
and throttling responses (429/503, MediaWiki maxlag) are waited out, never hammered.
"""

import email.utils
import logging
import time
from collections.abc import Callable
from typing import Any

import httpx

USER_AGENT = "CollectiblesCatalog/0.1 (pblhelka@gmail.com)"

# Wait used when a throttling response carries no Retry-After; doubles on each retry.
BASE_BACKOFF_SECONDS = 30.0
MAX_ATTEMPTS = 6

log = logging.getLogger("catalog.http")


class SourceUnavailable(Exception):
    pass


def default_is_throttled(response: httpx.Response) -> bool:
    return response.status_code in (429, 503)


def retry_after_seconds(response: httpx.Response) -> float | None:
    value = response.headers.get("Retry-After")
    if not value:
        return None
    if value.strip().isdigit():
        return float(value)
    parsed = email.utils.parsedate_to_datetime(value)
    return max(0.0, parsed.timestamp() - time.time())


class PoliteClient:
    def __init__(
        self,
        source: str,
        requests_per_second: float,
        *,
        is_throttled: Callable[[httpx.Response], bool] = default_is_throttled,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
        timeout: float = 60.0,
    ) -> None:
        self.source = source
        self.min_interval = 1.0 / requests_per_second
        self.is_throttled = is_throttled
        self.sleep = sleep
        self.clock = clock
        self.requests_made = 0
        self._last_request_at: float | None = None
        self._http = httpx.Client(
            headers={"User-Agent": USER_AGENT},
            timeout=timeout,
            transport=transport,
            follow_redirects=True,
        )

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "PoliteClient":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def _wait_for_slot(self) -> None:
        if self._last_request_at is not None:
            remaining = self.min_interval - (self.clock() - self._last_request_at)
            if remaining > 0:
                self.sleep(remaining)
        self._last_request_at = self.clock()

    def request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        backoff = BASE_BACKOFF_SECONDS
        for attempt in range(1, MAX_ATTEMPTS + 1):
            self._wait_for_slot()
            self.requests_made += 1
            try:
                response = self._http.request(method, url, **kwargs)
            except httpx.TransportError as exc:
                log.warning(
                    "%s: %s %s failed (%s), attempt %d", self.source, method, url, exc, attempt
                )
                wait = backoff
            else:
                if not self.is_throttled(response) and response.status_code < 500:
                    response.raise_for_status()
                    return response
                wait = retry_after_seconds(response) or backoff
                log.warning(
                    "%s: %s %s -> %d, waiting %.0fs, attempt %d",
                    self.source,
                    method,
                    url,
                    response.status_code,
                    wait,
                    attempt,
                )
            if attempt < MAX_ATTEMPTS:
                self.sleep(wait)
                backoff *= 2
        raise SourceUnavailable(f"{self.source}: gave up on {url} after {MAX_ATTEMPTS} attempts")

    def get(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("POST", url, **kwargs)
