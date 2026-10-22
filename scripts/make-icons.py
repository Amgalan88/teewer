"""public/icon.svg-тэй ижил «T.» дүрсийг PNG/ICO болгон үүсгэнэ (iPhone, Android, хөтчийн таб, мэдэгдэл).

    python scripts/make-icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public"
RUST, WHITE, DOT = (194, 65, 12), (255, 255, 255), (254, 215, 170)
T_SHAPE = [(15, 14), (49, 14), (49, 24), (37, 24), (37, 52), (27, 52), (27, 24), (15, 24)]


def draw(size, rounded=True, bg=RUST, fg=WHITE, dot=DOT, transparent_bg=False):
    s = 1024 / 64  # 64 нэгжийн зургийг 1024 px дээр зурж багасгана (гөлгөр ирмэг)
    im = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if not transparent_bg:
        if rounded:
            d.rounded_rectangle([0, 0, 1023, 1023], radius=int(15 * s), fill=bg)
        else:
            d.rectangle([0, 0, 1023, 1023], fill=bg)
    d.polygon([(x * s, y * s) for x, y in T_SHAPE], fill=fg)
    d.ellipse([(46 - 4.5) * s, (48 - 4.5) * s, (46 + 4.5) * s, (48 + 4.5) * s], fill=dot)
    return im.resize((size, size), Image.LANCZOS)


draw(192).save(OUT / "icon-192.png")
draw(512).save(OUT / "icon-512.png")
# Android «maskable»: систем өөрөө хэлбэр тайрдаг тул булангүй, бүтэн дэвсгэртэй
draw(512, rounded=False).save(OUT / "icon-maskable-512.png")
# iPhone: булангүй, тунгалаг биш (iOS өөрөө булан бөөрөнхийлнө)
draw(180, rounded=False).convert("RGB").save(OUT / "apple-touch-icon.png")
draw(32).save(OUT / "favicon-32.png")
draw(48).save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
# Android мэдэгдлийн жижиг тэмдэг: зөвхөн цагаан дүрс, тунгалаг дэвсгэр
draw(96, transparent_bg=True, dot=WHITE).save(OUT / "badge-96.png")
print("icons written to", OUT)
