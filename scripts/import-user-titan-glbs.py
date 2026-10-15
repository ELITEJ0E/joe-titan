"""Build the user's six uploaded, untextured Meshy GLBs into vertex-colored runtime GLBs.
The meshes contain no UVs, materials, bones or animations. This builds visible
colors without pretending to recover the fine textures from reference renders.
Runtime skinning and animation are applied by src/titan-glb-models.js."""
from pathlib import Path
import urllib.request
import numpy as np
import trimesh

SOURCE = {
 'armored': 'https://d2ol7oe51mr4n9.cloudfront.net/user_34QjeOFhUZCLT9wZ4vgB98VZeog/f6380f04-20d7-4958-9893-7c4b9215ab95.glb',
 'attack': 'https://d2ol7oe51mr4n9.cloudfront.net/user_34QjeOFhUZCLT9wZ4vgB98VZeog/9df3c7ab-d921-4db1-a3fc-e1d678200a51.glb',
 'beast': 'https://d2ol7oe51mr4n9.cloudfront.net/user_34QjeOFhUZCLT9wZ4vgB98VZeog/f8005d40-1a92-4878-b916-ae5ac8fa8fcd.glb',
 'colossal': 'https://d2ol7oe51mr4n9.cloudfront.net/user_34QjeOFhUZCLT9wZ4vgB98VZeog/385dee3e-be8c-4b1e-ac3e-6759d6658090.glb',
 'female': 'https://d2ol7oe51mr4n9.cloudfront.net/user_34QjeOFhUZCLT9wZ4vgB98VZeog/6c94279e-046a-4420-b3f6-ec50c13a918c.glb',
 'founding': 'https://d2ol7oe51mr4n9.cloudfront.net/user_34QjeOFhUZCLT9wZ4vgB98VZeog/35424a6e-199f-40dd-8c44-f2358c650a53.glb',
}
OUT = Path('public/models/titans')
OUT.mkdir(parents=True, exist_ok=True)
PALETTES = {
 'armored': ((205,171,128),(119,50,49),(80,59,47)),
 'attack': ((207,159,125),(133,55,55),(53,38,32)),
 'beast': ((102,74,52),(196,162,130),(61,43,31)),
 'colossal': ((179,69,57),(224,187,146),(113,34,34)),
 'female': ((208,158,130),(150,66,62),(192,155,89)),
 'founding': ((202,179,143),(134,57,53),(64,42,37)),
}
def bake(kind):
 path=OUT/(kind+'_titan.glb')
 source=path.with_suffix('.original.glb')
 urllib.request.urlretrieve(SOURCE[kind],source)
 scene=trimesh.load(source,force='scene',process=False)
 mesh=trimesh.util.concatenate(list(scene.geometry.values()))
 v=np.asarray(mesh.vertices,dtype=np.float64)
 n=np.asarray(mesh.vertex_normals)
 lo,hi=v.min(axis=0),v.max(axis=0)
 z=(v[:,1]-lo[1])/max(1e-6,hi[1]-lo[1])
 x=np.abs(v[:,0])/max(1e-6,(hi[0]-lo[0])*.5)
 front=np.clip(((-n[:,2])+.15)*.9,0,1)
 base,secondary,deep=PALETTES[kind]
 colors=np.tile(np.asarray(base,dtype=float),(len(v),1))
 def mix(mask,color):
  nonlocal colors
  mask=np.asarray(mask,dtype=bool)
  colors[mask]=np.asarray(color,dtype=float)
 if kind=='armored':
  mix((z>.23)&(z<.84)&(x<.39)&(front>.5),base)
  mix((z>.19)&(z<.85)&(x>.4),secondary)
  mix((z>.24)&(z<.76)&(front<.29),secondary)
  mix((z>.89),base)
 elif kind=='attack':
  mix((z>.40)&(z<.78)&(x<.25),secondary)
  mix((z>.81)&(front<.15),deep)
  mix((z>.84)&(x>.25),deep)
  mix((z>.16)&(z<.72)&(x>.52),secondary)
 elif kind=='beast':
  mix((z>.53)&(z<.84)&(x<.35)&(front>.40),secondary)
  mix((z>.80)&(x<.21)&(front>.5),secondary)
  mix((z>.83)&(front<.2),deep)
 elif kind=='colossal':
  mix((z>.24)&(z<.81)&(front>.67)&(x<.17),secondary)
  mix((z>.87)&(front>.55),secondary)
 elif kind=='female':
  mix((z>.36)&(z<.78)&(front>.5)&(x>.18),secondary)
  mix((z>.83)&(front<.20),deep)
 elif kind=='founding':
  mix((z>.2)&(z<.83)&(x<.30)&(front>.46),secondary)
  mix((z>.82)&(front<.35),deep)
 # Faceted material response, consistent with the user's voxel reference images.
 light=np.clip(.78+.21*np.clip(n[:,1],-1,1)+.10*front,.58,1.05)
 colors=np.clip(colors*light[:,None],0,255).astype(np.uint8)
 mesh.visual.vertex_colors=np.column_stack((colors,np.full(len(v),255,dtype=np.uint8)))
 glb=trimesh.Scene(mesh).export(file_type='glb',include_normals=True)
 path.write_bytes(glb)
 assert len(trimesh.load(path,force='mesh').faces)>5000
 print(kind,len(mesh.vertices),len(mesh.faces),len(glb))
 source.unlink()
for kind in SOURCE:bake(kind)
