const fs = require('fs');
const path = require('path');

global.window = global;
global.self = global;
global.THREE = require(path.join(__dirname, 'public/js/three.min.js'));
require(path.join(__dirname, 'public/js/GLTFLoader.js'));

const loader = new THREE.GLTFLoader();

function checkModelBonesAndBounds(modelFile) {
  const gltfContent = fs.readFileSync(path.join(__dirname, 'public/models/characters', modelFile));
  loader.parse(gltfContent.buffer, '', (gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    console.log(`\n=== ${modelFile} ===`);
    console.log(`Raw Box: Min Y=${box.min.y.toFixed(3)}, Max Y=${box.max.y.toFixed(3)}, Center Y=${((box.min.y+box.max.y)/2).toFixed(3)}`);
    
    // Check Idle animation
    const clip = gltf.animations.find(a => a.name === 'Idle') || gltf.animations.find(a => a.name === 'Walk');
    if (clip) {
      const mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(clip);
      action.play();
      mixer.setTime(0.5);
      model.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(model);
      console.log(`Anim Box (t=0.5s): Min Y=${b2.min.y.toFixed(3)}, Max Y=${b2.max.y.toFixed(3)}`);
    }
  });
}

['Casual_Male.gltf', 'Cow.gltf', 'Pug.gltf', 'Knight_Male.gltf', 'Ninja_Male.gltf', 'Doctor_Male_Young.gltf'].forEach(checkModelBonesAndBounds);
