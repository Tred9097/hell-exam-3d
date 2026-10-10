const fs = require('fs');
const path = require('path');

global.window = global;
global.self = global;
global.THREE = require(path.join(__dirname, 'public/js/three.min.js'));
require(path.join(__dirname, 'public/js/GLTFLoader.js'));

const loader = new THREE.GLTFLoader();
const modelsDir = path.join(__dirname, 'public/models/characters');
const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.gltf'));

console.log(`Checking ${files.length} GLTF models...`);

async function testAll() {
  for (const file of files) {
    const gltfContent = fs.readFileSync(path.join(modelsDir, file));
    await new Promise((resolve) => {
      loader.parse(gltfContent.buffer, '', (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        let minVertexY = Infinity;
        model.traverse(c => {
          if (c.isMesh && c.geometry && c.geometry.attributes.position) {
            const p = c.geometry.attributes.position;
            for (let i = 0; i < p.count; i++) {
              const y = p.getY(i);
              if (y < minVertexY) minVertexY = y;
            }
          }
        });
        if (box.min.y < -0.05 || minVertexY < -0.05) {
          console.log(`Model ${file}: box.min.y=${box.min.y.toFixed(3)}, minVertexY=${minVertexY.toFixed(3)}`);
        }
        resolve();
      });
    });
  }
  console.log('Done checking models.');
}

testAll();
