# JOE Titan character assets

The game loads these assets through src/titan-glb-models.js.

## Reference color pass — October 15, 2026

Armored, Attack, Beast, Colossal, Female and Founding use the supplied detailed meshes with embedded reference-guided vertex colors. These are portable glTF linear colors with neutral, nonmetallic PBR materials; separate texture files or UV coordinates are unnecessary. The color pass approximates the eight supplied pictures rather than reconstructing exact hand-painted textures.

armored_idle.glb is the standing model. armored_titan.glb retains its original skeleton, weights, inverse bind matrices and Run_Stealth animation, with identical colors and added vertex normals. Original geometry and existing normals are preserved. The native idle/run switching behavior is unchanged.

Jaw and War Hammer are the repository's earlier, simpler procedural placeholders. Their embedded base-color textures now use the reference palette, and their Z-up roots are rotated to the game's Y-up convention. Their geometry still differs substantially from the supplied voxel references. Detailed versions of those two meshes were not present in this repository.

Cart has no supplied reference and is unchanged.

Most detailed models remain unrigged source meshes. The game's existing automatic skinning remains an approximation, particularly for the Founding Titan. This color pass introduces no new animation and does not change polygon counts. Back colors are inferred because the references show one view per character.

See artifacts/titan-color-review/README.md for previews, validation and rebuild instructions. Original assets remain available in Git at commit 229e52f71d5ab5fb595aa5da03bf34bef635fe4d.
