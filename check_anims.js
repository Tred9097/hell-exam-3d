const fs = require('fs');
const gltf = JSON.parse(fs.readFileSync('public/models/characters/Casual_Male.gltf', 'utf-8'));

function inspectAnimation(animName) {
  const anim = gltf.animations.find(a => a.name === animName);
  if (!anim) {
    console.log(`Animation ${animName} not found`);
    return;
  }
  console.log(`\n=================== ANIMATION: ${animName} ===================`);
  // Channels
  anim.channels.forEach(ch => {
    const sampler = anim.samplers[ch.sampler];
    const node = gltf.nodes[ch.target.node];
    const inputAcc = gltf.accessors[sampler.input];
    const outputAcc = gltf.accessors[sampler.output];
    if (ch.target.path === 'translation') {
      console.log(`Node ${ch.target.node} (${node ? node.name : '?'}) translation:`);
      console.log(`  time: min=${inputAcc.min[0]}, max=${inputAcc.max[0]}`);
      console.log(`  min=${JSON.stringify(outputAcc.min)}, max=${JSON.stringify(outputAcc.max)}`);
    }
  });
}

inspectAnimation('Idle');
inspectAnimation('Walk');
inspectAnimation('SitDown');
