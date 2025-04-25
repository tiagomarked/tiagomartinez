import * as THREE from 'three';
import { ChunkData } from './worker';

const WORKERS = [];
const NUM_WORKERS = 6;
let currentWorker = 0;
for (let i = 0; i < NUM_WORKERS; i++) {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = function (event) {
        ApplyChunkData(event.data);
    };
    WORKERS.push(worker);
}

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

class Chunk {
    constructor(chunkData) {
        this.data = chunkData;
        this.botMesh = this.CreateMesh(this.data.underIndices, this.data.underVertices, "orange", true);
        this.topMesh = this.CreateMesh(this.data.indices, this.data.vertices, 0x00ff00);
    }

    CreateMesh(indices, vertices, color, flip = false) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const material = new THREE.MeshPhongMaterial({
            color: color,
            shininess: 0,
        });

        const chunk = new THREE.Mesh(geometry, material);
        chunk.position.x = this.data.posX;
        chunk.position.y = this.data.posY;
        scene.add(chunk);

        return chunk;
    }

    Destroy() {
        scene.remove(this.botMesh);
        scene.remove(this.topMesh);
    }
}

window.addEventListener('resize', OnWindowResize, false);
function OnWindowResize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
}

function UpdateChunks(async = true, yOffset = -1, xOffset = -1) {
    let chunkSize = CHUNK_SIZE - 1;
    let currentChunkCoordX = Math.round(camera.position.x / chunkSize);
    let currentChunkCoordY = Math.round(camera.position.y / chunkSize);

    let toDestroy = Array.from(chunksInScene.keys());

    yOffset = yOffset == -1 ? CHUNKS_VISIBLE_IN_VIEW_DISTANCE : yOffset;
    xOffset = xOffset == -1 ? CHUNKS_VISIBLE_IN_VIEW_DISTANCE : xOffset;

    for (let y = -yOffset; y < yOffset; y++) {
        for (let x = -xOffset; x < xOffset; x++) {
            const viewedChunkCoordX = currentChunkCoordX + x;
            const viewedChunkCoordY = currentChunkCoordY + y;
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
            chunksInScene.get(key).Destroy();
            toDestroy.splice(removeIndex, 1);
            chunksInScene.delete(key);
        }
    });
}

function CreateChunk(coordX, coordY, async = true) {
    const key = `${coordX},${coordY}`;
    generatingChunks.push(key);
    if (async) {

        let workerIndex = currentWorker + 1;
        if (workerIndex >= NUM_WORKERS)
            workerIndex = 0;

        const worker = WORKERS[workerIndex];
        
        worker.postMessage({
            "coordX": coordX,
            "coordY": coordY,
            "seed": SEED,
            "chunkSize": CHUNK_SIZE,
        });

        currentWorker = workerIndex;
    }
    else {
        const data = new ChunkData(coordX, coordY, CHUNK_SIZE, SEED);
        ApplyChunkData(data);
    }
}

function ApplyChunkData(chunkData) {
    const chunk = new Chunk(chunkData);

    const key = `${chunkData.coordX},${chunkData.coordY}`;
    chunksInScene.set(key, chunk);

    const index = generatingChunks.indexOf(key);
    if (index !== -1)
        generatingChunks.splice(index, 1);
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
botLight.rotation.set(0, 0, 0);
scene.add(botLight);

function Update() {
    UpdateChunks();
    camera.position.y += 1;
    renderer.render(scene, camera);
}