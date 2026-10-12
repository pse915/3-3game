from PIL import Image,ImageDraw
from pathlib import Path
import random
r=Path(__file__).resolve().parents[1]/'components/rpg_game/assets';random.seed(33)
paper=Image.new('RGBA',(128,128),'#fff9eb');d=ImageDraw.Draw(paper)
for _ in range(550):
 x=random.randrange(128);y=random.randrange(128);d.point((x,y),fill=random.choice(['#fbf3e2','#fdf7e9','#f3ead8']))
d.rectangle((2,2,125,125),outline='#ad99b2',width=2);d.rectangle((5,5,122,122),outline='#e0cfb7',width=1)
for x,y in [(10,10),(117,10),(10,117),(117,117)]:
 d.polygon([(x,y-4),(x+4,y),(x,y+4),(x-4,y)],fill='#bca7c6');d.rectangle((x-1,y-1,x+1,y+1),fill='#fff4cd')
paper.save(r/'diary-panel.png')
icons=Image.new('RGBA',(256,32));d=ImageDraw.Draw(icons)
for i in range(8):
 x=i*32;d.rounded_rectangle((x+3,3,x+28,28),radius=4,fill='#f5e7c9',outline='#9f849f',width=2)
 if i==0:d.polygon([(x+16,8),(x+23,20),(x+17,18),(x+10,23)],fill='#657f72')
 elif i==1:d.rectangle((x+9,8,x+23,24),fill='#997799');d.line((x+12,9,x+12,23),fill='#e0c89f',width=2)
 elif i==2:d.polygon([(x+8,14),(x+16,7),(x+24,14),(x+24,24),(x+8,24)],fill='#799583');d.rectangle((x+14,17,x+18,24),fill='#f4dfb5')
 else:
  for j in range(i):d.rectangle((x+7+j*3,21-j*2,x+9+j*3,24),fill='#8a9e8c')
icons.save(r/'ui-icons.png')

