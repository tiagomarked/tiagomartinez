import * as THREE from 'three';
import { GenerateMeshMaps } from './worker';

const canvas = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

renderer.setAnimationLoop(Update);
document.body.appendChild(renderer.domElement);

const CHUNK_SIZE = 121;
const MAX_VIEW_DISTANCE = 1200;
const SEED = Math.random() * 1000.0;
const CHUNKS_VISIBLE_IN_VIEW_DISTANCE = Math.round(MAX_VIEW_DISTANCE / CHUNK_SIZE);

const chunksInScene = new Map();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 800);
const generatingChunks = [];

window.addEventListener('resize', OnWindowResize, false);
function OnWindowResize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
}

function UpdateChunks(async = true) {
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
                CreateChunk(viewedChunkCoordX, viewedChunkCoordY, async);
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

function CreateChunk(coordX, coordY, async = true) {
    const key = `${coordX},${coordY}`;
    generatingChunks.push(key);
    if (async) {
        worker.postMessage({
            "coordX": coordX,
            "coordY": coordY,
            "seed": SEED,
            "chunkSize": CHUNK_SIZE,
        });
    }
    else {
        const data = GenerateMeshMaps(coordX, coordY, SEED, CHUNK_SIZE);
        ApplyChunkData(data);
    }
}

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
worker.onmessage = function (event) {
    ApplyChunkData(event.data);
};

function ApplyChunkData(data) {
    const coordX = data.get("coordX");
    const coordY = data.get("coordY");
    const topMeshMap = data.get("topMeshMap");
    const botMeshMap = data.get("botMeshMap");

    const chunkX = coordX * (CHUNK_SIZE - 1);
    const chunkY = coordY * (CHUNK_SIZE - 1);
    const botChunk = AddChunk(botMeshMap, chunkX, chunkY, "orange", true);
    const topChunk = AddChunk(topMeshMap, chunkX, chunkY, 0x00ff00);

    const key = `${coordX},${coordY}`;
    chunksInScene.set(key, topChunk);

    const index = generatingChunks.indexOf(key);
    if (index !== -1)
        generatingChunks.splice(index, 1);
}

function AddChunk(meshMap, x, y, color, flip = false) {
    const vertices = meshMap.get("vertices");
    const indices = meshMap.get("indices");

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshPhongMaterial({
        color: color,
        shininess: 0,
    });

    const chunk = new THREE.Mesh(geometry, material);
    chunk.position.x = x;
    chunk.position.y = y;
    scene.add(chunk);

    return chunk;
}

camera.position.set(0, 0, 40);
camera.rotation.x = 1;

const backgroundColor = "#baffe0";
scene.fog = new THREE.Fog(backgroundColor, MAX_VIEW_DISTANCE * .3, MAX_VIEW_DISTANCE * .7);
scene.background = new THREE.Color(backgroundColor);

const topLight = new THREE.DirectionalLight(0xFFFFFF, 3);
topLight.position.set(0, 0, 40);
topLight.rotation.set(1, 0, 0);
scene.add(topLight);

const botLight = new THREE.DirectionalLight(0xFFFFFF, 2);
botLight.position.set(0, 0, -40);
botLight.rotation.set(-1, 0, 0);
scene.add(botLight);


UpdateChunks(false);
function Update() {
    UpdateChunks();
    camera.position.y += 1
    renderer.render(scene, camera);
}