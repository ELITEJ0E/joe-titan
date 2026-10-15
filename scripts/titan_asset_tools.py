"""Small lossless GLB utilities and an offline reference-review renderer."""
import json
import struct
import io
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from numba import njit

DTYPES={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
WIDTHS={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}

class GLB:
    def __init__(self,path):
        self.path=Path(path)
        data=self.path.read_bytes()
        assert data[:4]==b'glTF'
        n,kind=struct.unpack_from('<II',data,12)
        self.doc=json.loads(data[20:20+n])
        length,kind=struct.unpack_from('<II',data,20+n)
        self.binary=bytearray(data[28+n:28+n+length])

    def array(self,index):
        a=self.doc['accessors'][index];v=self.doc['bufferViews'][a['bufferView']]
        dtype=np.dtype(DTYPES[a['componentType']]);width=WIDTHS[a['type']]
        return np.ndarray((a['count'],width),dtype=dtype,buffer=self.binary,
            offset=v.get('byteOffset',0)+a.get('byteOffset',0),
            strides=(v.get('byteStride',width*dtype.itemsize),dtype.itemsize)).copy()

    def append(self,array,kind,normalized=False,target=34962):
        array=np.ascontiguousarray(array)
        self.binary.extend(b'\0'*((-len(self.binary))%4))
        view=len(self.doc['bufferViews'])
        self.doc['bufferViews'].append(dict(buffer=0,byteOffset=len(self.binary),byteLength=array.nbytes,target=target))
        self.binary.extend(array.tobytes())
        a=dict(bufferView=view,componentType={'uint8':5121,'float32':5126}[str(array.dtype)],count=len(array),type=kind)
        if normalized:a['normalized']=True
        self.doc['accessors'].append(a)
        return len(self.doc['accessors'])-1

    def save(self,path=None):
        self.doc['buffers'][0]['byteLength']=len(self.binary)
        j=json.dumps(self.doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
        b=bytes(self.binary);b+=b'\0'*((-len(b))%4)
        data=struct.pack('<III',0x46546c67,2,28+len(j)+len(b))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(b),0x004e4942)+b
        Path(path or self.path).write_bytes(data)

def geometry(glb,whole_scene=False):
    if whole_scene:
        positions=[];indices=[];allcolors=[];offset=0
        def visit(index,parent):
            nonlocal offset
            node=glb.doc['nodes'][index];matrix=np.eye(4)
            if 'matrix' in node:matrix=np.array(node['matrix']).reshape(4,4).T
            else:
                x,y,z,w=node.get('rotation',[0,0,0,1])
                matrix[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(node.get('scale',[1,1,1]))
                matrix[:3,3]=node.get('translation',[0,0,0])
            matrix=parent@matrix
            if 'mesh' in node:
                for primitive in glb.doc['meshes'][node['mesh']]['primitives']:
                    attrs=primitive['attributes'];pos=glb.array(attrs['POSITION']).astype(float);n=len(pos)
                    pos=(np.column_stack((pos,np.ones(n)))@matrix.T)[:,:3]
                    color=np.full((n,3),.65)
                    mat=glb.doc.get('materials',[{}])[primitive.get('material',0)] if glb.doc.get('materials') else {}
                    pbr=mat.get('pbrMetallicRoughness',{})
                    if 'COLOR_0' in attrs:
                        a=glb.doc['accessors'][attrs['COLOR_0']];color=glb.array(attrs['COLOR_0'])[:,:3].astype(float)
                        if a.get('normalized'):color/=np.iinfo(np.dtype(DTYPES[a['componentType']])).max
                    elif 'baseColorTexture' in pbr and 'TEXCOORD_0' in attrs:
                        texture=glb.doc['textures'][pbr['baseColorTexture']['index']];image=glb.doc['images'][texture['source']];v=glb.doc['bufferViews'][image['bufferView']];start=v.get('byteOffset',0)
                        pixels=np.asarray(Image.open(io.BytesIO(glb.binary[start:start+v['byteLength']])).convert('RGB')).astype(float)/255
                        uv=glb.array(attrs['TEXCOORD_0']);h,w=pixels.shape[:2];xx=np.clip((uv[:,0]*(w-1)).astype(int),0,w-1);yy=np.clip((uv[:,1]*(h-1)).astype(int),0,h-1)
                        srgb=pixels[yy,xx];color=np.where(srgb<=.04045,srgb/12.92,((srgb+.055)/1.055)**2.4)
                    color*=np.array(pbr.get('baseColorFactor',[1,1,1,1]))[:3]
                    positions.append(pos);indices.append(glb.array(primitive['indices']).reshape(-1,3).astype(np.int32)+offset);allcolors.append(color);offset+=n
            for child in node.get('children',[]):visit(child,matrix)
        for root in glb.doc['scenes'][glb.doc.get('scene',0)]['nodes']:visit(root,np.eye(4))
        return np.concatenate(positions),np.concatenate(indices),np.concatenate(allcolors)
    p=glb.doc['meshes'][0]['primitives'][0]
    pos=glb.array(p['attributes']['POSITION']).astype(float)
    faces=glb.array(p['indices']).reshape(-1,3).astype(np.int32)
    colors=np.full((len(pos),3),.65)
    if 'COLOR_0' in p['attributes']:
        a=glb.doc['accessors'][p['attributes']['COLOR_0']]
        colors=glb.array(p['attributes']['COLOR_0'])[:,:3].astype(float)
        if a.get('normalized'):colors/=np.iinfo(np.dtype(DTYPES[a['componentType']])).max
    return pos,faces,colors

@njit(cache=True)
def raster(projected,depth,faces,colors,size):
    out=np.full((size,size,3),229,dtype=np.uint8)
    zbuffer=np.full((size,size),-1e10)
    for tri in faces:
        a,b,c=tri
        x0,y0=projected[a];x1,y1=projected[b];x2,y2=projected[c]
        denom=(y1-y2)*(x0-x2)+(x2-x1)*(y0-y2)
        if abs(denom)<1e-9:continue
        minx=max(0,int(np.floor(min(x0,x1,x2))));maxx=min(size-1,int(np.ceil(max(x0,x1,x2))))
        miny=max(0,int(np.floor(min(y0,y1,y2))));maxy=min(size-1,int(np.ceil(max(y0,y1,y2))))
        for y in range(miny,maxy+1):
            for x in range(minx,maxx+1):
                u=((y1-y2)*(x-x2)+(x2-x1)*(y-y2))/denom
                v=((y2-y0)*(x-x2)+(x0-x2)*(y-y2))/denom
                w=1-u-v
                if u<0 or v<0 or w<0:continue
                z=u*depth[a]+v*depth[b]+w*depth[c]
                if z<=zbuffer[y,x]:continue
                zbuffer[y,x]=z
                for k in range(3):out[y,x,k]=int(min(255.,max(0.,u*colors[a,k]+v*colors[b,k]+w*colors[c,k])))
    return out,zbuffer

def render_points(glb,path,angle=.38,size=750,focus=None):
    pos,faces,colors=geometry(glb,whole_scene=True)
    pos-=(pos.min(0)+pos.max(0))/2
    pos/=np.ptp(pos[:,1])
    if focus:pos-=np.array(focus[0])
    # Positive Z is the uploaded models' face direction.
    eye=np.array([np.sin(angle),.10,np.cos(angle)]);eye/=np.linalg.norm(eye)
    right=np.cross([0,1,0],eye);right/=np.linalg.norm(right)
    up=np.cross(eye,right)
    xy=pos@np.array([right,up]).T
    scale=size*.86/(focus[1] if focus else max(np.ptp(xy[:,1]),np.ptp(xy[:,0])))
    px=np.rint(xy[:,0]*scale+size/2).astype(int)
    py=np.rint(-xy[:,1]*scale+size/2).astype(int)
    normals=np.zeros_like(pos)
    fn=np.cross(pos[faces[:,1]]-pos[faces[:,0]],pos[faces[:,2]]-pos[faces[:,0]])
    for i in range(3):np.add.at(normals,faces[:,i],fn)
    normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-12)
    light=np.array([-.5,.8,1]);light/=np.linalg.norm(light)
    shade=.54+.46*np.maximum(0,normals@light)
    # COLOR_0 is linear, as specified by glTF.
    linear=colors*shade[:,None]
    rgb=np.where(linear<=.0031308,12.92*linear,1.055*linear**(1/2.4)-.055)
    rgb=np.clip(rgb*255,0,255).astype('uint8')
    projected=np.column_stack((xy[:,0]*scale+size/2,-xy[:,1]*scale+size/2))
    out,_=raster(projected,pos@eye,faces,rgb.astype(float),size)
    im=Image.fromarray(out);ImageDraw.Draw(im).text((18,18),glb.path.stem,fill=(30,30,30))
    im.save(path)
    return im

if __name__=='__main__':
    import sys
    folder=Path(sys.argv[1] if len(sys.argv)>1 else 'artifacts/titan-color-review');folder.mkdir(parents=True,exist_ok=True)
    names=['armored_idle','beast_titan','colossal_titan','female_titan','founding_titan','jaw_titan','war_hammer_titan','attack_titan']
    sheet=Image.new('RGB',(4*650,2*650),'#e5e5e5')
    for i,name in enumerate(names):
        im=render_points(GLB('public/models/titans/'+name+'.glb'),folder/(name+'.png'),size=650)
        sheet.paste(im,((i%4)*650,(i//4)*650))
    sheet.save(folder/'overview.png')
