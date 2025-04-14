import Prando from 'prando';
import * as THREE from 'three';
import { PerlinNoise } from './perlin.js';

const Perlin = new PerlinNoise();

const CHUNK_SIZE = 121;
const OCTAVES = 12;

const NOISE_SCALE = 100;
const NOISE_MULTIPLIER = 75;

const PERSISTENCE = 0.7;
const LACUNARITY = 1.7;
const CUTOFF = .4;

const terrainCurve = new THREE.CubicBezierCurve(
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.1, 0.01),
    new THREE.Vector2(0.2, 0.01),
    new THREE.Vector2(1, 1.5)
);

onmessage = function (event) {
    const coordX = event.data["coordX"];
    const coordY = event.data["coordY"];
    const seed = event.data["seed"];

    const posX = coordX * (CHUNK_SIZE - 1);
    const posY = coordY * (CHUNK_SIZE - 1);

    const noiseMap = GenerateNoiseMap(posX, posY, seed);
    let meshMap = GenerateMesh(noiseMap, 1);
    meshMap = RemoveLowTriangles(meshMap);

    postMessage({
        "meshMap": meshMap,
        "coordX": coordX,
        "coordY": coordY
    });
};

function GenerateNoiseMap(offsetX, offsetY, seed) {
    const noiseMap = new Array(CHUNK_SIZE).fill(0).map(() => new Array(CHUNK_SIZE).fill(0));
    const pnrg = new Prando(seed);

    const octaveOffsets = new Array(OCTAVES);

    let maxPossibleHeight = 0;
    let amplitude = 1;
    let frequency = 1;

    for (let i = 0; i < OCTAVES; i++) {
        const offsetXVal = pnrg.next(-100000, 100000) + offsetX;
        const offsetYVal = pnrg.next(-100000, 100000) - offsetY;
        octaveOffsets[i] = [offsetXVal, offsetYVal];

        maxPossibleHeight += amplitude;
        amplitude *= PERSISTENCE;
    }

    let scale = NOISE_SCALE;
    if (scale <= 0)
        scale = 0.0001;

    let maxLocalNoiseHeight = Number.MIN_VALUE;
    let minLocalNoiseHeight = Number.MAX_VALUE;

    const halfSize = CHUNK_SIZE / 2;

    for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
            amplitude = 1;
            frequency = 1;
            let noiseHeight = 0;

            for (let i = 0; i < OCTAVES; i++) {
                const sampleX = (x - halfSize + octaveOffsets[i][0]) / scale * frequency;
                const sampleY = (y - halfSize + octaveOffsets[i][1]) / scale * frequency;

                const perlinValue = Perlin.noise(sampleX, sampleY) * 2 - 1;
                noiseHeight += perlinValue * amplitude;

                amplitude *= PERSISTENCE;
                frequency *= LACUNARITY;
            }

            if (noiseHeight < 0) noiseHeight = 0;
            if (noiseHeight > maxLocalNoiseHeight) maxLocalNoiseHeight = noiseHeight;
            else if (noiseHeight < minLocalNoiseHeight) minLocalNoiseHeight = noiseHeight;

            noiseMap[x][y] = terrainCurve.getPoint(noiseHeight).y * NOISE_MULTIPLIER;
        }
    }

    for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
            let normalizedHeight = (noiseMap[x][y] + 1) / (maxPossibleHeight / 0.9);
            noiseMap[x][y] = Math.min(Math.max(normalizedHeight, 0), Number.MAX_SAFE_INTEGER);
        }
    }

    return noiseMap;
}


function GenerateMesh(noiseMap, LOD = 1) {
    const vertices = [];
    const indices = [];

    const size = noiseMap.length;
    const topLeftX = (size - 1) / -2.0;
    const topLeftY = (size - 1) / 2.0;

    const meshSimplificationIncrement = (LOD == 0) ? 1 : LOD * 2;
    const verticesPerLine = (size - 1) / meshSimplificationIncrement + 1;

    let vertexIndex = 0;
    for (let x = 0; x < size; x += meshSimplificationIncrement) {
        for (let y = 0; y < size; y += meshSimplificationIncrement) {
            let z = noiseMap[x][y];
            vertices.push(topLeftX + x, topLeftY - y, z);

            if (x < CHUNK_SIZE - 1 && y < CHUNK_SIZE - 1) {
                indices.push(vertexIndex, vertexIndex + verticesPerLine + 1, vertexIndex + verticesPerLine);
                indices.push(vertexIndex + verticesPerLine + 1, vertexIndex, vertexIndex + 1);
            }

            vertexIndex++;
        }
    }

    return new Map([
        ["vertices", vertices],
        ["indices", indices],
    ])
}

function RemoveLowTriangles(meshMap) {
    const vertices = meshMap.get("vertices");
    const indices = meshMap.get("indices");

    const newVertices = [];
    const newIndices = [];
    const indexMap = new Map();

    let newIndex = 0;
    for (let i = 0; i < indices.length; i += 3) {
        let v1 = indices[i];
        let v2 = indices[i + 1];
        let v3 = indices[i + 2];

        let z1 = vertices[v1 * 3 + 2];
        let z2 = vertices[v2 * 3 + 2];
        let z3 = vertices[v3 * 3 + 2];

        if (z1 >= CUTOFF && z2 >= CUTOFF && z3 >= CUTOFF) {
            for (let v of [v1, v2, v3]) {
                if (!indexMap.has(v)) {
                    indexMap.set(v, newIndex++);
                    newVertices.push(
                        vertices[v * 3],
                        vertices[v * 3 + 1],
                        vertices[v * 3 + 2]
                    );
                }
            }

            newIndices.push(indexMap.get(v1), indexMap.get(v2), indexMap.get(v3));
        }
    }

    return new Map([
        ["vertices", newVertices],
        ["indices", newIndices],
    ])
}