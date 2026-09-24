# menubar/Tests/test_dashboard_wiring.py
"""연속 페이지 배선 회귀(소스 정규식). 대시보드는 한 겹 스크롤이고, 섹션 배치는 DashboardSections.swift의
순수 함수가 맡으며, 고정 헤더는 addFloatingSubview로 얹는다. 섹션별 안쪽 NSScrollView와 936/596 상한이
되살아나면 여기서 잡는다."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "menubar" / "Sources"
MAIN = SOURCES / "main.swift"
SECTIONS = SOURCES / "DashboardSections.swift"
PALETTE = SOURCES / "TeamClaudePalette.swift"


def class_body(source, name):
    match = re.search(r"final class " + re.escape(name) + r"\b(?P<body>.*?)\nfinal class ", source, re.DOTALL)
    assert match is not None, f"{name} must remain discoverable"
    return match.group("body")


class DashboardWiringTests(unittest.TestCase):
    def setUp(self):
        self.main = MAIN.read_text()

    def test_no_per_section_clamp_remains(self):
        self.assertNotIn("maxTeamHeight", self.main)
        self.assertNotIn("maxMenuDashboardHeight", self.main)

    def test_dashboard_view_has_no_inner_scroll_view(self):
        body = class_body(self.main, "StatusMenuDashboardView")
        self.assertNotIn("NSScrollView(", body, "the account table must render at full height inside the one page")
        self.assertNotIn("enclosingScrollView", body)
        self.assertIn("private(set) var sections: [DashboardSection]", body)
        self.assertIn("DashboardSectionHeaderView(", body)
        self.assertIn("dashboardSectionLayout(startY:", body)
        self.assertIn("dashboardSectionBodyY(", body)

    def test_menu_hosting_is_one_helper_with_a_pinned_header(self):
        self.assertEqual(1, self.main.count("func hostDashboard("), "both hosting sites must share one helper")
        self.assertIn("addFloatingSubview(", self.main)
        self.assertIn("verticalScrollElasticity = .allowed", self.main)
        self.assertNotIn("verticalScrollElasticity = .none", self.main)
        self.assertIn("DashboardSectionHeaderView(", self.main)
        self.assertIn("dashboardCurrentSection(", self.main)
        self.assertIn("NSView.boundsDidChangeNotification", self.main)
        self.assertIn("postsBoundsChangedNotifications = true", self.main)
        for site in ("func updateCachedMenuPresentation()", "func menuWillOpen(_ menu: NSMenu)"):
            self.assertIn(site, self.main)
        rebuild = self.main.split("func menuWillOpen(_ menu: NSMenu)", 1)[1].split("func menuDidClose", 1)[0]
        self.assertIn("hostDashboard(dashboard, in: dashboardItem, previousScrollOrigin: nil)", rebuild)
        refresh = self.main.split("func updateCachedMenuPresentation()", 1)[1].split("func menuWillOpen", 1)[0]
        self.assertIn("hostDashboard(dashboard, in: dashboardItem, previousScrollOrigin: previousScrollOrigin)", refresh)

    def test_sections_file_uses_the_palette_only(self):
        sections = SECTIONS.read_text()
        self.assertNotIn("NSColor(", sections)
        self.assertNotIn("NSFont.", sections)
        self.assertIn("TeamClaudePalette.", sections)
        for symbol in ("struct DashboardSection", "func dashboardSectionLayout(", "func dashboardCurrentSection(",
                       "func dashboardSectionBodyY(", "final class DashboardSectionHeaderView"):
            self.assertIn(symbol, sections)

    def test_palette_lives_in_its_own_file(self):
        self.assertTrue(PALETTE.exists())
        self.assertIn("enum TeamClaudePalette", PALETTE.read_text())
        self.assertNotIn("enum TeamClaudePalette", self.main)

    def test_section_order_is_the_same_in_layout_and_configure(self):
        body = class_body(self.main, "StatusMenuDashboardView")
        ids = re.findall(r'\(id: "([a-z]+)", title: "([^"]+)"', body)
        self.assertEqual(len(ids), 10, "preferredHeight and configure each list the five sections")
        expected = [("claude", "Claude 풀"), ("codex", "Codex 풀"), ("higgsfield", "Higgsfield"),
                    ("cli", "CLI 쿼터"), ("usage", "사용량")]
        self.assertEqual(ids[:5], expected)
        self.assertEqual(ids[5:], expected)


class DashboardRefreshCostTests(unittest.TestCase):
    """성능 회귀: Codex 세션 스캔은 10초 틱 밖(60초 타이머, background QoS), 열린 대시보드 리드로는 합쳐서 한 번."""

    def setUp(self):
        self.main = (SOURCES / "main.swift").read_text()

    def test_fast_tick_no_longer_scans_codex_sessions(self):
        start = self.main.index("func loadFastStatusInBackground()")
        end = self.main.index("\n    }\n", start)
        self.assertNotIn("loadCodexStatusInBackground", self.main[start:end])
        self.assertIn("codexScanTimer = Timer.scheduledTimer(withTimeInterval: 60.0", self.main)
        # 기동 킥(refresh)은 스캔을 한 번 돌려야 한다 — 죽은 loadInBackground()에 넣으면 런치 후 60초 동안 Codex 상태가 빈다.
        start = self.main.index("    func refresh() {")
        end = self.main.index("\n    }\n", start)
        self.assertIn("loadCodexStatusInBackground()", self.main[start:end])

    def test_codex_scan_runs_at_background_qos(self):
        start = self.main.index("func loadCodexStatusInBackground()")
        end = self.main.index("\n    }\n\n", start)
        self.assertIn("DispatchQueue.global(qos: .background)", self.main[start:end])
        self.assertNotIn("qos: .utility", self.main[start:end])
        self.assertIn("scan=files:", self.main[start:end])

    def test_open_dashboard_redraws_are_coalesced(self):
        self.assertIn("func scheduleDashboardRefresh(reason: String, immediate: Bool = false)", self.main)
        self.assertGreaterEqual(self.main.count("scheduleDashboardRefresh(reason:"), 12)
        self.assertEqual(0, self.main.count("refreshOpenDashboard()"), "call sites must go through scheduleDashboardRefresh")
        self.assertIn('print("DASHBOARD-REFRESH: reason=', self.main)
        # 닫힌 메뉴는 30초 단위로만 캐시를 데우고, 메뉴를 열 때 대기 중인 갱신을 그 자리에서 반영한다.
        self.assertIn("let closedMenuRefreshWindow: TimeInterval = 30", self.main)
        # 스로틀 의미론: 대기 항목이 있으면 유지(재예약 금지). 디바운스면 10초 로더 완료가 30초 창을 영원히 밀어낸다.
        sched_start = self.main.index("    func scheduleDashboardRefresh(")
        sched_end = self.main.index("\n    }\n", sched_start)
        sched = self.main[sched_start:sched_end]
        self.assertIn("if pendingDashboardRefresh != nil { return }", sched)
        self.assertLess(sched.index("if pendingDashboardRefresh != nil { return }"), sched.index("DispatchWorkItem"))
        self.assertIn("openDashboardView != nil ? 0.3 : closedMenuRefreshWindow", self.main)
        open_start = self.main.index("    func menuWillOpen(")
        open_end = self.main.index("menu.removeAllItems()", open_start)
        self.assertIn('flushPendingDashboardRefresh(reason: "menuWillOpen")', self.main[open_start:open_end])
        # 닫힌 메뉴 경로는 updateContent를 한 번만(캐시 프레젠테이션 안에서) 돌린다 — 예전엔 두 번이라 10초마다 300~800ms를 썼다.
        start = self.main.index('    func refreshOpenDashboard(reason: String = "direct") {')
        end = self.main.index("\n    }\n", start)
        body = self.main[start:end]
        self.assertLess(body.index("if openDashboardView == nil {"), body.index("dashboard.updateContent("))
        self.assertEqual(1, body.count("dashboard.updateContent("))
        host_start = self.main.index("    func hostDashboard(")
        host_end = self.main.index("\n    }\n", host_start)
        self.assertIn("existing.documentView === dashboard", self.main[host_start:host_end])

class HiggsfieldTimerWiringTests(unittest.TestCase):
    """힉스필드 조회는 주기 타이머가 있어야 한다.

    기동 시 1회만 부르면 그 한 번의 실패가 영구 공백이 된다(2026-09-24 실측: 데몬 로그 347분
    동안 조회 1회, 크레딧 칸이 계속 비어 있었다).
    """

    def setUp(self):
        self.main = MAIN.read_text()

    def test_periodic_timer_is_scheduled(self):
        self.assertIn("higgsfieldTimer = Timer.scheduledTimer", self.main)
        self.assertIn("self?.loadHiggsfieldInBackground(force: true)", self.main)
        self.assertIn("RunLoop.main.add(t, forMode: .common)", self.main)

    def test_interval_is_a_named_constant(self):
        # 타이머는 force로 부른다 — 간격과 스로틀이 같은 값이라 force가 없으면 한 틱씩 걸러진다.
        self.assertIn("withTimeInterval: higgsfieldFetchInterval", self.main)
        self.assertIn("< higgsfieldFetchInterval", self.main)
        self.assertNotIn("timeIntervalSince(last) < 600", self.main)


class AgyLaneWiringTests(unittest.TestCase):
    """agy 카드는 Gemini 레인만 올린다(memory-policy: 타 벤더 모델 선택 금지)."""

    def test_card_filters_to_the_gemini_lane(self):
        self.assertIn("agyVisibleGroups(groups)", MAIN.read_text())
        self.assertIn("func agyVisibleGroups", (SOURCES / "AgyUsage.swift").read_text())


class CliLaneHealthWiringTests(unittest.TestCase):
    """CLI 쿼터 레인(grok·agy·힉스필드)이 조용히 죽지 않게 하는 불변식.

    같은 계열 사고가 세 번 났다 — agy는 데몬 수명 내내 실패했고(작업 폴더), 힉스필드는 주기
    조회가 없었고(기동 1회), grok은 만료를 '로그인'으로만 보여줬다. 공통 원인은 '값 없음'과
    '죽었음'을 구분하지 못한 것이다. 레인을 새로 붙일 때 이 세 가지를 빠뜨리면 여기서 걸린다.
    """

    LANES = (
        ("grok", "grokTimer", "loadGrokUsageInBackground", "grokUsageFetchInterval"),
        ("agy", "agyTimer", "loadAgyUsageInBackground", "agyUsageFetchInterval"),
        ("higgsfield", "higgsfieldTimer", "loadHiggsfieldInBackground", "higgsfieldFetchInterval"),
    )

    def setUp(self):
        self.main = MAIN.read_text()

    def test_every_lane_has_a_periodic_timer(self):
        for name, timer, loader, interval in self.LANES:
            with self.subTest(lane=name):
                self.assertIn(f"{timer} = Timer.scheduledTimer", self.main)
                self.assertIn(f"withTimeInterval: {interval}", self.main)
                self.assertIn(f"self?.{loader}(", self.main)

    def test_every_lane_records_its_own_success_time(self):
        # 시도 시각(last*FetchedAt)만으로는 '계속 실패 중'을 알 수 없다.
        # 선언만 남고 대입이 사라지면 영원히 nil이 되므로 대입 자체를 본다.
        for name, _, _, _ in self.LANES:
            with self.subTest(lane=name):
                self.assertRegex(self.main, rf"\b{name}LastSuccessAt\s*=\s*Date\(\)")

    def test_config_reads_are_cached(self):
        # 계정마다 설정 파일을 읽고 파싱하면 1초 타이머가 도는 동안 메인 스레드에서
        # 그 일이 초당 계정 수만큼 반복된다(적대 리뷰 2026-09-24).
        source = (SOURCES / "AccountSubscription.swift").read_text()
        self.assertIn("AccountSubscriptionFileCache", source)
        self.assertIn("modificationDate", source)
        self.assertEqual(source.count("Data(contentsOf: url)"), 1,
                         "파일 읽기는 캐시 한 곳을 거쳐야 한다")
        # 구독 모니터 캐시도 같은 경로를 타야 한다 — 이쪽은 계정마다 SHA256까지 돈다.
        self.assertIn("AccountSubscriptionFileCache.shared.json(at: url, maxBytes: 1_048_576)", source)

    def test_extra_agy_lanes_are_counted_not_dropped(self):
        card = (SOURCES / "CliQuotaCards.swift").read_text()
        self.assertIn("agy.groups.count > 1", card)

    def test_every_lane_logs_each_cycle(self):
        # 한 레인만 조용하면 "조회가 도는가"를 로그로 답할 수 없다.
        for marker in ('print("GROK-SLOT:', 'print("AGY:', 'print("HIGGSFIELD:'):
            with self.subTest(marker=marker):
                self.assertIn(marker, self.main)

    def test_partial_fetch_is_not_recorded_as_success(self):
        # 일부 페이지만 받은 응답은 error가 nil이라, 그것까지 성공으로 적으면
        # 반쪽 상태가 계속돼도 지연 경보가 영영 뜨지 않는다(astra 지적 2026-09-24).
        self.assertIn("data.error == nil && data.partialError == nil", self.main)

    def test_stale_cooldown_is_per_lane(self):
        # 쿨다운이 전역 하나면 한 레인이 경보한 직후 다른 레인이 10분간 묻힌다.
        self.assertIn("lastLaneStaleLogAt: [String: Date]", self.main)
        self.assertIn("lastLaneStaleLogAt[notice.name]", self.main)

    def test_stale_lanes_are_reported(self):
        self.assertIn("func reportStaleLanes", self.main)
        self.assertIn("reportStaleLanes()", self.main)
        self.assertIn("laneStaleMessages(", self.main)
        for name, _, _, _ in self.LANES:
            with self.subTest(lane=name):
                self.assertIn(f'LaneHealth(name: "{name}"', self.main)

    def test_grok_separates_expiry_from_logged_out(self):
        grok = (SOURCES / "GrokUsage.swift").read_text()
        self.assertIn("case expired", grok)
        self.assertIn("candidates.isEmpty ? .login : .expired", grok)
        self.assertIn("Grok 갱신 필요", self.main)


class AccountRowLinesWiringTests(unittest.TestCase):
    """계정 행 보조 줄(2행 사유·3행 구독)은 조건부다 — 17행에 같은 '미확인' 문구가 반복되면 문제 계정이 묻힌다.

    행 높이가 행마다 달라졌으므로 높이 계산(teamContentHeight)·버튼 배치(layout)·그리기(draw)가 같은 판정
    (TeamClaudeHealth.rowLines → TeamClaudeRowLines.swift)을 써야 한다. 한 경로만 고정 72pt로 되돌아가면 여기서 잡는다.
    """

    def setUp(self):
        self.main = MAIN.read_text()
        self.table = class_body(self.main, "TeamClaudeTableView")
        self.dashboard = class_body(self.main, "StatusMenuDashboardView")

    def _method(self, body, signature):
        start = body.index(signature)
        return body[start:body.index("\n    }\n", start)]

    def test_height_layout_and_draw_share_one_judgement(self):
        height = self._method(self.dashboard, "static func teamContentHeight(")
        self.assertIn("teamClaudeRowsHeight(health.rowLines(now: now))", height)
        self.assertNotIn("* 72", height, "row height is per row now, not a fixed multiple")
        self.assertNotIn("* 72", self.table)
        layout = self._method(self.table, "override func layout()")
        self.assertIn("health.rowLines(now: evaluatedAt)", layout)
        self.assertIn("teamClaudeRowOrigins(lines)", layout)
        self.assertIn("teamClaudeSubscriptionLineY(lines[index])", layout)
        self.assertIn("button.isHidden = lineY == nil", layout, "the button stays alive but hidden so profile refresh keeps running")
        draw = self.table[self.table.index("override func draw("):]
        self.assertIn("health.rowLines(now: evaluatedAt, availability: availability)", draw)
        self.assertIn("teamClaudeRowOrigins(lines)", draw)
        self.assertIn("teamClaudeRowHeight(lines[i])", draw)
        self.assertIn("teamClaudeReasonLineY(lines[i])", draw)

    def test_judgement_lives_outside_main(self):
        rows = (SOURCES / "TeamClaudeRowLines.swift").read_text()
        for symbol in ("func teamClaudeReasonLineIsInformative(", "func accountSubscriptionLineIsInformative(",
                       "func teamClaudeRowHeight(", "func teamClaudeRowOrigins(", "func teamClaudeRowsHeight(",
                       "enum TeamClaudeRowReason"):
            self.assertIn(symbol, rows)
        availability = (SOURCES / "TeamClaudeAvailability.swift").read_text()
        self.assertIn("func rowLines(", availability)
        # 생략 가능한 사유 문구는 상수를 거쳐야 한다. 문자열을 두 파일에 따로 두면 한쪽만 고쳐져 판정이 빗나간다.
        for literal in ('"한도 기준 확인 필요"', '"오프라인 · 확인 필요"', '"최신 한도 측정 필요"',
                        '"Fable 사용 가능"', '"Opus 사용 가능"'):
            self.assertNotIn(literal, availability)

    def test_row_height_change_is_relayed_to_the_dashboard(self):
        # 시간 경과·구독 자동 조회로 줄 판정이 바뀌면 표 혼자 못 늘어난다. 대시보드 재구성까지 이어져야 한다.
        self.assertIn("onContentHeightChange", self.table)
        self.assertIn("view.onContentHeightChange = { [weak self] in self?.onTeamRowsChange?() }", self.dashboard)
        self.assertIn("Self.teamContentHeight(teamClaude) != renderedTeamHeight", self.dashboard)
        self.assertIn('scheduleDashboardRefresh(reason: "team-rows")', self.main)

    def test_cli_lanes_share_one_card(self):
        # Grok·agy는 레인당 한 줄. 카드 두 장(96 + 4 + 168pt)으로 되돌아가면 잡는다.
        cli = (SOURCES / "CliQuotaCards.swift").read_text()
        self.assertEqual(1, cli.count("final class "), "one card holds both lanes")
        self.assertIn("final class CliQuotaLanesView", cli)
        self.assertIn("static let cliHeight: CGFloat = CliQuotaLanesView.fixedHeight", self.dashboard)
        for legacy in ("GrokQuotaCardView", "AgyQuotaCardView"):
            self.assertNotIn(legacy, self.main)
            self.assertNotIn(legacy, cli)



if __name__ == "__main__":
    unittest.main()
