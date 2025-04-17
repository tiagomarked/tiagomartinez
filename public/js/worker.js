import Prando from 'prando';
import * as THREE from 'three';
import { PerlinNoise } from './perlin.js';

const Perlin = new PerlinNoise();

const OCTAVES = 12;
const NOISE_SCALE = 100;
const NOISE_MULTIPLIER = 75;

const PERSISTENCE = 0.7;
const LACUNARITY = 1.7;
const CUTOFF = .6;

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
    const chunkSize = event.data["chunkSize"];
    const data = GenerateMeshMaps(coordX, coordY, seed, chunkSize);
    postMessage(data);
};

export function GenerateMeshMaps(coordX, coordY, seed, chunkSize) {
    const posX = coordX * (chunkSize - 1);
    const posY = coordY * (chunkSize - 1);

    const noiseMap = GenerateNoiseMap(posX, posY, seed, chunkSize);
    let topMeshMap = GenerateMesh(noiseMap, chunkSize, 1);
    topMeshMap = RemoveLowTriangles(topMeshMap);
    topMeshMap = RemoveDisconnectedTriangles(topMeshMap, 20);
    const botMeshMap = GenerateUnderMesh(new Map(topMeshMap));
    return new Map([
        ["topMeshMap", topMeshMap],
        ["botMeshMap", botMeshMap],
        ["coordX", coordX],
        ["coordY", coordY]
    ]
    );
}

function GenerateNoiseMap(offsetX, offsetY, seed, chunkSize) {
    const noiseMap = new Array(chunkSize).fill(0).map(() => new Array(chunkSize).fill(0));
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

    const halfSize = chunkSize / 2;

    for (let y = 0; y < chunkSize; y++) {
        for (let x = 0; x < chunkSize; x++) {
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

    for (let y = 0; y < chunkSize; y++) {
        for (let x = 0; x < chunkSize; x++) {
            let normalizedHeight = (noiseMap[x][y] + 1) / (maxPossibleHeight / 0.9);
            noiseMap[x][y] = Math.min(Math.max(normalizedHeight, 0), Number.MAX_SAFE_INTEGER);
        }
    }

    return noiseMap;
}


function GenerateMesh(noiseMap, chunkSize, LOD = 1) {
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

            if (x < chunkSize - 1 && y < chunkSize - 1) {
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
    const triangleCount = new Map();

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

            const nv1 = indexMap.get(v1);
            const nv2 = indexMap.get(v2);
            const nv3 = indexMap.get(v3);
            newIndices.push(nv1, nv2, nv3);
            for (let v of [nv1, nv2, nv3]) {
                triangleCount.set(v, (triangleCount.get(v) || 0) + 1);
            }
        }
    }

    return new Map([
        ["vertices", newVertices],
        ["indices", newIndices],
        ["triangleCount", triangleCount],
    ])
}

function RemoveDisconnectedTriangles(meshMap, minTrianglesPerIsland = 2) {
    const vertices = meshMap.get("vertices");
    const indices = meshMap.get("indices");
    const triangleCount = indices.length / 3;

    const edgeMap = new Map(); // "v1,v2" → [triangle indices]

    function getEdgeKey(a, b) {
        return a < b ? `${a},${b}` : `${b},${a}`;
    }

    for (let i = 0; i < triangleCount; i++) {
        const v = [
            indices[i * 3],
            indices[i * 3 + 1],
            indices[i * 3 + 2],
        ];

        const edges = [
            getEdgeKey(v[0], v[1]),
            getEdgeKey(v[1], v[2]),
            getEdgeKey(v[2], v[0]),
        ];

        for (const edge of edges) {
            if (!edgeMap.has(edge)) edgeMap.set(edge, []);
            edgeMap.get(edge).push(i);
        }
    }

    const triNeighbors = new Map(); // triangle index → set of neighbor indices

    for (let [_, tris] of edgeMap.entries()) {
        if (tris.length < 2) continue;
        for (let i = 0; i < tris.length; i++) {
            for (let j = i + 1; j < tris.length; j++) {
                const a = tris[i];
                const b = tris[j];
                if (!triNeighbors.has(a)) triNeighbors.set(a, new Set());
                if (!triNeighbors.has(b)) triNeighbors.set(b, new Set());
                triNeighbors.get(a).add(b);
                triNeighbors.get(b).add(a);
            }
        }
    }

    const visited = new Set();
    const components = [];

    for (let i = 0; i < triangleCount; i++) {
        if (visited.has(i)) continue;

        const stack = [i];
        const component = [];

        while (stack.length > 0) {
            const tri = stack.pop();
            if (visited.has(tri)) continue;

            visited.add(tri);
            component.push(tri);

            const neighbors = triNeighbors.get(tri) || [];
            for (const n of neighbors) {
                if (!visited.has(n)) stack.push(n);
            }
        }

        if (component.length >= minTrianglesPerIsland) {
            components.push(component);
        }
    }

    const newVertices = [];
    const newIndices = [];
    const indexMap = new Map();
    let newIndexCounter = 0;

    for (const component of components) {
        for (const tri of component) {
            const triVerts = [];
            for (let j = 0; j < 3; j++) {
                const oldIndex = indices[tri * 3 + j];
                if (!indexMap.has(oldIndex)) {
                    const x = vertices[oldIndex * 3];
                    const y = vertices[oldIndex * 3 + 1];
                    const z = vertices[oldIndex * 3 + 2];

                    newVertices.push(x, y, z);
                    indexMap.set(oldIndex, newIndexCounter++);
                }
                triVerts.push(indexMap.get(oldIndex));
            }
            newIndices.push(...triVerts);
        }
    }

    const newTriangleCount = new Map();
    for (let i = 0; i < newIndices.length; i++) {
        const v = newIndices[i];
        newTriangleCount.set(v, (newTriangleCount.get(v) || 0) + 1);
    }

    return new Map([
        ["vertices", newVertices],
        ["indices", newIndices],
        ["triangleCount", newTriangleCount],
    ])
}


function GenerateUnderMesh(meshMap) {
    const vertices = Array.from(meshMap.get("vertices"));
    const indices = meshMap.get("indices");
    const triangleCount = meshMap.get("triangleCount");

    for (let [v, count] of triangleCount.entries()) {
        if (count < 6)
            continue;
        const zIndex = v * 3 + 2;
        vertices[zIndex] = -vertices[zIndex] * 3.0;
    }

    return new Map([
        ["vertices", vertices],
        ["indices", indices],
        ["triangleCount", triangleCount],
    ])
}