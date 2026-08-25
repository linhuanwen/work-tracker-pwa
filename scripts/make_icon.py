#!/usr/bin/env python3
"""Generate 工作清单.ico from the same check-mark design as PWA icons.

No extra dependencies beyond Pillow.
Run: python scripts/make_icon.py
Output: build/工作清单.ico
"""

from pathlib import Path
from PIL import Image, ImageDraw

SIZE = 256
OUT = Path(__file__).resolve().parent.parent / "assets" / "工作清单.ico"


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Rounded-rect background with the same blue gradient feel.
    radius = int(size * 0.18)
    d.rounded_rectangle(
        [0, 0, size - 1, size - 1],
        radius=radius,
        fill=(26, 115, 232, 255),
    )

    # Check mark, normalized from the 192x192 SVG geometry.
    # SVG: translate(96,100) path M-42,0 L-8,34 L42,-30
    def pt(x: float, y: float) -> tuple[float, float]:
        return (96 + x, 100 + y)

    p1 = pt(-42, 0)
    p2 = pt(-8, 34)
    p3 = pt(42, -30)

    stroke = max(3, int(size * 0.073))
    d.line([p1, p2, p3], fill=(255, 255, 255, 255), width=stroke, joint="curve")

    return img


def main() -> None:
    img = draw_icon(SIZE)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(
        OUT,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print(f"written: {OUT}")


if __name__ == "__main__":
    main()
