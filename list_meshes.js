const fs = require('fs');
const path = require('path');

global.window = global;
global.self = global;
global.THREE = require(path.join(__dirname, 'public/js/three.min.js'));
require(path.join(__dirname, 'public/js/GLTFLoader.js'));

const loader = new THREE.GLTFLoader();
const gltfContent = fs.readFileSync(path.join(__dirname, 'public/models/characters/Casual_Male.gltf'));

loader.parse(gltfContent.buffer, '', (gltf) => {
  const model = gltf.scene;
  const meshes = [];
  model.traverse(c => {
    if (c.isMesh) meshes.push(c);
  });
  console.log(`Found ${meshes.length} meshes:`);
  meshes.forEach((m, idx) => {
    console.log(`Mesh ${idx}: ${m.name}, isSkinned=${m.isSkinnedMesh}, vertexCount=${m.geometry.attributes.position.count}`);
    const box = new THREE.Box3().setFromObject(m);
    console.log(`   box: min Y=${box.min.y.toFixed(3)}, max Y=${box.max.y.toFixed(3)}`);
  });
});
