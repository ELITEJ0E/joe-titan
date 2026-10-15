# Titan GLB character assets

Nine individual GLB models with embedded PBR base-color, metallic-roughness and neutral normal textures are stored here. The seven reference-based models are Armored, Colossal, Female, Beast, Cart, War Hammer, Founding. Attack and Jaw are supplemental approximations, since no reference images for them were provided.

Runtime: src/titan-glb-models.js loads these through GLTFLoader and shows existing voxel meshes while loading or when an asset fails. The original gameplay rig, damage/weak spots, movement and abilities remain intact. GLBs are static, unrigged approximations; only whole-body motions are supported until skinning/animations are built.

Source generators: scripts/build_titan_glbs.py and scripts/build_attack_jaw.py (Python dependencies: trimesh, numpy, pillow). The GLBs are committed directly; running these scripts is not required for gameplay.
