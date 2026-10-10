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

  const uL = bones['UpperLegL'];
  const lL = bones['LowerLegL'];
  const footL = bones['FootL'];

  const uR = bones['UpperLegR'];
  const lR = bones['LowerLegR'];
  const footR = bones['FootR'];

  console.log('UpperLegL initial rot:', uL.rotation.x, uL.rotation.y, uL.rotation.z);
  console.log('UpperLegR initial rot:', uR.rotation.x, uR.rotation.y, uR.rotation.z);
  console.log('LowerLegL initial rot:', lL.rotation.x, lL.rotation.y, lL.rotation.z);
  console.log('LowerLegR initial rot:', lR.rotation.x, lR.rotation.y, lR.rotation.z);

  // Apply rotations
  uL.rotation.x += Math.PI / 2;
  lL.rotation.x -= Math.PI / 2;

  // Let's test uR and lR with same sign:
  uR.rotation.x += Math.PI / 2;
  lR.rotation.x -= Math.PI / 2;

  model.updateMatrixWorld(true);

  function getPos(b) {
    const v = new THREE.Vector3();
    b.getWorldPosition(v);
    return `X=${v.x.toFixed(2)}, Y=${v.y.toFixed(2)}, Z=${v.z.toFixed(2)}`;
  }

  console.log('\n--- AFTER POSE ---');
  console.log('Left Knee:', getPos(lL));
  console.log('Right Knee:', getPos(lR));
  console.log('Left Ankle:', getPos(footL));
  console.log('Right Ankle:', getPos(footR));
});
