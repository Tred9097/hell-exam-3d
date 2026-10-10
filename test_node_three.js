// Test script to run in Node.js to evaluate Quaternius animations with Three.js
const fs = require('fs');
const path = require('path');

// Simulate basic browser globals needed for Three.js
global.window = global;
global.self = global;

const THREE = require(path.join(__dirname, 'public/js/three.min.js'));
global.THREE = THREE;

// We can load GLTF using custom node loader or parse
console.log('THREE loaded:', THREE.REVISION);
