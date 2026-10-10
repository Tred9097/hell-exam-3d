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

  // Test setSkinColor
  const skinColor = '#8d5524';
  const col = new THREE.Color(skinColor);
  let changedMats = 0;
  model.traverse(child => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => {
        if (m.name && m.name.toLowerCase().includes('skin')) {
          m.color.copy(col);
          changedMats++;
          console.log(`Updated material ${m.name} to color ${m.color.getHexString()}`);
        }
      });
    }
  });

  console.log(`Changed ${changedMats} skin materials to ${skinColor}`);

  // Test procedural leg bending in animate loop
  const mixer = new THREE.AnimationMixer(model);
  const idle = mixer.clipAction(gltf.animations.find(a => a.name === 'Idle'));
  idle.play();

  const bones = {};
  model.traverse(c => { if (c.isBone) bones[c.name] = c; });

  const uL = bones['UpperLegL'];
  const uR = bones['UpperLegR'];
  const lL = bones['LowerLegL'];
  const lR = bones['LowerLegR'];

  for (let step = 0; step < 5; step++) {
    mixer.update(0.1);
    // Apply sitting pose after mixer update
    uL.rotation.x += Math.PI / 2;
    uR.rotation.x += Math.PI / 2;
    lL.rotation.x -= Math.PI / 2;
    lR.rotation.x -= Math.PI / 2;
    model.updateMatrixWorld(true);

    const vKnee = new THREE.Vector3(); lL.getWorldPosition(vKnee);
    const vAnkle = new THREE.Vector3(); bones['FootL'].getWorldPosition(vAnkle);
    console.log(`Step ${step}: Knee Y=${vKnee.y.toFixed(2)}, Z=${vKnee.z.toFixed(2)} | Ankle Y=${vAnkle.y.toFixed(2)}, Z=${vAnkle.z.toFixed(2)}`);
  }
});
