import Cocoa

final class CodexStatusView: NSView {
    static let baseHeight: CGFloat = 406
    static func poolSectionHeight(for pool: TeamCodexPoolHealth?) -> CGFloat {
        guard let pool = pool else { return 0 }
        return 62 + CGFloat(max(1, min(pool.accounts.count, 4))) * 36
    }
    static func preferredHeight(for pool: TeamCodexPoolHealth?) -> CGFloat {
        baseHeight + (pool == nil ? 0 : poolSectionHeight(for: pool) + 10)
    }
    var health: CodexHealth? {
        didSet {
            updateAccessibility()
            setAccessibilityHelp("GPT-5.6 작업 추천: 구현과 설계는 gpt-5.6 medium, 리뷰와 보안은 gpt-5.6-sol high, 탐색과 병렬 작업은 gpt-5.6-terra low, 분류와 반복 작업은 gpt-5.6-luna none 또는 low")
            needsDisplay = true
        }
    }
    var pool: TeamCodexPoolHealth? {
        didSet {
            updateAccessibility()
            needsDisplay = true
        }
    }
    var usage: UsageData? {
        didSet { needsDisplay = true }
    }
    override var isFlipped: Bool { true }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setAccessibilityElement(true)
        setAccessibilityRole(.group)
        setAccessibilityLabel("Codex 상태")
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func updateAccessibility() {
        let codexSummary = health?.accessibilitySummary ?? "Codex 상태"
        let poolSummary = pool.map { ", \($0.accessibilitySummary)" } ?? ""
        setAccessibilityLabel(codexSummary + poolSummary)
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)

        let bg = NSColor(calibratedRed: 0.06, green: 0.075, blue: 0.10, alpha: 0.97)
        let panel = NSColor(calibratedRed: 0.095, green: 0.115, blue: 0.15, alpha: 1.0)
        let panel2 = NSColor(calibratedRed: 0.12, green: 0.14, blue: 0.18, alpha: 1.0)
        let line = NSColor(calibratedRed: 0.23, green: 0.27, blue: 0.34, alpha: 1.0)
        let text = NSColor(calibratedRed: 0.92, green: 0.95, blue: 0.98, alpha: 1.0)
        let muted = NSColor(calibratedRed: 0.55, green: 0.61, blue: 0.70, alpha: 1.0)
        let dim = NSColor(calibratedRed: 0.40, green: 0.46, blue: 0.55, alpha: 1.0)
        let green = NSColor(calibratedRed: 0.18, green: 0.82, blue: 0.48, alpha: 1.0)
        let yellow = NSColor(calibratedRed: 0.93, green: 0.76, blue: 0.22, alpha: 1.0)
        let red = NSColor(calibratedRed: 0.96, green: 0.26, blue: 0.32, alpha: 1.0)
        let blue = codexColor()
        let titleFont = NSFont.systemFont(ofSize: 18, weight: .bold)
        let subFont = NSFont.systemFont(ofSize: 13, weight: .medium)
        let headFont = NSFont.systemFont(ofSize: 12, weight: .semibold)
        let rowFont = NSFont.monospacedSystemFont(ofSize: 13, weight: .medium)
        let smallFont = NSFont.monospacedSystemFont(ofSize: 11, weight: .regular)

        func attrs(_ font: NSFont, _ color: NSColor) -> [NSAttributedString.Key: Any] {
            [.font: font, .foregroundColor: color]
        }
        func drawText(_ value: String, _ x: CGFloat, _ y: CGFloat, _ font: NSFont, _ color: NSColor) {
            value.draw(at: NSPoint(x: x, y: y), withAttributes: attrs(font, color))
        }
        func drawRight(_ value: String, _ x: CGFloat, _ y: CGFloat, _ font: NSFont, _ color: NSColor) {
            let a = attrs(font, color)
            let s = value.size(withAttributes: a)
            value.draw(at: NSPoint(x: x - s.width, y: y), withAttributes: a)
        }
        func fillRound(_ rect: NSRect, _ color: NSColor, _ radius: CGFloat) {
            color.setFill()
            NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
        }
        func strokeRound(_ rect: NSRect, _ color: NSColor, _ radius: CGFloat) {
            color.setStroke()
            let p = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
            p.lineWidth = 1
            p.stroke()
        }
        func pill(_ value: String, x: CGFloat, y: CGFloat, color: NSColor) {
            let size = value.size(withAttributes: attrs(subFont, color))
            let rect = NSRect(x: x, y: y, width: size.width + 16, height: 22)
            fillRound(rect, color.withAlphaComponent(0.14), 11)
            strokeRound(rect, color.withAlphaComponent(0.38), 11)
            drawText(value, x + 8, y + 3.5, subFont, color)
        }
        func metric(_ title: String, _ value: String, _ detail: String, percent: Double? = nil, x: CGFloat, y: CGFloat, width: CGFloat, color: NSColor) {
            let rect = NSRect(x: x, y: y, width: width, height: 54)
            fillRound(rect, panel, 9)
            strokeRound(rect, line.withAlphaComponent(0.8), 9)
            drawText(title.uppercased(), x + 10, y + 8, headFont, muted)
            let font = NSFont.monospacedSystemFont(ofSize: value.count > 12 ? 15 : 18, weight: .bold)
            drawText(value, x + 10, y + 25, font, color)
            drawRight(detail, x + width - 10, y + 31, smallFont, dim)
            if let percent = percent {
                let track = NSRect(x: x + 10, y: y + 45, width: width - 20, height: 4)
                fillRound(track, NSColor.white.withAlphaComponent(0.10), 2)
                let fillWidth = track.width * CGFloat(max(0, min(100, percent)) / 100)
                if fillWidth > 0 {
                    fillRound(NSRect(x: track.minX, y: track.minY, width: max(2, fillWidth), height: track.height), color, 2)
                }
            }
        }
        func limitTone(_ value: Double?) -> NSColor {
            guard let value = value else { return muted }
            if value >= 90 { return red }
            if value >= 70 { return yellow }
            return green
        }

        let card = bounds.insetBy(dx: 8, dy: 4)
        fillRound(card, bg, 14)
        strokeRound(card, line, 14)
        let innerX = card.minX + 16
        let topY = card.minY + 14

        func drawTeamCodexPool(at poolY: CGFloat) {
            guard let pool = pool else { return }
            let poolHeight = Self.poolSectionHeight(for: pool)
            let poolRect = NSRect(x: innerX, y: poolY, width: card.width - 32, height: poolHeight)
            fillRound(poolRect, panel2, 8)
            strokeRound(poolRect, line.withAlphaComponent(0.8), 8)
            let poolTone = !pool.serverReachable ? red : (pool.usableCount == 0 ? yellow : green)
            drawText("TeamCodex 계정 풀", poolRect.minX + 12, poolRect.minY + 9, subFont, text)
            pill(pool.statusLabel, x: poolRect.minX + 145, y: poolRect.minY + 5, color: poolTone)
            drawRight("활성 \(pool.activeCount)/\(pool.accounts.count) · 사용 가능 \(pool.usableCount) · port \(pool.serverPort)", poolRect.maxX - 12, poolRect.minY + 10, smallFont, muted)

            let headerY = poolRect.minY + 36
            drawText("계정", poolRect.minX + 12, headerY, headFont, muted)
            drawText("상태", poolRect.minX + 250, headerY, headFont, muted)
            drawText("5시간 / 초기화", poolRect.minX + 355, headerY, headFont, muted)
            drawText("7일 / 초기화", poolRect.minX + 445, headerY, headFont, muted)
            drawText("동시", poolRect.minX + 530, headerY, headFont, muted)
            drawText("요청", poolRect.minX + 620, headerY, headFont, muted)
            drawText("토큰", poolRect.minX + 720, headerY, headFont, muted)

            let rows = Array(pool.accounts.prefix(4))
            if rows.isEmpty {
                drawText("TeamCodex에 등록된 계정이 없습니다", poolRect.minX + 12, headerY + 25, rowFont, dim)
                return
            }
            for (index, account) in rows.enumerated() {
                let rowY = headerY + 22 + CGFloat(index) * 36
                if index % 2 == 1 {
                    fillRound(NSRect(x: poolRect.minX + 4, y: rowY - 2, width: poolRect.width - 8, height: 35), NSColor.white.withAlphaComponent(0.035), 7)
                }
                let quotaBlocked = account.isQuotaBlocked(
                    switchThresholdPercent: pool.switchThresholdPercent
                )
                let accountTone = !account.enabled
                    ? dim
                    : (account.isUsable(switchThresholdPercent: pool.switchThresholdPercent) ? green : yellow)
                let marker = account.isCurrent ? "● " : "  "
                let statusText: String
                if quotaBlocked {
                    statusText = "제한"
                } else {
                    switch account.status {
                    case "active": statusText = "사용 중"
                    case "available": statusText = "대기"
                    case "disabled": statusText = "비활성"
                    case "throttled": statusText = "제한"
                    case "exhausted": statusText = "소진"
                    case "error": statusText = "오류"
                    case "configured": statusText = "설정됨"
                    default: statusText = account.status
                    }
                }
                drawText(marker + account.name, poolRect.minX + 12, rowY, rowFont, accountTone)
                drawText(statusText, poolRect.minX + 250, rowY, rowFont, accountTone)
                drawText(formatCodexPercent(account.sessionPercent), poolRect.minX + 355, rowY, rowFont, limitTone(account.sessionPercent))
                drawText(formatCodexPercent(account.weeklyPercent), poolRect.minX + 445, rowY, rowFont, limitTone(account.weeklyPercent))
                drawText(formatTeamCodexResetRemaining(account.sessionResetAt), poolRect.minX + 355, rowY + 17, smallFont, quotaBlocked ? accountTone : dim)
                drawText(formatTeamCodexResetRemaining(account.weeklyResetAt), poolRect.minX + 445, rowY + 17, smallFont, dim)
                drawText("\(account.inflight)/\(account.maxConcurrent)", poolRect.minX + 530, rowY, rowFont, muted)
                drawText("\(account.totalRequests)", poolRect.minX + 620, rowY, rowFont, muted)
                drawText(formatCodexTokens(account.totalTokens), poolRect.minX + 720, rowY, rowFont, muted)
            }
        }

        let poolHeight = Self.poolSectionHeight(for: pool)
        let layout = codexStatusLayout(
            topY: Double(topY),
            poolHeight: Double(poolHeight),
            hasPool: pool != nil,
            localUsageLoaded: health != nil
        )

        guard let health = health else {
            drawText("Codex", innerX, topY, titleFont, text)
            drawText("로컬 사용량 집계 중입니다", innerX, topY + 29, subFont, muted)
            drawTeamCodexPool(at: CGFloat(layout.poolY))
            return
        }

        let tone = health.isError ? red : (health.isWarning ? yellow : green)
        let modelLabel = health.model.map(codexShortenModelName) ?? "default"
        let plan = health.planType ?? health.serviceTier ?? "-"
        let effort = health.reasoningEffort ?? "-"
        let effortText = effort == "-" ? "" : " · effort \(effort)"
        let context = health.contextWindow.map { "\($0 / 1000)K ctx" } ?? "ctx -"
        let primaryColor = limitTone(health.primaryUsedPercent)
        let secondaryColor = limitTone(health.secondaryUsedPercent)
        let codexModels = usage?.modelBreakdown.filter { $0.provider == "Codex" } ?? []
        let codexMonthlyCost = codexModels.reduce(0) { $0 + $1.cost }
        let codexMonthlyTokens = codexModels.reduce(0) { $0 + $1.tokens }

        drawText("Codex 사용량", innerX, topY, titleFont, text)
        pill(health.statusLabel, x: innerX + 118, y: topY - 2, color: tone)
        drawRight("최근 \(formatCodexAge(health.lastCallAt))", card.maxX - 16, topY + 2, subFont, muted)
        drawText("인증 \(health.authLabel)  ·  모델 \(modelLabel)  ·  플랜 \(plan)\(effortText)  ·  \(context)", innerX, topY + 29, subFont, muted)

        drawTeamCodexPool(at: CGFloat(layout.poolY))

        let statY = CGFloat(layout.metricsY)
        let gap: CGFloat = 9
        let statW = (card.width - 32 - gap * 3) / 4
        metric("5시간 사용", formatCodexPercent(health.primaryUsedPercent), "리셋 \(formatCodexReset(health.primaryResetAt))", percent: health.primaryUsedPercent, x: innerX, y: statY, width: statW, color: primaryColor)
        metric("7일 사용", formatCodexPercent(health.secondaryUsedPercent), "리셋 \(formatCodexReset(health.secondaryResetAt))", percent: health.secondaryUsedPercent, x: innerX + (statW + gap), y: statY, width: statW, color: secondaryColor)
        metric("오늘 토큰", formatCodexTokens(health.todayTokens), "\(health.todayCalls)회", x: innerX + (statW + gap) * 2, y: statY, width: statW, color: blue)
        let monthlyDetail = codexMonthlyCost > 0 ? formatKRWShort(codexMonthlyCost, rate: usage?.usdKrwRate ?? 1450) : formatCodexTokens(codexMonthlyTokens)
        metric("월 환산비용", codexMonthlyCost > 0 ? formatCost(codexMonthlyCost) : "-", monthlyDetail, x: innerX + (statW + gap) * 3, y: statY, width: statW, color: blue)

        let tableY = statY + 70
        fillRound(NSRect(x: innerX, y: tableY, width: card.width - 32, height: 28), panel2, 8)
        drawText("모델", innerX + 12, tableY + 7, headFont, muted)
        drawText("호출", innerX + 250, tableY + 7, headFont, muted)
        drawText("오늘 토큰", innerX + 345, tableY + 7, headFont, muted)
        drawText("7일 토큰", innerX + 465, tableY + 7, headFont, muted)
        drawText("상태", innerX + 585, tableY + 7, headFont, muted)
        drawText("최근", innerX + 730, tableY + 7, headFont, muted)

        let rows = Array(health.profiles.prefix(3))
        if rows.isEmpty {
            drawText("Codex 세션 사용 기록 없음", innerX + 12, tableY + 42, rowFont, dim)
        } else {
            for (i, row) in rows.enumerated() {
                let y = tableY + 34 + CGFloat(i) * 24
                if i % 2 == 1 {
                    fillRound(NSRect(x: innerX, y: y - 1, width: card.width - 32, height: 23), NSColor.white.withAlphaComponent(0.035), 7)
                }
                let eventCount = row.quotaEvents + row.errorEvents
                let eventText = eventCount > 0 ? "Q\(row.quotaEvents)/E\(row.errorEvents)" : formatCodexVerdict(row.lastVerdict)
                let eventColor = row.quotaEvents > 0 ? red : (row.errorEvents > 0 ? yellow : green)
                fillRound(NSRect(x: innerX + 10, y: y + 7, width: 8, height: 8), eventColor, 4)
                drawText(row.profile, innerX + 24, y + 2, rowFont, text)
                drawText("\(row.todayCalls)/\(row.weekCalls)", innerX + 250, y + 2, rowFont, row.todayCalls > 0 ? green : muted)
                drawText(formatCodexTokens(row.todayTokens), innerX + 345, y + 2, rowFont, row.todayTokens > 0 ? green : muted)
                drawText(formatCodexTokens(row.weekTokens), innerX + 465, y + 2, rowFont, row.weekTokens > 0 ? green : muted)
                drawText(eventText, innerX + 585, y + 2, rowFont, eventColor)
                drawText(formatCodexAge(row.lastAt), innerX + 730, y + 2, smallFont, muted)
            }
        }

        let recommendationY = tableY + 112
        let recommendationRect = NSRect(x: innerX, y: recommendationY, width: card.width - 32, height: 96)
        fillRound(recommendationRect, panel2, 8)
        strokeRound(recommendationRect, line.withAlphaComponent(0.8), 8)
        drawText("GPT-5.6 작업 추천", recommendationRect.minX + 12, recommendationRect.minY + 9, subFont, text)
        let currentModel = "현재 \(modelLabel)\(effort == "-" ? "" : " · \(effort)")"
        drawRight(currentModel, recommendationRect.maxX - 12, recommendationRect.minY + 9, smallFont, blue)

        let columnY = recommendationRect.minY + 36
        let columnWidth = recommendationRect.width / CGFloat(codexModelRecommendations.count)
        let recommendationColors = [green, red, blue, yellow]
        for (index, recommendation) in codexModelRecommendations.enumerated() {
            let x = recommendationRect.minX + CGFloat(index) * columnWidth
            if index > 0 {
                line.withAlphaComponent(0.65).setStroke()
                let divider = NSBezierPath()
                divider.move(to: NSPoint(x: x, y: columnY - 4))
                divider.line(to: NSPoint(x: x, y: recommendationRect.maxY - 10))
                divider.lineWidth = 1
                divider.stroke()
            }
            let color = recommendationColors[index]
            drawText(recommendation.task, x + 12, columnY, headFont, muted)
            drawText(recommendation.model, x + 12, columnY + 20, rowFont, color)
            drawText(recommendation.effort, x + 12, columnY + 39, smallFont, dim)
        }

        let footerY = card.maxY - 30
        let hint = health.hints.first ?? "프롬프트: 목표 · 성공 기준 · 권한 · 검증만 명확하게"
        drawText(hint, innerX, footerY, smallFont, health.hints.isEmpty ? dim : tone)
        drawRight("files \(health.scannedLogFiles) · tok \(formatCodexTokens(health.totalTokens)) · 7d reset \(formatCodexReset(health.secondaryResetAt))", card.maxX - 16, footerY, smallFont, dim)
    }
}
