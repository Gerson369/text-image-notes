"""Compose complete 3:4 cards with gutters, borders and soft external shadows."""
import argparse
import math
from pathlib import Path
import re

from PIL import Image, ImageDraw, ImageFilter, ImageOps


def natural_key(path):
    return [int(part) if part.isdigit() else part.casefold() for part in re.split(r'(\d+)', path.name)]


def compose_sheet(folder, output):
    folder, output = Path(folder).resolve(), Path(output).resolve()
    if not folder.is_dir():
        raise ValueError(f'Card folder does not exist: {folder}')
    if output.parent == folder:
        raise ValueError('Place the sheet outside the single-card folder to avoid reimporting it.')
    files = sorted((path for path in folder.iterdir() if path.is_file() and path.suffix.lower() in ('.png', '.jpg', '.jpeg')), key=natural_key)
    if not files:
        raise ValueError('No card images found.')
    width, height, gap, margin = 360, 480, 24, 32
    columns = min(3, len(files))
    rows = math.ceil(len(files) / columns)
    canvas_size = (columns * width + (columns - 1) * gap + margin * 2, rows * height + (rows - 1) * gap + margin * 2)
    sheet = Image.new('RGB', canvas_size, '#eceef1')
    for index, path in enumerate(files):
        with Image.open(path) as original:
            image = ImageOps.exif_transpose(original).convert('RGB')
            if image.width * 4 != image.height * 3:
                raise ValueError(f'Rotated card is not 3:4: {path.name}')
            image = image.resize((width, height), Image.Resampling.LANCZOS)
        x = margin + (index % columns) * (width + gap)
        y = margin + (index // columns) * (height + gap)
        # Keep the blur within a local tile so cost grows with cards, not sheet area squared.
        shadow = Image.new('L', (width + 32, height + 32), 0)
        shadow.paste(30, (16, 20, 16 + width, 20 + height))
        shadow = shadow.filter(ImageFilter.GaussianBlur(7))
        sheet.paste('#151b25', (x - 16, y - 16, x + width + 16, y + height + 16), shadow)
        ImageDraw.Draw(image).rectangle((0, 0, width - 1, height - 1), outline='#c5cad0', width=1)
        sheet.paste(image, (x, y))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)
    return {'cards': [path.name for path in files], 'size': list(canvas_size), 'output': str(output)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cards')
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    try:
        result = compose_sheet(args.cards, args.out)
    except (OSError, ValueError) as error:
        parser.exit(1, f'{error}\n')
    print(result)


if __name__ == '__main__':
    main()
