"""Подложка Android-приложения: главный экран СберKids из PDF-брифа организаторов.

Берёт скриншот экрана со страницы 3, отрезает статус-бар и индикатор «домой»,
увеличивает в 3 раза с резкостью и сохраняет в web/overlay/underlay.webp.
Координаты зон в web/overlay/layout.json — в пикселях картинки до увеличения (394 × 996).

    pip install pymupdf pillow
    python -I tools/gen_underlay.py "СБЕРKIDS.pdf" web/overlay/underlay.webp
"""
import io
import sys

import pymupdf
from PIL import Image, ImageFilter

PAGE = 2          # страница 3: «СберKids» с телефоном
CROP_TOP = 34     # статус-бар (время, Wi-Fi, заряд)
CROP_BOTTOM = 1030  # ниже — индикатор «домой»
UPSCALE = 3


def main(pdf_path, out_path):
    doc = pymupdf.open(pdf_path)
    page = doc[PAGE]
    # Скриншот экрана — самая высокая картинка на странице (394 × 1059)
    shots = []
    for info in page.get_images(full=True):
        pix = pymupdf.Pixmap(doc, info[0])
        if pix.height > pix.width * 2:
            shots.append(pix)
    if not shots:
        sys.exit('На странице нет скриншота экрана')
    pix = max(shots, key=lambda p: p.height)
    if pix.n - pix.alpha >= 4:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    image = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB')
    image = image.crop((0, CROP_TOP, image.width, CROP_BOTTOM))
    big = image.resize((image.width * UPSCALE, image.height * UPSCALE), Image.LANCZOS)
    big = big.filter(ImageFilter.UnsharpMask(radius=2, percent=80, threshold=2))
    big.save(out_path, 'WEBP', quality=90, method=6)
    print(out_path, image.size, '→', big.size)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
