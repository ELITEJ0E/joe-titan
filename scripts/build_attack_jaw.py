from pathlib import Path
import runpy
from math import sin, cos, pi
m = runpy.run_path(str(Path(__file__).with_name('build_titan_glbs.py')))
Titan, OUT = m['Titan'],m['OUT']

# Missing Attack and Jaw reference images: supplementary game-specific concept meshes
A = Titan('Attack Titan', 911).humanoid(body='muscle',secondary='bone',shoulder=1.14,hip=0.95,chest='muscle_light',arms=1.10)
A.blob([0,0,4.35],[.315,.26,.37],'skin',2)
A.blob([0,-.245,4.21],[.19,.12,.2],'muscle_dark',1)
A.eyes(z=4.44,y=-.30,spacing=.14,eye='green_eye')
A.hair_long(start=(0,0,4.62),mat='blackhair',length=.92,num=45,width=.057)
for s in (-1,1):
    A.pointed([s*.29,-.02,4.35],[s*.53,0,4.48],.1,'skin_light')
    A.blob([s*.65,-.21,3.49],[.23,.16,.30],'muscle_light',2)
    for j in range(5):
        A.beam([s*.20,-.37,3.12-j*.17],[s*.41,-.32,3.22-j*.17],.045,.06,'muscle_dark')
    for j in range(4):
        A.beam([s*.74,-.20,3.17-j*.22],[s*.87,-.23,3.17-j*.22],.048,.054,'bone')
    A.blob([s*.30,-.25,1.74],[.23,.11,.35],'muscle_light',1)
A.export(OUT/'attack_titan.glb')

J = Titan('Jaw Titan', 912).humanoid(body='muscle_dark',secondary='bone_light',shoulder=.99,hip=.82,chest='muscle_light',arms=1.16,leg=1.20)
J.blob([0,-.09,4.29],[.29,.275,.34],'skin_shadow',2)
J.eyes(z=4.42,y=-.37,spacing=.14,eye='green_eye',size=.07)
J.hair_short(top=(0,.03,4.57),base='blonde',rows=11,length=.30)
J.blob([0,-.29,4.17],[.28,.21,.22],'bone_light',2)
J.blob([0,-.42,4.09],[.27,.115,.11],'bone_dark',1)
for s in (-1,1):
    J.blob([s*.20,-.33,4.25],[.14,.13,.23],'bone_light',1)
    for i in range(4):
        J.pointed([s*(.085+i*.052),-.44,4.08],[s*(.085+i*.052),-.51,3.88],.041,'teeth')
    for i in range(4):
        J.pointed([s*.85+(i-1.5)*.055,-.21,1.74],[s*.87+(i-1.5)*.06,-.42,1.43],.075,'bone_light')
    J.pointed([s*.51,-.11,4.39],[s*.76,-.06,4.66],.11,'bone')
    J.blob([s*.37,-.23,1.20],[.28,.20,.30],'bone_light',1)
J.export(OUT/'jaw_titan.glb')
print('Supplementary Attack/Jaw GLBs exported:',(OUT/'attack_titan.glb').stat().st_size,(OUT/'jaw_titan.glb').stat().st_size)