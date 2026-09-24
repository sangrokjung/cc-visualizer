import Cocoa

/// 클릭 대시보드의 CLI 쿼터 카드. Grok·agy 두 레인을 한 카드 안에 레인당 한 줄로 둔다.
/// 예전엔 레인마다 카드 한 장(96pt + 168pt)이었는데 내용은 한 줄뿐이라 화면 높이만 먹었다.
/// 힉스필드는 크레딧·주기·지출까지 실어 정보량이 달라 별도 섹션(HiggsfieldCreditsView)에 그대로 둔다.
/// 높이는 값이 없어도 같다 — "확인 중"도 한 줄이다.
final class CliQuotaLanesView: NSView {
    static let laneHeight: CGFloat = 26
    static let topInset: CGFloat = 14
    static let fixedHeight: CGFloat = topInset * 2 + laneHeight * 2

    var grok = GrokCardModel(headline: "Grok 확인 중", detail: nil) {
        didSet {
            setAccessibilityLabel(accessibilityText)
            needsDisplay = true
        }
    }

    var agy = AgyCardModel(message: "agy 확인 중", groups: []) {
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
        var grokText = "Grok \(grok.headline)"
        if let detail = grok.detail, !detail.isEmpty { grokText += ", \(detail)" }
        return "\(grokText); agy \(agyLogLine(agy))"
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard bounds.width > 0 else { return }

        let panel = NSColor(calibratedRed: 0.095, green: 0.115, blue: 0.15, alpha: 1.0)
        let text = NSColor(calibratedRed: 0.92, green: 0.95, blue: 0.98, alpha: 1.0)
        let muted = NSColor(calibratedRed: 0.55, green: 0.61, blue: 0.70, alpha: 1.0)
        panel.setFill()
        NSBezierPath(roundedRect: bounds.insetBy(dx: 8, dy: 4), xRadius: 8, yRadius: 8).fill()

        let laneFont = NSFont.systemFont(ofSize: 13, weight: .semibold)
        let valueFont = NSFont.monospacedDigitSystemFont(ofSize: 14, weight: .bold)
        let detailFont = NSFont.systemFont(ofSize: 12, weight: .medium)
        let valueX: CGFloat = 84

        let grokY = Self.topInset
        drawText("Grok", 20, grokY, laneFont, muted)
        drawText(grok.headline, valueX, grokY - 1, valueFont, text)
        if let detail = grok.detail, !detail.isEmpty {
            let used = grok.headline.size(withAttributes: [.font: valueFont]).width
            drawText(detail, valueX + used + 12, grokY + 1, detailFont, muted)
        }

        let agyY = Self.topInset + Self.laneHeight
        drawText("agy", 20, agyY, laneFont, muted)
        guard let group = agy.groups.first else {
            drawText(agy.message ?? "agy 확인 중", valueX, agyY - 1, valueFont, text)
            return
        }
        drawText(agyDisplayName(group.name), valueX, agyY + 1, NSFont.systemFont(ofSize: 12, weight: .semibold), text)
        // 두 버킷을 같은 줄에 나란히. 막대 폭은 카드 폭에서 글자 자리를 뺀 나머지를 반씩 나눈다.
        let bucketX = valueX + 110
        let bucketWidth = (bounds.width - 20 - bucketX - 16) / 2
        drawBucket("주간", group.weekly, bucketX, agyY + 1, bucketWidth)
        drawBucket("5시간", group.fiveHour, bucketX + bucketWidth + 16, agyY + 1, bucketWidth)
    }

    private func drawBucket(_ title: String, _ bucket: AgyQuotaBucket?, _ x: CGFloat, _ y: CGFloat, _ width: CGFloat) {
        let track = NSColor(calibratedRed: 0.16, green: 0.19, blue: 0.25, alpha: 1.0)
        let muted = NSColor(calibratedRed: 0.55, green: 0.61, blue: 0.70, alpha: 1.0)
        let text = NSColor(calibratedRed: 0.92, green: 0.95, blue: 0.98, alpha: 1.0)
        let font = NSFont.systemFont(ofSize: 11, weight: .medium)
        drawText(title, x, y, font, muted)
        guard let bucket, let label = agyRemainingLabel(bucket.remaining) else {
            drawText("확인 필요", x + 40, y, font, muted)
            return
        }
        var caption = label
        if let hint = agyResetHint(bucket.resetAt, now: Date()) {
            caption += " · \(hint)"
        }
        drawText(caption, x + 40, y, font, text)

        let barWidth = min(120, max(0, width - 190))
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
