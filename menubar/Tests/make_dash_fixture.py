#!/usr/bin/env python3
"""대시보드 스냅샷용 픽스처를 실행 시각 기준으로 만든다.

시각을 파일에 고정해 두면 몇 시간 뒤 같은 픽스처가 "측정이 낡음" 상태로 뒤집혀,
디자인 변경 전후를 비교할 때 서로 다른 화면을 보게 된다(2026-09-24 실측: 두 시간
간격으로 렌더한 두 장에서 세션 열이 값에서 "-"로 바뀌어 회귀로 오인했다).
"""
import json
import pathlib
import sys
import time

HOUR_MS = 3_600_000
DAY_MS = 86_400_000


def account(name, status="active", usable=True, enabled=True, error=None,
            session=0.5, weekly=0.9, fable=0.1):
    now_ms = int(time.time() * 1000)
    return {
        "name": name, "type": "oauth", "provider": "anthropic",
        "status": status, "errorReason": error, "planType": None,
        "subscription": {"state": "active", "endsAt": None},
        "usable": usable, "enabled": enabled, "priority": None,
        "quota": {
            "unified5h": session, "unified7d": weekly,
            "unified5hReset": now_ms + 4 * HOUR_MS,
            "unified7dReset": now_ms + 6 * DAY_MS,
            "modelWeekly": {"7d_oi": {"utilization": fable, "reset": now_ms + 6 * DAY_MS}},
        },
        "usage": {"totalInputTokens": 1, "totalOutputTokens": 1, "totalRequests": 1, "lastUsed": None},
        "inflight": 0, "maxConcurrent": 3, "rateLimitedUntil": None, "unsupportedModels": [],
    }


def build():
    accounts = [
        account(f"acct-{i:02d}", session=0.2 + 0.04 * i, weekly=0.3 + 0.04 * i, fable=(0.1 * i) % 1)
        for i in range(1, 13)
    ]
    # 문제 상태 4종. 정상 행과 섞여도 눈에 띄는지가 이 픽스처의 목적이다.
    accounts.append(account("acct-13", status="error", usable=False, error="auth-rejected",
                            session=0.99, weekly=0.99))
    accounts.append(account("acct-14", status="error", usable=False, error="subscription-disabled"))
    accounts.append(account("acct-15", usable=False, enabled=False))
    accounts.append(account("acct-16", session=0.99, weekly=0.995, usable=False))
    accounts.append(account("acct-17", session=0.98, weekly=0.99, usable=False))
    fixture = {
        "teamclaude": {"accounts": accounts, "usableCount": 12, "totalCount": len(accounts)},
        "grok": "Grok 21%",
    }
    fixture["higgsfieldCredits"] = 1494
    fixture["higgsfieldPlan"] = "ultra"
    if "--stale" in sys.argv:
        # 실패 화면은 실패했을 때만 나타나서 평소 스냅샷에 걸리지 않는다. 그래서 따로 그린다.
        fixture["staleNotes"] = {"grok": "12분째 갱신 없음", "agy": "31분째 갱신 없음",
                                 "higgsfield": "48분째 갱신 없음"}
    return fixture


if __name__ == "__main__":
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "menubar/Tests/fixtures-dash.json")
    out.write_text(json.dumps(build(), ensure_ascii=False, indent=2) + "\n")
    print(f"fixture: {out}")
