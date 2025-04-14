import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

const CHUNK_SIZE = 121;
const MAX_VIEW_DISTANCE = 500;
const SEED = Math.random() * 1000.0;
const CHUNKS_VISIBLE_IN_VIEW_DISTANCE = Math.round(MAX_VIEW_DISTANCE / CHUNK_SIZE);

const chunksInScene = new Map();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const worker = new Worker('worker.js', { type: 'module' });
worker.onmessage = function (event) {
    const coordX = event.data["coordY"];
    const coordY = event.data["coordX"];
    const meshMap = event.data["meshMap"];

    const vertices = meshMap.get("vertices");
    const indices = meshMap.get("indices");

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        wireframe: true
    });

    const chunk = new THREE.Mesh(geometry, material);
    chunk.position.x = coordX * (CHUNK_SIZE - 1);
    chunk.position.y = coordY * (CHUNK_SIZE - 1);
    scene.add(chunk);

    const key = `${coordX},${coordY}`;
    chunksInScene.set(key, chunk);
};

function CreateChunk(coordX, coordY) {
    worker.postMessage({
        "coordX": coordX,
        "coordY": coordY
    });
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

            if (!chunksInScene.has(key)) {
                CreateChunk(viewedChunkCoordX, viewedChunkCoordY);
            }
        }
    }

    toDestroy.forEach(key => {
        let chunkToDestroy = chunksInScene.get(key);
        scene.remove(chunkToDestroy);
        chunksInScene.delete(key);
    });
}


camera.position.y = -80;
camera.position.z = 40;
camera.rotation.x = 1;
scene.fog = new THREE.Fog("#000000", MAX_VIEW_DISTANCE * .3, MAX_VIEW_DISTANCE * .7);

setInterval(UpdateChunks, 500);

function animate() {

    camera.position.y += .5;
    renderer.render(scene, camera);
}