"""
Fetches total PyPI download count for deepsleep-ai and generates
an animated slot-machine SVG badge saved to assets/dl.svg.
"""
from __future__ import annotations

import urllib.request
import json
from pathlib import Path


# ── fetch ──────────────────────────────────────────────────────────────────

def fetch_total_downloads() -> int:
    """Fetch total downloads from pypistats (with_mirrors — matches PyPI page)."""
    try:
        url = "https://pypistats.org/api/packages/deepsleep-ai/overall"
        req = urllib.request.Request(url, headers={"User-Agent": "deepsleep-badge/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
        total = sum(
            item["downloads"]
            for item in data.get("data", [])
            if item.get("category") == "with_mirrors"
        )
        return total if total else 0
    except Exception:
        return 0


# ── formatting ─────────────────────────────────────────────────────────────

def fmt(n: int) -> str:
    return str(n)


# ── SVG generation ─────────────────────────────────────────────────────────

CHAR_H   = 38          # height of one reel slot (px)
CHAR_W   = 22          # width per character column
SPIN_CYCLES = 2        # full 0-9 spins before landing
REEL_DUR = 1.5         # total animation duration (s)
STAGGER  = 0.18        # delay between each digit settling (s)


def _reel_svg(digit: int, col: int, x: int, y_top: int) -> tuple[str, str]:
    """
    Returns (clipPath + reel group SVG, CSS keyframe string) for one digit.
    The reel spins SPIN_CYCLES full cycles then lands on `digit`.
    """
    seq = list(range(10)) * SPIN_CYCLES + list(range(digit + 1))
    n_frames = len(seq)
    final_ty = -(n_frames - 1) * CHAR_H
    delay = col * STAGGER

    tspans = "".join(
        f'<text x="{x}" y="{j * CHAR_H + int(CHAR_H * 0.78)}" '
        f'text-anchor="middle" class="rd">{d}</text>\n'
        for j, d in enumerate(seq)
    )

    clip_id = f"c{col}"
    reel_cls = f"rl{col}"

    clip = (
        f'<clipPath id="{clip_id}">'
        f'<rect x="{x - CHAR_W // 2}" y="{y_top}" width="{CHAR_W}" height="{CHAR_H}"/>'
        f'</clipPath>'
    )
    group = (
        f'<g clip-path="url(#{clip_id})">'
        f'<g class="{reel_cls}" transform="translate(0,{y_top})">'
        f'{tspans}'
        f'</g></g>'
    )
    css = (
        f'.{reel_cls}{{'
        f'animation:spin{col} {REEL_DUR}s cubic-bezier(.17,.67,.28,1) {delay:.2f}s both;'
        f'}}'
        f'@keyframes spin{col}{{'
        f'0%{{transform:translateY(0)}}'
        f'100%{{transform:translateY({final_ty}px)}}'
        f'}}'
    )
    return clip + group, css


def _static_char_svg(ch: str, col: int, x: int, y_mid: int) -> tuple[str, str]:
    """SVG + CSS for a non-digit character (dot, k, M)."""
    delay = col * STAGGER + REEL_DUR * 0.6
    cls = f"sc{col}"
    svg = f'<text x="{x}" y="{y_mid + int(CHAR_H * 0.35)}" text-anchor="middle" class="rd {cls}">{ch}</text>'
    css = (
        f'.{cls}{{opacity:0;animation:fi{col} .25s ease {delay:.2f}s forwards;}}'
        f'@keyframes fi{col}{{to{{opacity:1}}}}'
    )
    return svg, css


def generate_badge_svg(count: int) -> str:
    chars = list(fmt(count))

    LABEL_W = 112
    PAD     = 12
    WIDTH   = LABEL_W + PAD + len(chars) * CHAR_W + PAD
    HEIGHT  = 52
    y_top   = (HEIGHT - CHAR_H) // 2

    clips_and_reels: list[str] = []
    css_parts: list[str] = []

    for col, ch in enumerate(chars):
        x = LABEL_W + PAD + col * CHAR_W + CHAR_W // 2
        if ch.isdigit():
            svg_part, css_part = _reel_svg(int(ch), col, x, y_top)
        else:
            svg_part, css_part = _static_char_svg(ch, col, x, y_top)
        clips_and_reels.append(svg_part)
        css_parts.append(css_part)

    divider_x = LABEL_W + PAD - 6
    num_bg_w  = WIDTH - divider_x

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">
  <defs>
    <style>
      .rd{{font-family:'Courier New',Courier,monospace;font-size:21px;font-weight:bold;fill:#fff;}}
      .lbl{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:10px;font-weight:700;fill:#f1948a;letter-spacing:1.4px;text-transform:uppercase;}}
      {''.join(css_parts)}
    </style>
    {''.join(clips_and_reels[:0])}
  </defs>

  <!-- red background -->
  <rect width="{WIDTH}" height="{HEIGHT}" rx="9" fill="#c0392b"/>
  <!-- darker number panel -->
  <rect x="{divider_x}" width="{num_bg_w}" height="{HEIGHT}" rx="7" fill="#922b21"/>

  <!-- label -->
  <text x="{PAD}" y="21" class="lbl">total</text>
  <text x="{PAD}" y="36" class="lbl">downloads</text>

  <!-- clip paths -->
  {''.join(c.split('</clipPath>')[0] + '</clipPath>' for c in clips_and_reels if '<clipPath' in c)}

  <!-- reels + static chars -->
  {''.join(c.split('</clipPath>')[-1] if '<clipPath' in c else c for c in clips_and_reels)}
</svg>"""


# ── main ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    count = fetch_total_downloads()
    print(f"Total downloads: {count}  →  {fmt(count)}")

    svg = generate_badge_svg(count)

    out = Path(__file__).parent.parent / "assets" / "dl.svg"
    out.parent.mkdir(exist_ok=True)
    out.write_text(svg, encoding="utf-8")
    print(f"Written: {out}")
