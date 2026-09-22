import Cocoa

/// 클릭 대시보드의 Grok 사용량. 높이는 값이 없어도 같다.
final class GrokQuotaCardView: NSView {
    static let fixedHeight: CGFloat = 96

    var model = GrokCardModel(headline: "Grok 확인 중", detail: nil) {
        didSet {
            setAccessibilityLabel(accessibilityText)
            needsDisplay = true
        }
    }

    override var isFlipped: Bool { true }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setAccessibilityElement(true)
        setAccessibilityRole(.group)
        setAccessibilityLabel(accessibilityText)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private var accessibilityText: String {
        if let detail = model.detail, !detail.isEmpty {
            return "Grok \(model.headline), \(detail)"
        }
        return "Grok \(model.headline)"
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard bounds.width > 0 else { return }

        let panel = NSColor(calibratedRed: 0.095, green: 0.115, blue: 0.15, alpha: 1.0)
        let text = NSColor(calibratedRed: 0.92, green: 0.95, blue: 0.98, alpha: 1.0)
        let muted = NSColor(calibratedRed: 0.55, green: 0.61, blue: 0.70, alpha: 1.0)
        panel.setFill()
        NSBezierPath(roundedRect: bounds.insetBy(dx: 8, dy: 4), xRadius: 8, yRadius: 8).fill()

        drawText("Grok", 20, 14, NSFont.systemFont(ofSize: 13, weight: .semibold), muted)
        drawText(model.headline, 20, 36, NSFont.monospacedDigitSystemFont(ofSize: 26, weight: .bold), text)
        if let detail = model.detail, !detail.isEmpty {
            drawText(detail, 20, 68, NSFont.systemFont(ofSize: 12, weight: .medium), muted)
        }
    }

    private func drawText(_ value: String, _ x: CGFloat, _ y: CGFloat, _ font: NSFont, _ color: NSColor) {
        value.draw(at: NSPoint(x: x, y: y), withAttributes: [.font: font, .foregroundColor: color])
    }
}

/// 클릭 대시보드의 agy 할당량. 숫자는 남은 비율이고 막대는 쓴 비율이다.
final class AgyQuotaCardView: NSView {
    static let fixedHeight: CGFloat = 168

    var model = AgyCardModel(message: "agy 확인 중", groups: []) {
        didSet {
            setAccessibilityLabel(accessibilityText)
            needsDisplay = true
        }
    }

    override var isFlipped: Bool { true }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setAccessibilityElement(true)
        setAccessibilityRole(.group)
        setAccessibilityLabel(accessibilityText)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private var accessibilityText: String {
        "agy \(agyLogLine(model))"
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard bounds.width > 0 else { return }

        let panel = NSColor(calibratedRed: 0.095, green: 0.115, blue: 0.15, alpha: 1.0)
        let track = NSColor(calibratedRed: 0.16, green: 0.19, blue: 0.25, alpha: 1.0)
        let text = NSColor(calibratedRed: 0.92, green: 0.95, blue: 0.98, alpha: 1.0)
        let muted = NSColor(calibratedRed: 0.55, green: 0.61, blue: 0.70, alpha: 1.0)
        panel.setFill()
        NSBezierPath(roundedRect: bounds.insetBy(dx: 8, dy: 4), xRadius: 8, yRadius: 8).fill()
        drawText("agy", 20, 12, NSFont.systemFont(ofSize: 13, weight: .semibold), muted)

        if model.groups.isEmpty {
            drawText(model.message ?? "agy 확인 중", 20, 64, NSFont.systemFont(ofSize: 22, weight: .bold), text)
            return
        }

        let shown = Array(model.groups.prefix(2))
        for (index, group) in shown.enumerated() {
            let originY = 36 + CGFloat(index) * 62
            drawText(agyDisplayName(group.name), 20, originY, NSFont.systemFont(ofSize: 12, weight: .semibold), text)
            drawBucket("주간", group.weekly, 20, originY + 18, bounds.width - 40, track)
            drawBucket("5시간", group.fiveHour, 20, originY + 38, bounds.width - 40, track)
        }
    }

    private func drawBucket(_ title: String, _ bucket: AgyQuotaBucket?, _ x: CGFloat, _ y: CGFloat, _ width: CGFloat, _ track: NSColor) {
        let muted = NSColor(calibratedRed: 0.55, green: 0.61, blue: 0.70, alpha: 1.0)
        let text = NSColor(calibratedRed: 0.92, green: 0.95, blue: 0.98, alpha: 1.0)
        let font = NSFont.systemFont(ofSize: 11, weight: .medium)
        drawText(title, x, y, font, muted)
        guard let bucket, let label = agyRemainingLabel(bucket.remaining) else {
            drawText("확인 필요", x + 48, y, font, muted)
            return
        }
        var caption = label
        if let hint = agyResetHint(bucket.resetAt, now: Date()) {
            caption += " · \(hint)"
        }
        drawText(caption, x + 48, y, font, text)

        let barWidth = min(160, max(0, width - 250))
        guard barWidth > 0 else { return }
        let bar = NSRect(x: x + width - barWidth, y: y + 4, width: barWidth, height: 6)
        track.setFill()
        NSBezierPath(roundedRect: bar, xRadius: 3, yRadius: 3).fill()
        let used = min(1, max(0, 1 - bucket.remaining))
        let fill = NSRect(x: bar.minX, y: bar.minY, width: bar.width * used, height: bar.height)
        barColor(bucket.remaining).setFill()
        NSBezierPath(roundedRect: fill, xRadius: 3, yRadius: 3).fill()
    }

    private func barColor(_ remaining: Double) -> NSColor {
        if remaining > 0.2 {
            return NSColor(calibratedRed: 0.18, green: 0.82, blue: 0.48, alpha: 1.0)
        }
        if remaining > 0.05 {
            return NSColor(calibratedRed: 0.93, green: 0.76, blue: 0.22, alpha: 1.0)
        }
        return NSColor(calibratedRed: 0.96, green: 0.26, blue: 0.32, alpha: 1.0)
    }

    private func drawText(_ value: String, _ x: CGFloat, _ y: CGFloat, _ font: NSFont, _ color: NSColor) {
        value.draw(at: NSPoint(x: x, y: y), withAttributes: [.font: font, .foregroundColor: color])
    }
}
