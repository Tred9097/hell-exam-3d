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

  let skinnedMesh = null;
  model.traverse(c => {
    if (c.isSkinnedMesh && !skinnedMesh) skinnedMesh = c;
  });

  const geom = skinnedMesh.geometry;
  const posAttr = geom.attributes.position;
  const skinIndexAttr = geom.attributes.skinIndex;
  const skinWeightAttr = geom.attributes.skinWeight;
  const skeleton = skinnedMesh.skeleton;
  const mixer = new THREE.AnimationMixer(model);

  function getLowestVertexY() {
    let minY = Infinity;
    const vertex = new THREE.Vector3();
    const tempMatrix = new THREE.Matrix4();
    const skinnedVertex = new THREE.Vector3();

    skeleton.update();
    for (let i = 0; i < posAttr.count; i++) {
      vertex.fromBufferAttribute(posAttr, i);
      skinnedVertex.set(0, 0, 0);
      for (let j = 0; j < 4; j++) {
        let weight = 0;
        let boneIndex = 0;
        if (j === 0) { weight = skinWeightAttr.getX(i); boneIndex = skinIndexAttr.getX(i); }
        else if (j === 1) { weight = skinWeightAttr.getY(i); boneIndex = skinIndexAttr.getY(i); }
        else if (j === 2) { weight = skinWeightAttr.getZ(i); boneIndex = skinIndexAttr.getZ(i); }
        else if (j === 3) { weight = skinWeightAttr.getW(i); boneIndex = skinIndexAttr.getW(i); }
        if (weight === 0) continue;
        const bone = skeleton.bones[boneIndex];
        tempMatrix.multiplyMatrices(bone.matrixWorld, skeleton.boneInverses[boneIndex]);
        const v = vertex.clone().applyMatrix4(tempMatrix);
        skinnedVertex.addScaledVector(v, weight);
      }
      if (skinnedVertex.y < minY) {
        minY = skinnedVertex.y;
      }
    }
    return minY;
  }

  const walkClip = animations.find(a => a.name === 'Walk');
  const action = mixer.clipAction(walkClip);
  action.play();

  const totalFrames = 30;
  for (let f = 0; f <= totalFrames; f++) {
    const t = (f / totalFrames) * walkClip.duration;
    mixer.setTime(t);
    model.updateMatrixWorld(true);
    const lowY = getLowestVertexY();
    console.log(`Frame ${f} (t=${t.toFixed(2)}s): lowest Y = ${lowY.toFixed(4)} -> scaled(0.44)=${(lowY*0.44).toFixed(4)}m`);
  }
});
