"""Build seven stylized, unrigged 3D Titan reference approximations with embedded PBR textures.
Hand-authored geometry; not an AI image-to-3D reconstruction.
"""
from __future__ import annotations
import math, os, random, zipfile, json
from collections import defaultdict
from pathlib import Path
import numpy as np
from PIL import Image
import trimesh
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial

OUT=Path(os.environ.get('TITAN_ASSET_DIR','public/models/titans')); OUT.mkdir(parents=True,exist_ok=True)
R=random.Random(777)
C={
'muscle':(135,49,42), 'muscle_light':(172,73,54),'muscle_dark':(97,34,31),
'bone':(206,159,113),'bone_light':(235,192,149),'bone_dark':(169,118,83),
'skin':(212,170,134),'skin_light':(235,199,160),'skin_shadow':(143,88,66),
'blonde':(195,157,96),'blonde_light':(225,186,121),'blonde_dark':(141,107,62),
'fur':(89,57,39),'fur_light':(114,75,50),'fur_dark':(58,39,33),'beard':(68,45,36),
'white':(224,221,205),'white_light':(245,240,225),'white_dark':(172,165,154),
'blackhair':(41,35,33),'brown_hair':(65,42,34),'black':(30,25,26),
'eye':(228,189,69),'blue_eye':(103,162,180),'green_eye':(53,133,101),
'red_eye':(142,49,44),'teeth':(222,199,164),'wood':(97,68,48),'wood_light':(133,98,68),
'metal':(48,47,43),'belt':(59,45,41),'shadow':(64,35,31),
}

# Define unique organic surface textures, metallic-roughness maps and tangent normal textures.
def make_pbr(name, seed):
    rgb=np.asarray(C[name],dtype=np.float32)
    rng=np.random.default_rng(seed)
    n=128
    y,x=np.indices((n,n))
    noise=rng.normal(0,3.7,(n,n))+2.9*np.sin(x/14)*np.sin(y/19)
    pixelated=rng.normal(0,2.7,(16,16)).repeat(8,axis=0).repeat(8,axis=1)
    grain=(noise+pixelated)[:,:,None]
    base=np.clip(rgb[None,None,:]+grain,0,255).astype('uint8')
    baseimg=Image.fromarray(base,'RGB')
    mr=np.empty((n,n,3),dtype='uint8'); mr[:,:,:]=[0,214,3] # G roughness, B metallic
    mr[:,:,1]=np.clip(203+noise*0.65,0,255).astype('uint8')
    if name=='metal': mr[:,:,2]=90; mr[:,:,1]=145
    normal=np.empty((n,n,3),dtype='uint8'); normal[:,:,:]=[128,128,255]
    rough=0.78 if name not in ('metal','eye','blue_eye','green_eye','red_eye') else 0.45
    return PBRMaterial(name=name,baseColorFactor=[255,255,255,255],baseColorTexture=baseimg,
                       metallicRoughnessTexture=Image.fromarray(mr,'RGB'),normalTexture=Image.fromarray(normal,'RGB'),
                       metallicFactor=0.22 if name=='metal' else 0.0,roughnessFactor=rough,doubleSided=True)

base_mats={key:make_pbr(key,i*17+7) for i,key in enumerate(C)}

def vec(x):return np.asarray(x,float)

def norm(v):
    v=vec(v);length=np.linalg.norm(v);return v/max(length,1e-10)

def frame(a,b):
    d=vec(b)-vec(a); h=np.linalg.norm(d)
    if h<1e-5:return np.eye(4),0
    xf=trimesh.geometry.align_vectors([0,0,1],d)
    xf[:3,3]=(vec(a)+vec(b))*0.5
    return xf,h

class Titan:
    def __init__(self,name,seed=0):self.name=name;self.data=defaultdict(list);self.rng=random.Random(seed)
    def add(self,mesh,material):
        if mesh is None or len(mesh.vertices)==0:return
        self.data[material].append(mesh)
    def blob(self,loc,scale,mat,sub=1,angle=0):
        m=trimesh.creation.icosphere(subdivisions=sub,radius=1)
        m.apply_scale(scale)
        if angle: m.apply_transform(trimesh.transformations.rotation_matrix(angle,[0,1,0]))
        m.apply_translation(loc)
        self.add(m,mat)
    def cube(self,loc,scale,mat,rotation=None):
        m=trimesh.creation.box(extents=scale)
        if rotation is not None:
            a,axis=rotation
            m.apply_transform(trimesh.transformations.rotation_matrix(a,axis))
        m.apply_translation(loc)
        self.add(m,mat)
    def rod(self,a,b,rad,mat,sections=7,rad2=None):
        if np.linalg.norm(vec(b)-vec(a))<1e-5:return
        if rad2 is not None and abs(rad-rad2)>0.002:
            m=trimesh.creation.conical_frustum(height=np.linalg.norm(vec(b)-vec(a)),radius_top=rad2,radius_base=rad,sections=sections) if hasattr(trimesh.creation,'conical_frustum') else None
            if m is None: m=trimesh.creation.cylinder(radius=(rad+rad2)*.5,height=np.linalg.norm(vec(b)-vec(a)),sections=sections)
        else:m=trimesh.creation.cylinder(radius=rad,height=np.linalg.norm(vec(b)-vec(a)),sections=sections)
        tf,_=frame(a,b);m.apply_transform(tf);self.add(m,mat)
    def beam(self,a,b,width,depth,mat):
        xf,h=frame(a,b)
        m=trimesh.creation.box(extents=[width,depth,h]);m.apply_transform(xf);self.add(m,mat)
    def cord(self,pts,rad,mat,sections=6):
        for p,q in zip(pts[:-1],pts[1:]):self.rod(p,q,rad,mat,sections)
    def pointed(self,a,b,rad,mat):
        dist=np.linalg.norm(vec(a)-vec(b));
        if dist<1e-5:return
        m=trimesh.creation.cone(radius=rad,height=dist,sections=5)
        tf,_=frame(a,b);m.apply_transform(tf)
        # cone extends from z=0 to height, centered correction
        m.apply_translation(-(vec(b)-vec(a))*.5)
        self.add(m,mat)
    def fingers(self,side,hand,scale=1,mat='bone'):
        h=vec(hand)
        self.blob(h,[.16*scale,.12*scale,.19*scale],'muscle_dark',1)
        for i in range(4):
            start=h+np.array([side*(i-1.5)*.075*scale,-.03*scale,-.08*scale])
            finish=start+np.array([side*(i-1.5)*.012,-.065*scale,-.19*scale])
            self.beam(start,finish,.055*scale,.060*scale,mat)
            self.blob(finish,[.042*scale,.045*scale,.045*scale],mat)
        a=h+np.array([-side*.12,-.08,0]);b=a+np.array([-side*.11,-.02,-.12]);self.beam(a,b,.065,.07,mat)
    def eyes(self,z=4.27, y=-.315,spacing=.16,eye='eye',size=.07):
        for s in [-1,1]:
            self.blob([s*spacing,y,z],[size*1.12,.047,size*.68],'black',1)
            self.blob([s*spacing,y-.040,z],[size*.53,.023,size*.52],eye,1)
    def hair_short(self,top=(0,0,4.58),base='blonde',length=.21,rows=9):
        x0,y0,z0=top
        self.blob([x0,y0,z0],[.34,.30,.22],base,1)
        for _ in range(rows*7):
            phi=self.rng.uniform(0,2*math.pi);theta=self.rng.uniform(0,math.pi*.67)
            x=x0+.33*math.cos(phi)*math.sin(theta);y=y0+.30*math.sin(phi)*math.sin(theta)
            z=z0+.20*math.cos(theta)
            self.cube([x,y,z],[.085,.078,self.rng.uniform(.09,length)],base,rotation=(self.rng.uniform(-.4,.4),[0,1,0]))
    def hair_long(self,start=(0,0,4.55),mat='blackhair',length=.75,num=32,width=.047):
        for i in range(num):
            u=(i+.5)/num*2*math.pi
            x=.31*math.cos(u);y=.23*math.sin(u)
            a=(start[0]+x,start[1]+y,start[2])
            b=(start[0]+x*1.25,start[1]+y*1.3,start[2]-length*self.rng.uniform(.65,1.2))
            self.beam(a,b,width,self.rng.uniform(.04,.08),mat)
    def humanoid(self,body='muscle',secondary='bone',tall=1,shoulder=1.0,hip=1.0,leg=1.0,arms=1.0,chest='muscle'):
        # Torso, neck, hips, shoulders
        self.blob([0,0,3.11],[.52*shoulder,.31,.88],body,sub=2)
        self.blob([0,0,2.28],[.50*hip,.30,.43],body,sub=1)
        self.rod([0,0,3.55],[0,0,4.21],.21,body)
        for s in [-1,1]:
            # pectorals, serratus, spine lines
            self.blob([s*.285,-.29,3.38],[.35,.22,.25],chest,sub=2)
            self.blob([s*.49,0,3.55],[.28*shoulder,.31,.31],body,sub=2)
            for j in range(3):
                zz=3.00-.21*j
                self.blob([s*.16,-.32,zz],[.19,.15,.115],secondary,sub=1)
            # detailed outer shoulder and scapula
            self.blob([s*.70,0,3.42],[.245*shoulder,.23,.34],body,sub=2)
            elbow=(s*.88*arms,-.04,2.48);wrist=(s*.86*arms,-.19,1.88);upper=(s*.68,0,3.28)
            self.rod(upper,elbow,.19,body)
            self.blob(elbow,[.23,.20,.24],body,1)
            self.rod(elbow,wrist,.14,body)
            self.blob([s*.88*arms,-.11,2.14],[.18,.17,.27],body,1)
            self.fingers(s,[s*.86*arms,-.19,1.75],1.0,secondary)
            # Legs with knee, foot (right leg mild outward lean)
            top=(s*.27,0,2.20);knee=(s*.35,.04,1.18);ankle=(s*.38,-.03,.27)
            self.rod(top,knee,.31*leg,body)
            self.blob([s*.31,-.04,1.75],[.32*leg,.26,.47],body,sub=2)
            self.blob(knee,[.29,.25,.28],secondary,1)
            self.rod(knee,ankle,.205,body)
            self.blob([s*.36,.0,.70],[.23,.21,.33],body,1)
            self.blob([s*.39,-.25,.13],[.21,.42,.13],secondary,1)
            for i in range(4):
                self.cube([s*.39+(i-1.5)*.09,-.48,.08],[.075,.23,.11],secondary)
        # segmented abdominal muscles front
        for j in range(5):
            for s in [-1,1]:
                self.blob([s*.125,-.36,3.00-j*.165],[.13,.13,.085],secondary,1)
        return self
    def export(self,path):
        scene=trimesh.Scene()
        for kind,meshes in self.data.items():
            if not meshes:continue
            # Single mesh per material produces portable & relatively lightweight GLBs.
            mesh=trimesh.util.concatenate(meshes)
            vertices=mesh.vertices
            # Fractal-like tile repetition per surface projects geometry into 2D texture.
            uv=np.column_stack([(vertices[:,0]*.67+vertices[:,1]*.34)%1.0,(vertices[:,2]*.49+vertices[:,1]*.22)%1.0])
            mesh.visual=TextureVisuals(uv=uv,material=base_mats[kind])
            scene.add_geometry(mesh,node_name=kind,geom_name=kind)
        scene.metadata['title']=self.name
        scene.metadata['authoring']='Procedural approximations based on single 2D reference; static, not rigged'
        scene.export(str(path),file_type='glb')
        return {'file':path.name,'bytes':path.stat().st_size,'triangles':sum(len(x.faces) for x in scene.geometry.values()),'meshes':len(scene.geometry),'materials':list(self.data.keys())}

# 1 Armored Titan
T=Titan('Armored Titan',100).humanoid(shoulder=1.20,chest='bone',secondary='bone',leg=1.08)
T.blob([0,0,4.32],[.32,.255,.40],'bone',sub=2)
T.blob([0,-.195,4.10],[.24,.13,.20],'bone_dark',1)
T.eyes(z=4.42,spacing=.15,y=-.28,eye='eye')
T.hair_short(top=(0,.01,4.65),base='blonde_light',rows=11)
for s in [-1,1]:
    for p,scale in [([s*.73,-.20,3.48],[.31,.23,.36]),([s*.64,-.22,2.95],[.22,.19,.28]),
                    ([s*.88,-.24,2.30],[.18,.16,.36]),([s*.33,-.27,1.79],[.27,.17,.40]),
                    ([s*.37,-.27,.77],[.23,.21,.34]),([s*.36,-.22,1.21],[.23,.22,.25])]:
        T.blob(p,scale,'bone_light',2)
    for j in range(3):
        T.beam([s*.43,-.31,3.10-j*.23],[s*.60,-.24,3.19-j*.23],.11,.095,'bone_dark')
    for j in range(3):
        T.beam([s*.63,-.29,2.62-j*.2],[s*.70,-.24,2.72-j*.20],.075,.065,'bone')
for j in range(3):T.blob([0,-.43,3.02-j*.18],[.21,.145,.096],'bone_light',1)
T.blob([0,-.37,2.19],[.31,.19,.26],'bone',1)
armored=T.export(OUT/'armored_titan.glb')

# 2 Colossal Titan
T=Titan('Colossal Titan',200).humanoid(shoulder=1.24,chest='muscle_light',secondary='bone_light',leg=1.02)
T.blob([0,0,4.36],[.33,.245,.41],'skin',2)
T.blob([0,-.18,4.20],[.245,.125,.16],'muscle_dark',1)
T.eyes(z=4.42,spacing=.155,y=-.245,eye='black',size=.067)
for s in [-1,1]:
    T.blob([s*.29,-.31,3.40],[.31,.14,.20],'muscle_light',1)
    T.rod([s*.16,-.05,4.15],[s*.52,-.07,3.66],.072,'muscle_light',5)
    for j in range(4):
        a=[s*.26,-.31,3.21-j*.21];b=[s*.52,-.25,3.24-j*.20]
        T.beam(a,b,.06,.055,'bone')
    for j in range(4):
        T.beam([s*.26,-.30,1.84-j*.19],[s*.30,-.33,2.05-j*.19],.055,.06,'muscle_light')
    for j in range(4):
        T.beam([s*.78,-.19,3.26-j*.17],[s*.87,-.23,3.29-j*.17],.055,.06,'bone')
for j in range(6):T.beam([0,-.45,3.27-j*.145],[0,-.47,3.30-j*.145],.32,.05,'bone_dark')
for j in range(7):T.cube([(j-3)*.076,-.302,4.155],[.055,.04,.088],'teeth')
colossal=T.export(OUT/'colossal_titan.glb')

# 3 Female Titan
T=Titan('Female Titan',300).humanoid(shoulder=.85,hip=.88,leg=.83,chest='bone_light',secondary='bone',arms=.86)
T.blob([0,-.01,4.33],[.28,.235,.35],'skin_light',2)
T.blob([0,-.17,4.14],[.20,.09,.15],'skin',1)
T.eyes(z=4.39,spacing=.135,y=-.26,eye='blue_eye',size=.065)
T.blob([0,.04,4.63],[.35,.29,.21],'blonde',1)
for i in range(28):
    ang=i*2*math.pi/28
    x=.30*math.cos(ang);y=.24*math.sin(ang)
    length=R.uniform(.27,.53) if y<=.07 else R.uniform(.25,.37)
    T.beam([x,y,4.60],[x*1.1,y*1.2,4.60-length],.06,.07,'blonde_light' if i%4 else 'blonde_dark')
for s in [-1,1]:
    T.blob([s*.25,-.31,3.37],[.24,.15,.20],'bone_light',2)
    for j in range(5):T.beam([s*.23,-.37,3.17-j*.15],[s*.32,-.26,3.19-j*.15],.045,.055,'bone_light')
    T.blob([s*.28,-.27,1.78],[.19,.12,.43],'bone_light',1)
    T.rod([s*.8,-.20,2.58],[s*.8,-.29,2.01],.055,'bone')
T.blob([0,-.34,2.16],[.29,.14,.21],'bone_light',1)
female=T.export(OUT/'female_titan.glb')

# 4 Beast Titan
T=Titan('Beast Titan',400).humanoid(body='fur',chest='skin',secondary='skin',shoulder=1.23,hip=1.22,arms=1.28,leg=1.12)
T.blob([0,0,4.29],[.32,.28,.38],'skin',2)
T.blob([0,-.20,4.13],[.19,.12,.21],'fur_dark',1)
T.eyes(z=4.42,y=-.29,spacing=.15,eye='eye',size=.066)
T.hair_long(start=(0,-.015,4.64),mat='fur_dark',length=.66,num=49,width=.075)
for s in [-1,1]:
    T.pointed([s*.29,-.01,4.38],[s*.57,-.035,4.61],.12,'skin')
    # fur tufts, complex mane and exterior texture
    for j in range(46):
        phi=T.rng.uniform(0,math.pi*2);zz=T.rng.uniform(.8,3.7)
        xx=s*T.rng.uniform(.45,.9) if zz>2.5 else s*T.rng.uniform(.29,.55)
        y=T.rng.uniform(-.21,.21)
        length=T.rng.uniform(.08,.29)
        T.pointed([xx,y,zz+length/2],[xx+s*.07,y-.02,zz-length/2],.075,'fur_light' if j%3==0 else 'fur')
    for j in range(4):T.blob([s*.20,-.32,3.0-j*.18],[.19,.145,.11],'skin_light',1)
    for j in range(15):
        xx=s*T.rng.uniform(.3,.81); zz=T.rng.uniform(2,3.7)
        T.pointed([xx,-.20,zz+.15],[xx+s*.09,-.25,zz-.13],.045,'fur_dark')
for j in range(28):
    xx=T.rng.uniform(-.29,.29);zz=T.rng.uniform(3.05,3.9)
    T.pointed([xx,-.32,zz+.14],[xx,-.4,zz-.15],.046,'fur')
beast=T.export(OUT/'beast_titan.glb')

# 5 Cart Titan, quadrupedal and carrying dark wood crates
T=Titan('Cart Titan',500)
T.blob([0,0,1.96],[.70,.99,.42],'muscle',2)
T.blob([0,-.25,1.94],[.72,.68,.33],'bone',1)
T.blob([0,-1.03,1.93],[.47,.51,.37],'muscle_dark',1)
T.rod([0,-1.23,1.92],[0,-1.69,1.63],.24,'muscle_dark')
T.blob([0,-1.68,1.60],[.33,.25,.38],'skin',2)
T.blob([0,-1.87,1.42],[.26,.13,.20],'skin_shadow',1)
T.eyes(z=1.69,y=-1.885,spacing=.16,eye='blue_eye',size=.075)
for i in range(9):T.cube([(i-4)*.06,-1.973,1.43],[.047,.055,.12],'teeth')
for j in range(40):
    theta=T.rng.uniform(-math.pi/2,math.pi/2)
    x=.29*math.sin(theta);z=1.78+.21*math.cos(theta)
    T.beam([x,-1.57,z],[x+T.rng.uniform(-.08,.08),-1.90,1.33-T.rng.random()*.25],.06,.064,'blackhair')
for side in [-1,1]:
    for yf,zb in [(-.72,1.79),(+.75,1.84)]:
        x=side*.52;shoulder=(x,yf,zb)
        knee=(side*.70,yf-.30,.97) if yf<0 else (side*.68,yf+.38,1.15)
        ankle=(side*.72,yf-.35,.19) if yf<0 else (side*.70,yf+.42,.18)
        T.blob(shoulder,[.28,.34,.30],'bone',2)
        T.rod(shoulder,knee,.22,'muscle')
        T.blob(knee,[.22,.24,.24],'bone_light',1)
        T.rod(knee,ankle,.17,'muscle')
        T.blob(ankle,[.17,.22,.14],'bone',1)
        for i in range(4):
            xx=ankle[0]+(i-1.5)*.105
            T.cube([xx,ankle[1]-.19,.09],[.10,.37,.13],'bone_light')
        for rib in range(6):
            y=-.80+rib*.32
            T.cord([[side*.17,y,2.12],[side*.56,y,1.97],[side*.62,y,1.81]],.046,'bone_light')
# pack harness
T.cube([0,.08,2.35],[1.11,1.83,.17],'wood')
for yy in [-.73,-.07,.60]:
    for xx in [-.30,.30]:
        T.cube([xx,yy,2.70],[.64,.67,.57],'wood')
        for dz in [-.23,.22]:
            T.beam([xx-.30,yy-.29,2.70+dz],[xx+.30,yy-.29,2.70+dz],.07,.065,'metal')
        for dd in [-.28,.28]:
            T.beam([xx+dd,yy-.28,2.47],[xx+dd,yy-.28,2.94],.055,.055,'metal')
        T.cube([xx,yy,3.00],[.66,.67,.07],'wood_light')
for xx in [-.49,.49]:T.beam([xx,-.9,2.48],[xx,.94,2.48],.085,.11,'metal')
cart=T.export(OUT/'cart_titan.glb')

# 6 War Hammer Titan
T=Titan('War Hammer Titan',600).humanoid(body='white',secondary='white_light',chest='white_light',shoulder=1.04,leg=.94)
T.blob([0,0,4.34],[.32,.24,.41],'white',2)
T.blob([0,-.235,4.18],[.24,.075,.25],'white_dark',1)
for s in [-1,1]:
    T.blob([s*.16,-.262,4.43],[.09,.058,.063],'red_eye',1)
    for j in range(4):
        T.beam([s*.15,-.29,4.24-j*.083],[s*.26,-.26,4.20-j*.086],.063,.056,'white_light')
    # back spikes / hardened shell
    for j in range(4):
        zz=3.58-j*.26
        T.pointed([s*.57,.12,zz],[s*(.85+j*.09),.43,zz+.67-j*.03],.135,'white_light')
    for j in range(3):
        T.pointed([s*.77,.09,2.36-j*.29],[s*1.1,.30,2.76-j*.31],.11,'white')
    T.blob([s*.69,-.20,3.54],[.27,.20,.30],'white_light',2)
    T.beam([s*.83,-.21,3.17],[s*.86,-.28,2.56],.115,.115,'white_light')
for j in range(6):T.cube([0,-.47,3.18-j*.15],[.32,.12,.078],'white',rotation=(.1,[0,1,0]))
# Hammer: handle in left hand, long shaft with complicated heavy clobber head
T.rod([-0.90,-.25,1.76],[-1.40,-.34,.38],.075,'white',sections=8)
T.blob([-1.42,-.34,.36],[.30,.27,.48],'white_light',1)
for k in range(13):
    angle=2*math.pi*k/13
    xx=-1.42+.28*math.cos(angle);yy=-.34+.26*math.sin(angle)
    T.pointed([xx,yy,.49],[xx+.23*math.cos(angle),yy+.22*math.sin(angle),.23],.10,'white')
for k in range(4):T.pointed([-1.42,-.34,.25],[-1.42+(k-1.5)*.18,-.41,-.34],.12,'white_light')
war=T.export(OUT/'war_hammer_titan.glb')

# 7 Founding Titan: long bony exoskeleton, exaggerated ribs and spine
T=Titan('Founding Titan',700)
T.blob([0,0,3.26],[.31,.23,.76],'muscle_dark',2)
T.blob([0,-.01,2.31],[.34,.25,.36],'bone_light',1)
T.rod([0,0,3.55],[0,0,4.16],.16,'muscle_dark')
T.blob([0,-.02,4.35],[.28,.23,.37],'skin_shadow',2)
T.blob([0,-.215,4.17],[.24,.13,.22],'teeth',1)
T.eyes(z=4.42,y=-.254,spacing=.135,eye='green_eye')
T.hair_long(start=(0,0,4.61),mat='blackhair',length=1.56,num=52,width=.045)
for side in [-1,1]:
    for zz in [3.45,3.29,3.10,2.91,2.73]:
        pts=[[side*.08,-.28,zz+.055],[side*.38,-.30,zz+.07],[side*.64,-.13,zz-.07],[side*.69,.09,zz-.21]]
        T.cord(pts,.060,'bone_light',sections=6)
    T.blob([side*.56,.02,3.53],[.22,.19,.22],'bone_light',1)
    elbow=[side*.82,-.1,2.44];wrist=[side*.97,-.19,1.71]
    T.rod([side*.62,0,3.48],elbow,.12,'bone_light',5)
    T.rod(elbow,wrist,.10,'bone',5)
    T.fingers(side,[side*.98,-.19,1.58],1.12,'bone_light')
    hip=[side*.23,.0,2.18];knee=[side*.30,-.04,1.2];ankle=[side*.36,-.10,.26]
    T.rod(hip,knee,.18,'muscle_dark',6)
    T.blob([side*.26,-.16,1.72],[.185,.17,.37],'bone',1)
    T.rod(knee,ankle,.105,'bone_light',6)
    T.blob(knee,[.16,.16,.17],'bone_light',1)
    T.blob([side*.36,-.28,.12],[.17,.34,.12],'bone_light',1)
    for i in range(4):T.cube([side*.36+(i-1.5)*.08,-.48,.07],[.07,.20,.11],'bone_light')
# Exposed spinal vertebrae run far behind the body, tapering downward
for i in range(21):
    h=3.84-i*.17
    y=.55+i*.055
    T.blob([0,y,h],[.11,.12,.105],'bone_light',1)
    if i<18:
        reach=.48+(.23*(i/18))
        for s in [-1,1]:
            T.cord([[0,y,h],[s*reach*.55,y+.12,h-.09],[s*reach,y+.25,h-.20]],.038,'bone')
# Back elongated enormous wings, bamboo-like bone rods
for s in [-1,1]:
    for i in range(7):
        z=3.67-i*.165
        sx=s*(.25+i*.09)
        a=[sx,.30,z]
        b=[s*(1.10+i*.10),.50+(i%3)*.10,z+.89-i*.025]
        c=[s*(1.24+i*.08),.64+(i%3)*.12,z-.72-(i*.06)]
        T.cord([a,b,c],.035 if i>1 else .045,'bone_light',sections=5)
        T.blob(b,[.052,.058,.051],'bone',1)
founding=T.export(OUT/'founding_titan.glb')

infos=[armored,colossal,female,beast,cart,war,founding]
with open(OUT/'README.txt','w') as f:
    f.write('SEVEN TITAN GLB MODELS — CONCEPT / BLOCKOUT QUALITY\n\n'
    'Hand-constructed stylized 3D approximations guided by seven supplied reference images.\n'
    'NOT AI-reconstructed, not pixel-accurate, not rigged, and not production-ready character assets.\n'
    'Each GLB contains embedded generated PBR base-color, metallic/roughness and neutral normal textures.\n'
    'Coordinates: Z up; models front face -Y. Most humanoids approx 4.9 scene units high.\n'
    'Use in Blender, Godot, Three.js, or Unity. Retopology, skeletons, animations, and manual lookdev needed.\n\n')
    for inf in infos:f.write(f"{inf['file']}  {inf['triangles']} triangles\n")
with open(OUT/'manifest.json','w') as f:json.dump(infos,f,indent=2)
with zipfile.ZipFile(str(OUT/'titan_glb_models.zip'),'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for path in OUT.iterdir():z.write(path,arcname=path.name)
print(json.dumps(infos,indent=2))
print('ZIP:',os.path.getsize(str(OUT/'titan_glb_models.zip')))