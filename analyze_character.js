const fs = require('fs');
const path = require('path');

global.window = global;
global.self = global;
global.THREE = require(path.join(__dirname, 'public/js/three.min.js'));

// Load GLTFLoader
require(path.join(__dirname, 'public/js/GLTFLoader.js'));

const loader = new THREE.GLTFLoader();
const gltfContent = fs.readFileSync(path.join(__dirname, 'public/models/characters/Casual_Male.gltf'));

loader.parse(gltfContent.buffer, '', (gltf) => {
  const model = gltf.scene;
  const animations = gltf.animations;

  console.log('Model loaded successfully!');
  console.log('Animations found:', animations.map(a => a.name));

  // Compute bind pose bounding box
  const box = new THREE.Box3().setFromObject(model);
  console.log('\n--- BIND POSE BOUNDING BOX ---');
  console.log('Min:', box.min.x.toFixed(3), box.min.y.toFixed(3), box.min.z.toFixed(3));
  console.log('Max:', box.max.x.toFixed(3), box.max.y.toFixed(3), box.max.z.toFixed(3));
  console.log('Height:', (box.max.y - box.min.y).toFixed(3));

  // Animation mixer test
  const mixer = new THREE.AnimationMixer(model);

  // Function to sample lowest Y and bounding box over time for a clip
  function analyzeClip(clipName, duration, steps = 20) {
    const clip = animations.find(a => a.name === clipName);
    if (!clip) return;
    const action = mixer.clipAction(clip);
    action.play();

    let lowestY = Infinity;
    let highestY = -Infinity;
    let minBoxY = Infinity;
    let maxBoxY = -Infinity;

    console.log(`\n--- ANALYZING CLIP: ${clipName} (Duration: ${clip.duration.toFixed(2)}s) ---`);
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * clip.duration;
      mixer.setTime(t);
      model.updateMatrixWorld(true);

      const b = new THREE.Box3().setFromObject(model);
      if (b.min.y < minBoxY) minBoxY = b.min.y;
      if (b.max.y > maxBoxY) maxBoxY = b.max.y;

      if (i === 0 || i === Math.floor(steps/2) || i === steps) {
        console.log(`t = ${t.toFixed(2)}s: Box Y range = [${b.min.y.toFixed(3)}, ${b.max.y.toFixed(3)}], Center = [${((b.min.x+b.max.x)/2).toFixed(3)}, ${((b.min.y+b.max.y)/2).toFixed(3)}, ${((b.min.z+b.max.z)/2).toFixed(3)}]`);
      }
    }
    console.log(`Min Box Y across clip: ${minBoxY.toFixed(3)}, Max Box Y: ${maxBoxY.toFixed(3)}`);
    action.stop();
  }

  analyzeClip('Idle');
  analyzeClip('Walk');
  analyzeClip('Run');
  analyzeClip('SitDown');
}, (err) => {
  console.error('Error parsing GLTF:', err);
});
