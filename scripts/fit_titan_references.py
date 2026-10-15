"""Fit an orthographic reference projection without modifying model geometry."""
import json
import os
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage as ndi
from scipy.optimize import differential_evolution
from titan_asset_tools import GLB,geometry,raster

OUT=Path('artifacts/titan-color-review');OUT.mkdir(parents=True,exist_ok=True)
REFERENCE_DIR=Path(os.environ.get('TITAN_REFERENCE_DIR',str(OUT/'references')))
def reference_path(name):return REFERENCE_DIR/(name+'.png')

def reference(name,size=128):
    image=Image.open(reference_path(name)).convert('RGB').resize((size,size))
    a=np.asarray(image).astype(float)
    mask=((a[:,:,0]-a[:,:,2])>12)|((a.max(2)<85)&(np.indices(a.shape[:2])[0]<size*.9))
    if name=='war_hammer_titan':mask|=(a.min(2)>185)&((a[:,:,0]-a[:,:,2])>3)
    mask=ndi.binary_fill_holes(ndi.binary_closing(mask,iterations=2))
    labels,n=ndi.label(mask);counts=np.bincount(labels.ravel());counts[0]=0
    mask=labels==np.argmax(counts)
    return image,mask

def camera(pos,params,size):
    angle,elev,scale,tx,ty=params
    eye=np.array([np.sin(angle)*np.cos(elev),np.sin(elev),np.cos(angle)*np.cos(elev)])
    right=np.cross([0,1,0],eye);right/=np.linalg.norm(right);up=np.cross(eye,right)
    xy=pos@np.array([right,up]).T
    return np.column_stack((xy[:,0]*scale*size+tx*size,-xy[:,1]*scale*size+ty*size)),pos@eye

def fit(name):
    image,mask=reference(name)
    pos,faces,colors=geometry(GLB('public/models/titans/'+name+'.glb'))
    pos-=(pos.min(0)+pos.max(0))/2;pos/=np.ptp(pos[:,1])
    sample=pos[np.random.default_rng(7).choice(len(pos),min(14000,len(pos)),replace=False)]
    h,w=mask.shape;distance=ndi.distance_transform_edt(~mask);inside=ndi.distance_transform_edt(mask)
    def score(p):
        xy,_=camera(sample,p,w);x=np.rint(xy[:,0]).astype(int);y=np.rint(xy[:,1]).astype(int)
        valid=(x>=0)&(x<w)&(y>=0)&(y<h)
        silhouette=np.zeros((h,w),bool);silhouette[y[valid],x[valid]]=True
        silhouette=ndi.binary_fill_holes(ndi.binary_closing(ndi.binary_dilation(silhouette),iterations=2))
        intersection=(silhouette&mask).sum();union=(silhouette|mask).sum()
        return 1-intersection/max(union,1)
    result=differential_evolution(score,[(-.9,.9),(-.22,.2),(.75,1.1),(.36,.64),(.4,.62)],popsize=7,maxiter=32,tol=.0002,seed=3,polish=False)
    xy,depth=camera(pos,result.x,w)
    rendered,z=raster(xy,depth,faces,np.full((len(pos),3),180.),w)
    overlay=np.array(image).copy();edge=ndi.binary_dilation(z>-1e9)^(z>-1e9);overlay[edge]=[0,255,220]
    Image.fromarray(overlay).resize((768,768)).save(OUT/(name+'-fit.png'))
    print(name,result.fun,result.x.tolist(),flush=True)
    return result.x.tolist()

if __name__=='__main__':
    names=['armored_idle','beast_titan','colossal_titan','female_titan','founding_titan','attack_titan']
    result=json.loads((OUT/'reference-cameras.json').read_text()) if (OUT/'reference-cameras.json').exists() else {}
    for name in names:
        if name in result:continue
        result[name]=fit(name)
        (OUT/'reference-cameras.json').write_text(json.dumps(result,indent=2))
