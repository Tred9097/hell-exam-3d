const fs = require('fs');
const path = require('path');

global.window = global;
global.self = global;
global.THREE = require(path.join(__dirname, 'public/js/three.min.js'));
require(path.join(__dirname, 'public/js/GLTFLoader.js'));

const loader = new THREE.GLTFLoader();

['Casual_Male.gltf', 'Doctor_Male_Young.gltf', 'Ninja_Male.gltf', 'Cowboy_Male.gltf', 'Wizard.gltf'].forEach(file => {
  const buf = fs.readFileSync(path.join(__dirname, 'public/models/characters', file));
  loader.parse(buf.buffer, '', (gltf) => {
    console.log(`\n=== MATERIALS IN ${file} ===`);
    const mats = new Set();
    gltf.scene.traverse(c => {
      if (c.isMesh && c.material) {
        if (Array.isArray(c.material)) {
          c.material.forEach(m => mats.add(m.name + ' (color=' + m.color.getHexString() + ')'));
        } else {
          mats.add(c.material.name + ' (color=' + c.material.color.getHexString() + ')');
        }
      }
    });
    console.log(Array.from(mats));
  });
});
