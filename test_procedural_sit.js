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
  const bones = {};
  model.traverse(c => {
    if (c.isBone) bones[c.name] = c;
  });

  const mixer = new THREE.AnimationMixer(model);
  const idleClip = gltf.animations.find(a => a.name === 'Idle');
  const action = mixer.clipAction(idleClip);
  action.play();

  mixer.setTime(0.5);
  model.updateMatrixWorld(true);

  console.log('--- BEFORE CUSTOM POSE ---');
  const uL = bones['UpperLegL'];
  const lL = bones['LowerLegL'];
  const footL = bones['FootL'];
  const hips = bones['Hips'];

  function getPos(b) {
    const v = new THREE.Vector3();
    b.getWorldPosition(v);
    return `X=${v.x.toFixed(2)}, Y=${v.y.toFixed(2)}, Z=${v.z.toFixed(2)}`;
  }

  console.log('Hips:', getPos(hips));
  console.log('UpperLegL:', getPos(uL));
  console.log('LowerLegL (Knee):', getPos(lL));
  console.log('FootL (Ankle):', getPos(footL));

  // Try rotating UpperLeg forward by 90 deg around local X or Z
  // Let's test rotation around X:
  uL.rotation.x += Math.PI / 2;
  // LowerLeg back by 90 deg:
  lL.rotation.x -= Math.PI / 2;

  model.updateMatrixWorld(true);
  console.log('\n--- AFTER ROTATING UpperLeg +90 deg X, LowerLeg -90 deg X ---');
  console.log('Hips:', getPos(hips));
  console.log('UpperLegL:', getPos(uL));
  console.log('LowerLegL (Knee):', getPos(lL));
  console.log('FootL (Ankle):', getPos(footL));
});
