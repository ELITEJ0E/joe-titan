"""Bake reference-guided vertex colors, retaining geometry, skins and animation.

Images are used to classify materials, not to bake photographed illumination.
Existing UV textures on the two blockout assets are recolored in place.
"""
import io
import json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage as ndi
import maxflow
from titan_asset_tools import GLB,geometry
from fit_titan_references import reference,camera,reference_path,OUT

PALETTES={
 'armored_idle':{'skin':'caa479','muscle':'963d2e','hair':'d4bd87','dark':'332219','teeth':'efdcba','eye':'ddc35f'},
 'beast_titan':{'skin':'cba980','muscle':'763b29','hair':'70472e','dark':'33251f','teeth':'e7d3ae','eye':'a78b46'},
 'colossal_titan':{'skin':'dfbd98','muscle':'b14c37','hair':'dfbd98','dark':'432820','teeth':'e9d4b1','eye':'d4c7a4'},
 'female_titan':{'skin':'dfb797','muscle':'ae4a35','hair':'c9a563','dark':'452d27','teeth':'e4d4b8','eye':'81bac9'},
 'founding_titan':{'skin':'d8b996','muscle':'873c2d','hair':'302824','dark':'261d1b','teeth':'dfd6bd','eye':'62b8a1'},
 'attack_titan':{'skin':'cfa580','muscle':'9c4431','hair':'332b27','dark':'2b201d','teeth':'dfd9c7','eye':'60bda1'},
}

def rgb(hexvalue):return np.array([int(hexvalue[i:i+2],16) for i in (0,2,4)],float)/255
def linear(srgb):return np.where(srgb<=.04045,srgb/12.92,((srgb+.055)/1.055)**2.4)

def polygon_mask(size,points):
    image=Image.new('1',(size,size));ImageDraw.Draw(image).polygon([(int(x*size),int(y*size)) for x,y in points],fill=1)
    return np.array(image,bool)

def reference_labels(name,size=1254):
    image=Image.open(reference_path(name)).convert('RGB').resize((size,size))
    a=np.asarray(image).astype(float);r,g,b=a.transpose(2,0,1)
    # Neutral studio background is excluded; nearest foreground handles small
    # silhouette differences between the reconstructed mesh and source picture.
    _,mask=reference(name,size)
    red=(r/np.maximum(g,1)>1.53)&(r-b>29)
    labels=np.zeros((size,size),np.uint8);labels[red]=1
    y,x=np.indices((size,size))/size
    dark=(a.max(2)<88)&~red
    if name in ('attack_titan','founding_titan'):
        labels[dark]=2
        labels[(a.max(2)<54)&(y<.23)]=3
    elif name=='female_titan':
        # Blond strands have more yellow than skin. Keep face flesh colored.
        hair=(y<.235)&(g/np.maximum(b,1)>1.25)&~red
        labels[hair]=2
        labels[dark&(y<.24)]=3
    elif name=='armored_idle':
        labels[(y<.125)&~red]=2
        labels[dark&(y<.21)]=3
    elif name=='colossal_titan':
        labels[dark&(y<.19)]=3
    if name=='beast_titan':
        labels[:]=2
        regions=[[(.35,.28),(.41,.255),(.49,.266),(.59,.239),(.592,.326),(.55,.395),(.55,.49),(.48,.50),(.438,.46),(.421,.364),(.36,.342)],
                 [(.365,.094),(.397,.085),(.458,.094),(.451,.143),(.43,.174),(.392,.16),(.369,.135)],
                 [(.216,.607),(.27,.606),(.284,.654),(.31,.708),(.285,.759),(.216,.74),(.208,.685)],
                 [(.686,.612),(.759,.625),(.786,.7),(.761,.782),(.699,.792),(.648,.762),(.66,.68)],
                 [(.275,.908),(.387,.866),(.467,.879),(.474,.921),(.42,.935),(.28,.934)],
                 [(.6,.942),(.657,.906),(.726,.913),(.77,.945),(.763,.978),(.595,.978)]]
        for points in regions:labels[polygon_mask(size,points)]=0
        labels[dark&(y<.18)]=3
    # Eyes are small but need distinct colors; exclude background by foreground.
    eye=(g>r*1.08)&(b>r*.96)&(y<.22)&mask
    if name in ('attack_titan','female_titan','founding_titan'):labels[eye]=5
    if name in ('armored_idle','beast_titan'):
        gold=(r>130)&(g>115)&(b<g*.80)&(y>.108)&(y<.119)&(x>.408)&(x<.426)
        if name=='beast_titan':gold=(r>95)&(g>75)&(b<g*.85)&(y>.095)&(y<.108)&(x>.369)&(x<.414)
        labels[gold]=5
    if name in ('attack_titan','founding_titan','colossal_titan'):
        teeth=(a.max(2)-a.min(2)<45)&(a.min(2)>100)&(y>.14)&(y<.185)&(x>.35)&(x<.46)
        labels[teeth&mask]=4
    # Only remove isolated one-pixel label noise, retaining the eyes and teeth.
    smooth=ndi.median_filter(labels,size=3)
    labels=np.where((labels==4)|(labels==5),labels,smooth).astype(np.uint8)
    nearest=ndi.distance_transform_edt(~mask,return_distances=False,return_indices=True)
    labels[~mask]=labels[nearest[0][~mask],nearest[1][~mask]]
    palette=np.array([rgb(v) for v in PALETTES[name].values()])
    painted=(palette[labels]*255).astype('uint8');painted[~mask]=[229,229,229]
    Image.fromarray(painted).resize((627,627)).save(OUT/(name+'-material-guide.png'))
    return labels,palette

def set_colors(glb,colors):
    p=glb.doc['meshes'][0]['primitives'][0]
    colors=np.column_stack((np.clip(np.rint(colors*255),0,255).astype('uint8'),np.full(len(colors),255,dtype='uint8')))
    old=p['attributes'].get('COLOR_0')
    if old is not None and glb.doc['accessors'][old]['componentType']==5121 and glb.doc['accessors'][old]['type']=='VEC4':
        a=glb.doc['accessors'][old];v=glb.doc['bufferViews'][a['bufferView']];offset=v.get('byteOffset',0)+a.get('byteOffset',0)
        assert v.get('byteStride',4)==4
        glb.binary[offset:offset+colors.nbytes]=colors.tobytes();a['min']=colors.min(0).tolist();a['max']=colors.max(0).tolist()
    else:p['attributes']['COLOR_0']=glb.append(colors,'VEC4',True)
    glb.doc['materials']=[{'name':'Reference palette / '+glb.path.stem,'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':.86}}]
    p['material']=0
    glb.doc.setdefault('asset',{}).setdefault('extras',{})['colorWorkflow']='Reference-projected material labels, linear glTF vertex colors; geometry and animation preserved'

def paint(name,params):
    glb=GLB('public/models/titans/'+name+'.glb');pos,faces,previous=geometry(glb)
    pos-=(pos.min(0)+pos.max(0))/2;pos/=np.ptp(pos[:,1])
    labels,palette=reference_labels(name)
    xy,depth=camera(pos,params,len(labels))
    landmarks=json.loads((OUT/'head-landmarks.json').read_text())
    eye_point=np.array(landmarks[name])
    desired={'armored_idle':[.418,.112],'beast_titan':[.411,.101],'colossal_titan':[.425,.060],'female_titan':[.438,.115],'founding_titan':[.415,.073],'attack_titan':[.418,.120]}
    eye_projection,_=camera(eye_point[None,:],params,len(labels))
    delta=np.array(desired[name])*len(labels)-eye_projection[0]
    blend=np.clip((pos[:,1]-.28)/.06,0,1)
    if name=='founding_titan':blend=(pos[:,2]>.22)*np.clip((pos[:,1]+.12)/.06,0,1)
    xy+=blend[:,None]*delta
    pixels=np.rint(xy).astype(int);pixels=np.clip(pixels,0,len(labels)-1)
    kinds=labels[pixels[:,1],pixels[:,0]]
    # Snap the broad material regions to coherent mesh surfaces. Projection
    # alone would leave ragged red flecks on cream plates where the generated
    # geometry differs slightly from the photograph.
    normals=np.zeros_like(pos)
    fn=np.cross(pos[faces[:,1]]-pos[faces[:,0]],pos[faces[:,2]]-pos[faces[:,0]])
    for corner in range(3):np.add.at(normals,faces[:,corner],fn)
    normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-12)
    edges=np.unique(np.sort(np.concatenate((faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]])),axis=1),axis=0)
    dot=np.sum(normals[edges[:,0]]*normals[edges[:,1]],axis=1)
    weights=1.4*(.06+np.exp(-(1-np.clip(dot,-1,1))/.10))
    for kind in ([0] if name=='beast_titan' else [1,2]):
        region=labels==kind
        if not region.any():continue
        outside=ndi.distance_transform_edt(~region);inside=ndi.distance_transform_edt(region)
        cost_on=np.minimum(outside[pixels[:,1],pixels[:,0]]/4,5)
        cost_off=np.minimum(inside[pixels[:,1],pixels[:,0]]/4,5)
        graph=maxflow.Graph[float](len(pos),len(edges));nodes=graph.add_nodes(len(pos))
        strength=2.5 if kind==2 else 1
        graph.add_edges(edges[:,0],edges[:,1],weights*strength,weights*strength)
        graph.add_grid_tedges(nodes,cost_off,cost_on)
        graph.maxflow();chosen=~graph.get_grid_segments(nodes)
        # Source-side vertices select this material, sink-side reject it.
        kinds[(kinds==kind)&~chosen]=0 if kind!=0 else 2
        kinds[chosen]=kind
    # Preserve tiny reference eye/teeth marks, which are intentionally smaller
    # than the surface smoothing scale.
    original=labels[pixels[:,1],pixels[:,0]]
    kinds[(original==4)|(original==5)]=original[(original==4)|(original==5)]
    if name=='founding_titan':
        hair_zone=(np.abs(pos[:,0])<.13)&(pos[:,1]>-.12)&(pos[:,1]<.35)&(pos[:,2]>.22)
        kinds[((kinds==2)|(kinds==3))&~hair_zone]=0
        # The reconstruction puts the front hair curtain below the tall spine.
        # A silhouette fit cannot distinguish those two overlapping structures.
        curtain=(np.abs(pos[:,0])<.11)&(pos[:,1]>-.11)&(pos[:,1]<.35)&(pos[:,2]>.245)
        kinds[curtain]=2
        face=(pos[:,0]>-.043)&(pos[:,0]<.027)&(pos[:,1]>.218)&(pos[:,1]<.298)&(pos[:,2]>.314)
        kinds[face]=0
        teeth=face&(pos[:,1]>.235)&(pos[:,1]<.245)
        kinds[teeth]=4
    elif name in ('armored_idle','female_titan','attack_titan','beast_titan'):
        # Eyes and dark sockets must never appear on shoulders or body surfaces.
        kinds[((kinds==3)|(kinds==5))&(pos[:,1]<.30)]=2 if name=='beast_titan' else 0
    if name=='armored_idle':
        face_plate=(np.abs(pos[:,0])<.085)&(pos[:,1]>.359)&(pos[:,1]<.442)&(pos[:,2]>.025)
        kinds[face_plate]=0
        kinds[(np.linalg.norm(pos-eye_point,axis=1)<.009)&face_plate]=3
    if name=='founding_titan':
        scalp=(np.abs(pos[:,0])<.09)&(pos[:,1]>.30)&(pos[:,1]<.355)&(pos[:,2]>.19)
        kinds[scalp]=2
    # Single-view photography supplies no back textures. Use anatomical material
    # continuation there, rather than projecting eyes or bare chest onto a back.
    if name in ('attack_titan','female_titan','beast_titan'):
        back_hair=(pos[:,1]>.31)&(pos[:,2]<( .06 if name=='beast_titan' else .025))
        kinds[back_hair]=2
    if name=='armored_idle':kinds[(pos[:,1]>.40)&(pos[:,2]<.05)]=2
    if name=='beast_titan':
        back_fur=(pos[:,1]>-.10)&(pos[:,1]<.31)&(pos[:,2]<.025)
        kinds[back_fur]=2
    kinds[((kinds==4)|(kinds==5))&(pos[:,2]<.04)]=0
    # The source photographs contain deep lighting shadows in the hair. Keep
    # these in the hair material rather than painting black shadow patterns.
    if name in ('beast_titan','attack_titan','founding_titan'):
        kinds[(kinds==3)&(np.linalg.norm(pos-eye_point,axis=1)>.027)]=2
    kinds[np.linalg.norm(pos-eye_point,axis=1)<.0045]=5
    # Mild deterministic block variation does not bake light/shadow into albedo.
    blocks=np.floor(pos*110)
    variation=1+.025*np.sin(blocks[:,0]*7+blocks[:,1]*11+blocks[:,2]*17)
    srgb=np.clip(palette[kinds]*variation[:,None],0,1)
    set_colors(glb,linear(srgb));glb.save()
    print(name,dict(zip(*np.unique(kinds,return_counts=True))),flush=True)
    return linear(srgb)

def recolor_texture(name,palette):
    glb=GLB('public/models/titans/'+name+'.glb')
    for material in glb.doc['materials']:
        pbr=material['pbrMetallicRoughness'];color=palette.get(material['name'])
        if not color:continue
        texture=glb.doc['textures'][pbr['baseColorTexture']['index']]
        image=glb.doc['images'][texture['source']];view=glb.doc['bufferViews'][image['bufferView']]
        start=view.get('byteOffset',0)
        source=np.asarray(Image.open(io.BytesIO(glb.binary[start:start+view['byteLength']])).convert('RGB')).astype(float)
        noise=source.mean(2)-np.median(source.mean(2));pixels=np.clip(rgb(color)[None,None,:]*255+noise[:,:,None]*.45,0,255).astype('uint8')
        output=io.BytesIO();Image.fromarray(pixels).save(output,format='PNG')
        glb.binary.extend(b'\0'*((-len(glb.binary))%4));image['bufferView']=len(glb.doc['bufferViews'])
        glb.doc['bufferViews'].append(dict(buffer=0,byteOffset=len(glb.binary),byteLength=len(output.getvalue())))
        glb.binary.extend(output.getvalue());pbr['metallicFactor']=0
    # The original blockouts use Z-up; the game and reference meshes use Y-up.
    root=glb.doc['nodes'][glb.doc['scenes'][glb.doc.get('scene',0)]['nodes'][0]]
    root['rotation']=[-2**-.5,0,0,2**-.5]
    glb.save()

if __name__=='__main__':
    params=json.loads((OUT/'reference-cameras.json').read_text())
    for name in PALETTES:paint(name,params[name])
    # Both Armored assets have exactly the same vertex order; only Y origin differs.
    idle=GLB('public/models/titans/armored_idle.glb');run=GLB('public/models/titans/armored_titan.glb')
    ip,ix,ic=geometry(idle);rp,rx,rc=geometry(run)
    assert np.array_equal(ix,rx) and np.allclose(ip-ip.min(0),rp-rp.min(0),atol=1e-6)
    set_colors(run,ic);run.save()
    primitive=run.doc['meshes'][0]['primitives'][0]
    if 'NORMAL' not in primitive['attributes']:
        normal=idle.array(idle.doc['meshes'][0]['primitives'][0]['attributes']['NORMAL']).astype('float32')
        primitive['attributes']['NORMAL']=run.append(normal,'VEC3')
        run.save()
    recolor_texture('jaw_titan',{'muscle_dark':'8c4030','muscle_light':'c7956b','bone_light':'ecdfbf','skin_shadow':'a9734f','black':'2f211c','green_eye':'d7aa38','blonde':'93632f','bone_dark':'b7a183','teeth':'f0e5cc','bone':'e3d1ad'})
    recolor_texture('war_hammer_titan',{'white':'e8e1d2','white_light':'f5f0e5','white_dark':'cec5b5','muscle_dark':'71352f','red_eye':'8e3930'})
