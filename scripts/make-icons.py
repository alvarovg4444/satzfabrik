"""Draws the app icons (pixel art on a 32 x 32 grid) into pwa/. Run once: python3 scripts/make-icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw

YELLOW = (242, 183, 5)
INK = (31, 36, 40)
BRICK = (176, 67, 43)
BRICK_LO = (140, 52, 33)
GLASS = (213, 230, 232)
WARM = (255, 224, 138)
STEEL = (44, 106, 120)
WHITE = (248, 246, 241)
SMOKE = (225, 221, 212)

def art() -> Image.Image:
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    px = lambda x, y, c: d.point((x, y), fill=c)
    rect = lambda x0, y0, x1, y1, c: d.rectangle((x0, y0, x1, y1), fill=c)
    # speech bubble with an umlaut A
    rect(14, 3, 27, 11, WHITE)
    rect(13, 4, 28, 10, WHITE)
    for x, y in ((16, 12), (15, 13), (17, 12)):
        px(x, y, WHITE)
    glyph = [".X.X.", ".....", ".XXX.", "X...X", "XXXXX", "X...X", "X...X"]
    for j, row in enumerate(glyph):
        for i, ch in enumerate(row):
            if ch == "X":
                px(18 + i, 4 + j, INK)
    # smoke from the chimney
    for x, y in ((7, 6), (8, 5), (6, 4), (7, 4), (9, 3), (10, 3), (8, 2)):
        px(x, y, SMOKE)
    # chimney
    rect(6, 7, 8, 16, BRICK)
    rect(6, 7, 8, 7, INK)
    rect(6, 10, 8, 10, BRICK_LO)
    rect(6, 13, 8, 13, BRICK_LO)
    # hall body
    rect(4, 17, 27, 27, BRICK)
    for y in (19, 22, 25):
        for x in range(4, 28):
            if (x + (y // 3)) % 4 == 0:
                px(x, y, BRICK_LO)
    # sawtooth roof: three teeth, glass on the steep side
    for t in range(3):
        x0 = 4 + 8 * t
        for dx in range(8):
            top = 17 - round(dx * 5 / 7)
            for y in range(top, 17):
                px(x0 + dx, y, INK)
            if dx == 7:
                for y in range(top + 1, 17):
                    px(x0 + dx, y, GLASS)
    rect(4, 17, 27, 17, INK)
    # windows with warm light, and the gate
    for x in (6, 10, 20, 24):
        rect(x, 20, x + 1, 22, WARM)
    rect(14, 21, 17, 27, STEEL)
    rect(14, 21, 17, 21, INK)
    # ground
    rect(2, 28, 29, 28, INK)
    return im

def render(size: int, scale_of_canvas: float, path: Path, rounded: bool = False) -> None:
    base = art()
    canvas = Image.new("RGBA", (size, size), YELLOW + (255,))
    inner = round(size * scale_of_canvas)
    cell = inner // 32
    sprite = base.resize((32 * cell, 32 * cell), Image.NEAREST)
    off = ((size - 32 * cell) // 2, (size - 32 * cell) // 2)
    canvas.alpha_composite(sprite, off)
    if rounded:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=size // 5, fill=255)
        canvas.putalpha(mask)
    canvas.convert("RGBA" if rounded else "RGB").save(path)

out = Path(__file__).resolve().parent.parent / "pwa"
out.mkdir(exist_ok=True)
render(512, 1.0, out / "icon-512.png")
render(192, 1.0, out / "icon-192.png")
render(180, 1.0, out / "apple-touch-icon.png")
render(512, 0.75, out / "icon-maskable-512.png")
render(64, 1.0, out / "favicon.png", rounded=True)
print("icons written to", out)
