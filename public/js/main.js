import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

const CHUNK_SIZE = 121;
const MAX_VIEW_DISTANCE = 600;
const SEED = Math.random() * 1000.0;
const CHUNKS_VISIBLE_IN_VIEW_DISTANCE = Math.round(MAX_VIEW_DISTANCE / CHUNK_SIZE);

const chunksInScene = new Map();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const generatingChunks = [];


window.addEventListener('resize', OnWindowResize, false);
function OnWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function UpdateChunks() {
    let chunkSize = CHUNK_SIZE - 1;
    let currentChunkCoordX = Math.round(camera.position.x / chunkSize);
    let currentChunkCoordY = Math.round(camera.position.y / chunkSize);

    let toDestroy = Array.from(chunksInScene.keys());

    for (let yOffset = -CHUNKS_VISIBLE_IN_VIEW_DISTANCE; yOffset < CHUNKS_VISIBLE_IN_VIEW_DISTANCE; yOffset++) {
        for (let xOffset = -CHUNKS_VISIBLE_IN_VIEW_DISTANCE; xOffset < CHUNKS_VISIBLE_IN_VIEW_DISTANCE; xOffset++) {
            const viewedChunkCoordX = currentChunkCoordX + xOffset;
            const viewedChunkCoordY = currentChunkCoordY + yOffset;
            const key = `${viewedChunkCoordX},${viewedChunkCoordY}`;

            let removeIndex = toDestroy.indexOf(key);
            toDestroy.splice(removeIndex, 1);

            if (!chunksInScene.has(key) && generatingChunks.indexOf(key) == -1) {
                CreateChunk(viewedChunkCoordX, viewedChunkCoordY);
            }
        }
    }

    toDestroy.forEach(key => {
        const removeIndex = toDestroy.indexOf(key);
        if (removeIndex !== -1) {
            toDestroy.splice(removeIndex, 1);
            chunksInScene.delete(key);
        }
    });
}

function CreateChunk(coordX, coordY) {
    const key = `${coordX},${coordY}`;
    generatingChunks.push(key);
    worker.postMessage({
        "coordX": coordX,
        "coordY": coordY,
        "seed": SEED
    });
}

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
worker.onmessage = function (event) {
    const coordX = event.data["coordX"];
    const coordY = event.data["coordY"];

    const topMeshMap = event.data["topMeshMap"];
    const botMeshMap = event.data["botMeshMap"];

    const chunkX = coordX * (CHUNK_SIZE - 1);
    const chunkY = coordY * (CHUNK_SIZE - 1);
    const topChunk = AddChunk(topMeshMap, chunkX, chunkY, 0x00ff00);
    const botChunk = AddChunk(botMeshMap, chunkX, chunkY, "orange");

    const key = `${coordX},${coordY}`;
    chunksInScene.set(key, topChunk);

    const index = generatingChunks.indexOf(key);
    if (index !== -1)
        generatingChunks.splice(index, 1);
};

function AddChunk(meshMap, x, y, color) {
    const vertices = meshMap.get("vertices");
    const indices = meshMap.get("indices");

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
        color: color,
        //wireframe: true,
    });

    const chunk = new THREE.Mesh(geometry, material);
    chunk.position.x = x;
    chunk.position.y = y;
    scene.add(chunk);

    return chunk;
}


camera.position.y = -80;
camera.position.z = 40;
camera.rotation.x = 1;
scene.fog = new THREE.Fog("#000000", MAX_VIEW_DISTANCE * .3, MAX_VIEW_DISTANCE * .7);

function animate() {
    UpdateChunks();
    camera.position.y += 1;
    renderer.render(scene, camera);
}