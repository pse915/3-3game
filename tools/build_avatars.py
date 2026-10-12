"""Original hand-authored 32x48 pixel characters; no external game art."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib
ROOT=Path(__file__).resolve().parents[1]/'components/rpg_game/assets'
PALETTES=[('#513b36','#a66d50','#f4c8a6','#fff0d6','#775878','bob'),('#272f3d','#555d6b','#e3a984','#a8c9bb','#4c6680','pony'),('#704831','#c18b52','#c68c64','#edd3b3','#aa626b','long'),('#282d2f','#505c59','#f1c9af','#d1c2e5','#587760','short'),('#633d32','#ad7160','#a66b4e','#f2dfc4','#6f79a3','curly'),('#394539','#718061','#d9a37e','#f4c7cf','#58647e','braid')]
def sprite(a,di,fr):
 hair,highlight,skin,top,skirt,style=PALETTES[a];im=Image.new('RGBA',(32,48));d=ImageDraw.Draw(im)
 bob=[0,-1,0,-1][fr%4];stride=[0,2,0,-2][fr%4]*(1.5 if fr>3 else 1);yy=7+bob
 dark='#36323e';shadow='#aa7965';sock='#eee3d3';eye='#3a3442'
 def rect(box,c):d.rectangle(box,fill=c)
 def poly(points,c):d.polygon(points,fill=c)
 # Feet are anchored to the same floor, with four distinct gait silhouettes.
 for foot,x,off in [(0,11,int(stride)),(1,18,-int(stride))]:
  rect((x,35+off,x+3,42+off),skin);rect((x,38+off,x+3,43+off),sock);rect((x-1,43+off,x+4,45+off),dark);rect((x,43+off,x+3,43+off),'#655a65')
 # Hair behind face includes distinct silhouette for each avatar.
 poly([(8,yy+3),(10,yy),(20,yy),(24,yy+4),(24,yy+17),(21,yy+19),(9,yy+18),(7,yy+10)],hair)
 if style in ('long','braid','curly'):rect((8,yy+12,11,yy+29),hair);rect((21,yy+11,24,yy+28),hair)
 if style=='pony':poly([(21,yy+4),(27,yy+6),(28,yy+17),(25,yy+24),(22,yy+16)],hair);rect((23,yy+7,26,yy+8),'#bd8ba2')
 if style=='curly':
  for x,y in [(6,5),(5,10),(7,16),(22,3),(24,9),(23,18)]:rect((x,yy+y,x+3,yy+y+3),hair)
 # Shirt, limbs, pleated skirt, cardigan buttons, book satchel.
 poly([(11,yy+17),(20,yy+17),(23,yy+22),(22,yy+28),(10,yy+28),(8,yy+22)],dark)
 poly([(11,yy+18),(19,yy+18),(22,yy+22),(21,yy+29),(10,yy+29),(9,yy+22)],top)
 rect((12,yy+19,13,yy+27),'#ffffe5');rect((18,yy+20,19,yy+27),'#b59a93')
 rect((15,yy+20,16,yy+21),dark);rect((16,yy+24,16,yy+25),dark)
 for x,o in [(7,-int(stride/2)),(22,int(stride/2))]:rect((x,yy+22+o,x+3,yy+27+o),top);rect((x,yy+28+o,x+3,yy+30+o),skin)
 poly([(11,yy+27),(20,yy+27),(23,yy+35),(8,yy+35)],dark)
 poly([(11,yy+28),(20,yy+28),(22,yy+34),(9,yy+34)],skirt)
 for x in [12,16,20]:rect((x,yy+29,x,yy+33),'#b79aa6')
 if di!=3:poly([(10,yy+18),(12,yy+18),(22,yy+28),(21,yy+29)],'#6b968b');rect((21,yy+27,25,yy+33),'#8abbab');rect((22,yy+28,24,yy+28),'#c9e0c7')
 # Direction-specific head: profile and back are actual redrawn views.
 if di in (1,2):
  mirror=di==2;cx=11 if di==1 else 18
  rect((cx,yy+6,cx+6,yy+15),skin);rect((cx-1 if di==1 else cx+6,yy+10,cx if di==1 else cx+7,yy+12),skin)
  rect((cx+1 if di==1 else cx+4,yy+9,cx+1 if di==1 else cx+4,yy+10),eye)
  rect((cx+2,yy+14,cx+4,yy+14),shadow);poly([(8,yy+4),(12,yy+1),(21,yy+3),(23,yy+8),(18,yy+8),(15,yy+5),(9,yy+7)],hair)
  rect((13,yy+2,18,yy+3),highlight);rect((18 if di==1 else 9,yy+8,22 if di==1 else 13,yy+16),hair)
 elif di==3:
  poly([(8,yy+5),(11,yy+1),(20,yy+1),(24,yy+5),(23,yy+17),(10,yy+18),(8,yy+13)],hair)
  rect((11,yy+3,18,yy+3),highlight);rect((10,yy+4,12,yy+9),highlight);rect((12,yy+16,20,yy+17),highlight)
  rect((12,yy+19,20,yy+27),'#97b7a7');rect((13,yy+20,19,yy+21),'#c7d6b8');rect((14,yy+24,18,yy+26),'#6b968b')
 else:
  poly([(10,yy+6),(21,yy+6),(22,yy+11),(20,yy+16),(12,yy+16),(9,yy+11)],skin)
  rect((10,yy+12,12,yy+13),'#df9f8f');rect((20,yy+12,21,yy+13),'#df9f8f')
  rect((12,yy+9,13,yy+11),eye);rect((18,yy+9,19,yy+11),eye);rect((12,yy+9,12,yy+9),'#fff4d9');rect((18,yy+9,18,yy+9),'#fff4d9')
  rect((15,yy+14,17,yy+14),shadow)
  poly([(8,yy+5),(11,yy+1),(20,yy+1),(23,yy+5),(22,yy+8),(19,yy+7),(17,yy+4),(14,yy+8),(10,yy+7),(9,yy+14),(7,yy+12)],hair)
  rect((11,yy+2,18,yy+2),highlight);rect((10,yy+3,12,yy+4),highlight)
 if style=='braid':
  for y in range(yy+14,yy+26,3):rect((22,y,24,y+2),highlight)
  rect((22,yy+26,24,yy+27),'#d29bab')
 if style=='short':rect((8,yy+13,10,yy+17),top)
 return im
sheet=Image.new('RGBA',(256,192*len(PALETTES)))
for a in range(len(PALETTES)):
 for di in range(4):
  for fr in range(8):sheet.alpha_composite(sprite(a,di,fr),(32*fr,a*192+di*48))
sheet.save(ROOT/'avatars.png');sheet.crop((0,0,256,192)).save(ROOT/'characters.png')
preview=sheet.resize((768,3456),Image.Resampling.NEAREST);preview.save(ROOT/'avatars-preview.png')
meta={'file':'avatars.png','originalAuthoring':'tools/build_avatars.py','avatars':6,'frame':[32,48],'columns':8,'directionRows':['down','left','right','up'],'avatarHeight':192,'walkFrames':[0,1,2,3],'runFrames':[4,5,6,7],'styles':[p[-1] for p in PALETTES],'variants':'distinct hairstyle, skin, clothing and satchel; no hue rotation','sha256':hashlib.sha256((ROOT/'avatars.png').read_bytes()).hexdigest()}
(ROOT/'avatars.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
print('Created six original avatars, 192 frames')
