"""Verify every original geometry/rig/animation accessor against a Git baseline."""
import json
import subprocess
import struct
import sys
import numpy as np
from titan_asset_tools import GLB,DTYPES,WIDTHS

baseline=sys.argv[1] if len(sys.argv)>1 else '229e52f71d5ab5fb595aa5da03bf34bef635fe4d'
names=['armored_idle','armored_titan','attack_titan','beast_titan','colossal_titan','female_titan','founding_titan','jaw_titan','war_hammer_titan']

def original(name):
    raw=subprocess.check_output(['git','show',baseline+':public/models/titans/'+name+'.glb'])
    length=struct.unpack_from('<I',raw,12)[0]
    return json.loads(raw[20:20+length]),raw[28+length:]

def array(doc,binary,index):
    a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];dtype=np.dtype(DTYPES[a['componentType']]);width=WIDTHS[a['type']]
    return np.ndarray((a['count'],width),dtype=dtype,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',width*dtype.itemsize),dtype.itemsize))

for name in names:
    old,binary=original(name);new=GLB('public/models/titans/'+name+'.glb')
    for oldmesh,newmesh in zip(old['meshes'],new.doc['meshes'],strict=True):
        for before,after in zip(oldmesh['primitives'],newmesh['primitives'],strict=True):
            assert np.array_equal(array(old,binary,before['indices']),new.array(after['indices'])),name+' indices'
            for semantic,index in before['attributes'].items():
                if semantic=='COLOR_0':continue
                assert np.array_equal(array(old,binary,index),new.array(after['attributes'][semantic])),name+' '+semantic
    for key in ['skins','animations']:
        assert old.get(key)==new.doc.get(key),name+' '+key
    for animation in old.get('animations',[]):
        for sampler in animation['samplers']:
            for key in ['input','output']:
                assert np.array_equal(array(old,binary,sampler[key]),new.array(sampler[key])),name+' animation '+key
    for skin in old.get('skins',[]):
        index=skin.get('inverseBindMatrices')
        if index is not None:assert np.array_equal(array(old,binary,index),new.array(index)),name+' inverse bind matrices'
    if name not in ('jaw_titan','war_hammer_titan'):assert old['nodes']==new.doc['nodes'],name+' skeleton transforms'
    print(name+': original geometry, rig weights and animation data preserved')
print('PASS: all nine colored GLBs preserve their original mesh data.')
