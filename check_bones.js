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
  const animations = gltf.animations;

  const bones = [];
  model.traverse(c => {
    if (c.isBone) bones.push(c);
  });
  console.log(`Found ${bones.length} bones:`, bones.map(b => b.name));

  const mixer = new THREE.AnimationMixer(model);

  function checkBonesInClip(clipName) {
    const clip = animations.find(a => a.name === clipName);
    if (!clip) return;
    const action = mixer.clipAction(clip);
    action.play();

    console.log(`\n=================== BONES IN ${clipName} ===================`);
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * clip.duration;
      mixer.setTime(t);
      model.updateMatrixWorld(true);

      const footL = bones.find(b => b.name === 'FootL');
      const footR = bones.find(b => b.name === 'FootR');
      const hips = bones.find(b => b.name === 'Hips');
      const root = bones.find(b => b.name === 'Bone' || b.name === 'CharacterArmature' || b.name === 'Body');

      const vFootL = new THREE.Vector3(); footL.getWorldPosition(vFootL);
      const vFootR = new THREE.Vector3(); footR.getWorldPosition(vFootR);
      const vHips = new THREE.Vector3(); hips.getWorldPosition(vHips);

      console.log(`t=${t.toFixed(2)}s | Foot.L Y=${vFootL.y.toFixed(3)}, Z=${vFootL.z.toFixed(3)} | Foot.R Y=${vFootR.y.toFixed(3)}, Z=${vFootR.z.toFixed(3)} | Hips Y=${vHips.y.toFixed(3)}, Z=${vHips.z.toFixed(3)}`);
    }
    action.stop();
  }

  checkBonesInClip('Idle');
  checkBonesInClip('Walk');
  checkBonesInClip('SitDown');
});
