from pathlib import Path
from PIL import Image

root = Path('/home/ubuntu/memvo/assets/images')
files = [
    'icon.png',
    'favicon.png',
    'splash-icon.png',
    'android-icon-foreground.png',
]

sizes = {
    'icon.png': (1024, 1024),
    'favicon.png': (256, 256),
    'splash-icon.png': (1024, 1024),
    'android-icon-foreground.png': (432, 432),
}

for name in files:
    path = root / name
    image = Image.open(path).convert('RGBA')
    target_size = sizes[name]
    image = image.resize(target_size, Image.LANCZOS)
    image.save(path, format='PNG', optimize=True)
