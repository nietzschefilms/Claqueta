# Genera íconos provisionales (una letra sobre el color del tema).
# Uso: npm run iconos  → luego reemplázalos por los del cliente cuando los tengas.
# Tamaños: icon-192, icon-512, maskable-512 (con margen) y apple-touch-icon (180).
import re, pathlib
from PIL import Image, ImageDraw, ImageFont

raiz = pathlib.Path(__file__).resolve().parent.parent
marca = (raiz / "src/config/marca.ts").read_text(encoding="utf-8")
color = re.search(r'colorTema:\s*"(#[0-9A-Fa-f]{6})"', marca).group(1)
nombre = re.search(r'nombreCorto:\s*"([^"]+)"', marca).group(1)
letra = nombre.strip()[0].upper()

def fuente(tam):
    for f in ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
        try:
            return ImageFont.truetype(f, tam)
        except OSError:
            pass
    return ImageFont.load_default()

def icono(tam, escala_letra, ruta):
    img = Image.new("RGB", (tam, tam), color)
    d = ImageDraw.Draw(img)
    f = fuente(int(tam * escala_letra))
    x0, y0, x1, y1 = d.textbbox((0, 0), letra, font=f)
    d.text(((tam - (x1 - x0)) / 2 - x0, (tam - (y1 - y0)) / 2 - y0), letra, fill="white", font=f)
    img.save(raiz / "public/icons" / ruta)

icono(192, 0.55, "icon-192.png")
icono(512, 0.55, "icon-512.png")
icono(512, 0.40, "maskable-512.png")
icono(180, 0.55, "apple-touch-icon.png")
print(f"Íconos generados con la letra {letra} sobre {color}")
