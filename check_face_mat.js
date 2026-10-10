const fs = require('fs');
const path = require('path');

global.window = global;
global.self = global;
global.THREE = require(path.join(__dirname, 'public/js/three.min.js'));
require(path.join(__dirname, 'public/js/GLTFLoader.js'));

const loader = new THREE.GLTFLoader();
const buf = fs.readFileSync(path.join(__dirname, 'public/models/characters/Casual_Male.gltf'));

loader.parse(buf.buffer, '', (gltf) => {
  gltf.scene.traverse(c => {
    if (c.isMesh && c.material) {
      const mat = c.material;
      if (mat.name === 'Face') {
        console.log('Face Material details:');
        console.log('  type:', mat.type);
        console.log('  color:', mat.color.getHexString());
        console.log('  map:', mat.map ? 'Has texture map' : 'No texture map');
      }
    }
  });
});
