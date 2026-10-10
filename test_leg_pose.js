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

  console.log('Testing leg bone rotations on bind pose:');
  const uL = bones['UpperLegL'];
  const lL = bones['LowerLegL'];
  const footL = bones['FootL'];
  const hips = bones['Hips'];

  console.log('UpperLegL initial rotation:', uL.rotation.x, uL.rotation.y, uL.rotation.z);
  console.log('LowerLegL initial rotation:', lL.rotation.x, lL.rotation.y, lL.rotation.z);
  console.log('FootL initial rotation:', footL.rotation.x, footL.rotation.y, footL.rotation.z);

  // Let's check the local axes of UpperLegL
  // In Quaternius armature:
  const vForward = new THREE.Vector3(0, 0, 1).applyQuaternion(uL.quaternion);
  const vUp = new THREE.Vector3(0, 1, 0).applyQuaternion(uL.quaternion);
  console.log('UpperLegL forward vector:', vForward.x.toFixed(2), vForward.y.toFixed(2), vForward.z.toFixed(2));
  console.log('UpperLegL up vector:', vUp.x.toFixed(2), vUp.y.toFixed(2), vUp.z.toFixed(2));
});
