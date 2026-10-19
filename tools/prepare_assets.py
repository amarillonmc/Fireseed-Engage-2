from PIL import Image, ImageDraw, ImageFilter, ImageChops
import os, math, random

ROOT = r'D:/Github/Fireseed_Engage_2'
JEWEL = r'D:/Github/jewel-s-free101j/image/character'
OUT = ROOT + '/public/assets/generals'
BG = ROOT + '/public/assets/bg'
os.makedirs(OUT, exist_ok=True)

ELEM = {
    'lumen': ((223, 246, 255), (64, 224, 255)),
    'ember': ((255, 160, 90), (255, 60, 40)),
    'cryo': ((160, 220, 255), (40, 130, 255)),
    'bloom': ((160, 255, 190), (30, 200, 110)),
    'radiance': ((255, 240, 160), (255, 170, 30)),
    'umbra': ((200, 160, 255), (110, 60, 220)),
}

cards = [
    (189, 'f124', 'umbra'), (240, 'f364', 'ember'), (275, 'f068', 'lumen'), (256, 'f335', 'cryo'),
    (200, 'f228', 'ember'), (205, 'f090', 'umbra'), (308, 'f214', 'radiance'), (223, 'f134', 'bloom'),
    (316, 'f370', 'cryo'), (387, 'f122', 'radiance'), (274, 'f067', 'lumen'), (292, 'f125', 'cryo'),
    (294, 'f101', 'lumen'), (307, 'f213', 'radiance'), (341, 'f211', 'bloom'), (132, 'f128', 'bloom'),
    (401, 'f242', 'bloom'), (394, 'f245', 'ember'), (140, 'f178', 'umbra'), (151, 'f078', 'ember'),
    (192, 'f150', 'radiance'), (202, 'f303', 'bloom'), (326, 'f004', 'ember'), (287, 'f086', 'cryo'),
]

W, H = 600, 800

def make_jewel(card_id, image_id, element):
    src = Image.open(f'{JEWEL}/{image_id}.png').convert('RGBA')
    bbox = src.getbbox()
    if bbox:
        src = src.crop(bbox)
    # background
    base = Image.new('RGB', (W, H), (7, 12, 18))
    draw = ImageDraw.Draw(base)
    light, accent = ELEM[element]
    # vertical gradient
    for y in range(H):
        t = y / H
        r = int(6 + 10 * (1 - t)); g = int(11 + 16 * (1 - t)); b = int(18 + 22 * (1 - t))
        draw.line([(0, y), (W, y)], fill=(r, g, b))
    # radial glow
    glow = Image.new('RGB', (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy = W // 2, int(H * 0.55)
    for i in range(18, 0, -1):
        rad = int(60 + i * 22)
        a = int(5 + (18 - i) * 2.4)
        gd.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=tuple(int(c * a / 80) for c in accent))
    glow = glow.filter(ImageFilter.GaussianBlur(46))
    base = ImageChops.add(base, glow)
    # grid
    draw = ImageDraw.Draw(base, 'RGBA')
    for x in range(0, W, 30):
        draw.line([(x, 0), (x, H)], fill=(90, 200, 220, 16), width=1)
    for y in range(0, H, 30):
        draw.line([(0, y), (W, y)], fill=(90, 200, 220, 12), width=1)
    # diagonal warning strips
    for off in range(-H, W + H, 90):
        draw.line([(off, H), (off + H, 0)], fill=(255, 255, 255, 8), width=2)
    # scanlines
    for y in range(0, H, 3):
        draw.line([(0, y), (W, y)], fill=(0, 0, 0, 28), width=1)
    # place character
    src.thumbnail((int(W * 0.96), int(H * 0.96)), Image.LANCZOS)
    char = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    x = (W - src.width) // 2
    y = H - src.height - 4
    char.alpha_composite(src, (x, y))
    base = Image.alpha_composite(base.convert('RGBA'), char)
    # rim light: duplicate alpha shifted and tinted
    alpha = char.split()[3]
    rim = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    tint = Image.new('RGBA', (W, H), (*accent, 0))
    tint.putalpha(alpha.filter(ImageFilter.MaxFilter(3)))
    rim = Image.alpha_composite(rim, tint)
    rim = rim.filter(ImageFilter.GaussianBlur(4))
    base = Image.alpha_composite(rim, base)
    # vignette
    vig = Image.new('L', (W, H), 0)
    vd = ImageDraw.Draw(vig)
    vd.ellipse([-W * 0.25, -H * 0.15, W * 1.25, H * 1.15], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(120))
    black = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    base = Image.composite(base, black, vig)
    # bottom fade for name plate
    fade = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fade)
    for i in range(150):
        a = int(190 * (i / 150) ** 1.8)
        fd.line([(0, H - 150 + i), (W, H - 150 + i)], fill=(2, 6, 10, a))
    base = Image.alpha_composite(base, fade)
    base.convert('RGB').save(f'{OUT}/jewel_{card_id}.webp', 'WEBP', quality=88, method=5)

for c in cards:
    make_jewel(*c)
    print('jewel', c[0])

for p in ['kf_2','kf_3','kf_4','kf_7','kf_8','kf_9','kf_13','kf_14','kf_16','kf_24','kf_25','kf_53']:
    im = Image.open(f'{OUT}/{p}.png').convert('RGB')
    im.save(f'{OUT}/{p}.webp', 'WEBP', quality=88, method=5)
    print('kf', p)

for name, quality in [('hero', 90), ('city', 89), ('bore', 89)]:
    im = Image.open(f'{BG}/{name}.png').convert('RGB')
    im.save(f'{BG}/{name}.webp', 'WEBP', quality=quality, method=6)
    print('bg', name, im.size)

# contact sheet of processed jewel cards
cols, cw, ch = 6, 200, 300
sel = cards
rows = (len(sel) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cw, rows * ch), (8, 12, 18))
from PIL import ImageFont
font = ImageFont.truetype(r'C:/Windows/Fonts/YuGothB.ttc', 18)
d = ImageDraw.Draw(sheet)
for i, (cid, _, el) in enumerate(sel):
    im = Image.open(f'{OUT}/jewel_{cid}.webp').convert('RGB')
    im.thumbnail((cw - 8, ch - 28))
    x = (i % cols) * cw; y = (i // cols) * ch
    sheet.paste(im, (x + 4, y + 4))
    d.text((x + 6, y + ch - 24), f'{cid} {el}', fill=(220, 240, 250), font=font)
sheet.save(ROOT + '/refshots/jewel_processed.jpg', quality=88)
print('sheet', sheet.size)
