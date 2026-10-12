"""Remove tiny disconnected alpha fragments from the two original prop atlases."""
from pathlib import Path
from collections import deque
from PIL import Image
def clean(path):
 im=Image.open(path).convert('RGBA')
 for cy in range(4):
  for cx in range(4):
   cell=im.crop((cx*256,cy*256,(cx+1)*256,(cy+1)*256));alpha=cell.getchannel('A');values=list(alpha.getdata());seen=bytearray(65536);groups=[]
   for start in range(65536):
    if seen[start] or values[start]<40:continue
    q=deque([start]);seen[start]=1;group=[]
    while q:
     n=q.popleft();group.append(n);x=n%256;y=n//256
     for a,b in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
      if not 0<=a<256 or not 0<=b<256:continue
      j=b*256+a
      if not seen[j] and values[j]>=40:seen[j]=1;q.append(j)
    groups.append(group)
   threshold=max(40,max(map(len,groups),default=0)*.02);keep=set(n for group in groups if len(group)>=threshold for n in group)
   alpha.putdata([v if i in keep else 0 for i,v in enumerate(values)]);cell.putalpha(alpha);im.paste(cell,(cx*256,cy*256))
 im.save(path)
if __name__=='__main__':
 root=Path(__file__).resolve().parents[1]/'components/rpg_game/assets'
 for name in ('facilities','details'):clean(root/f'{name}.png')
