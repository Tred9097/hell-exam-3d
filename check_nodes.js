const fs = require('fs');
const gltf = JSON.parse(fs.readFileSync('public/models/characters/Casual_Male.gltf', 'utf-8'));
gltf.nodes.forEach((n, i) => {
  console.log(`Node ${i}: ${n.name}, translation=${JSON.stringify(n.translation)}, rotation=${JSON.stringify(n.rotation)}, scale=${JSON.stringify(n.scale)}`);
});
