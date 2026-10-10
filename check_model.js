const fs = require('fs');
const path = require('path');

// Đọc model Casual_Male.gltf
const gltfPath = path.join(__dirname, 'public/models/characters/Casual_Male.gltf');
const gltfData = JSON.parse(fs.readFileSync(gltfPath, 'utf-8'));

console.log('Meshes count:', gltfData.meshes ? gltfData.meshes.length : 0);
console.log('Nodes count:', gltfData.nodes ? gltfData.nodes.length : 0);
console.log('Animations:', gltfData.animations ? gltfData.animations.map(a => a.name) : []);

// Check accessors for min and max bounds
if (gltfData.accessors) {
  console.log('\n--- POSITION ACCESSORS MIN / MAX ---');
  gltfData.meshes.forEach((mesh, mIdx) => {
    console.log(`Mesh ${mIdx} (${mesh.name}):`);
    mesh.primitives.forEach((prim, pIdx) => {
      const posAccIdx = prim.attributes.POSITION;
      const acc = gltfData.accessors[posAccIdx];
      console.log(`  Primitive ${pIdx}: min=${JSON.stringify(acc.min)}, max=${JSON.stringify(acc.max)}`);
    });
  });
}
