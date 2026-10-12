"""Rebuild game sheets from included AI originals. Pillow only; no API required."""
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]/'components/rpg_game/assets'
for name in ['environment','buildings','furniture','facilities','details']:
    Image.open(ROOT/f'{name}-source.png').convert('RGBA').resize((1024,1024),Image.Resampling.NEAREST).save(ROOT/f'{name}.png')
im=Image.open(ROOT/'characters-source.png').convert('RGBA');sheet=Image.new('RGBA',(256,192))
for y in range(4):
    for x in range(8):
        cell=im.crop((round(x*im.width/8),round(y*im.height/4),round((x+1)*im.width/8),round((y+1)*im.height/4)))
        box=cell.getchannel('A').point(lambda a:255 if a>128 else 0).getbbox()
        if box:
            cell=cell.crop(box);cell.thumbnail((28,44),Image.Resampling.NEAREST);sheet.alpha_composite(cell,(x*32+(32-cell.width)//2,y*48+46-cell.height))
sheet.save(ROOT/'characters.png')
im=Image.open(ROOT/'npcs-source.png').convert('RGBA');sheet=Image.new('RGBA',(224,240));portraits=Image.new('RGBA',(672,480));rows=[0,207,410,611,808,982]
for y in range(5):
    for x in range(7):
        cell=im.crop((round(x*im.width/7),rows[y],round((x+1)*im.width/7),rows[y+1]));box=cell.getchannel('A').point(lambda a:255 if a>128 else 0).getbbox()
        if box:
            cell=cell.crop(box);face=cell.crop((0,0,cell.width,min(cell.height,cell.width)));face.thumbnail((90,90),Image.Resampling.NEAREST);portraits.alpha_composite(face,(x*96+(96-face.width)//2,y*96+96-face.height));cell.thumbnail((30,46),Image.Resampling.NEAREST);sheet.alpha_composite(cell,(x*32+(32-cell.width)//2,y*48+47-cell.height))
sheet.save(ROOT/'npcs.png');portraits.save(ROOT/'portraits.png')
im=Image.open(ROOT/'school-source.png').convert('RGBA');box=im.getchannel('A').point(lambda a:255 if a>128 else 0).getbbox();im.crop(box).resize((864,448),Image.Resampling.NEAREST).save(ROOT/'school.png')
print('Normalized original sources into production sheets')

from clean_atlas import clean
for name in ('facilities','details'):clean(ROOT/f'{name}.png')
