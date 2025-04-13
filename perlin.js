export class PerlinNoise {
    constructor() { }

    grad(ix, iy) {
        const hash = this.hash(ix, iy);
        const angle = hash * Math.PI * 2;
        return [Math.cos(angle), Math.sin(angle)];
    }

    hash(x, y) {
        const seed = x * 374761393 + y * 668265263;
        const result = (seed ^ (seed >> 13)) * 1274126177;
        return (result & 0x7fffffff) / 0x7fffffff;
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(a, b, t) {
        return a + t * (b - a);
    }

    dotGridGradient(ix, iy, x, y) {
        const [gx, gy] = this.grad(ix, iy);
        const dx = x - ix;
        const dy = y - iy;
        return (dx * gx + dy * gy);
    }

    noise(x, y) {
        const x0 = Math.floor(x);
        const x1 = x0 + 1;
        const y0 = Math.floor(y);
        const y1 = y0 + 1;

        const sx = this.fade(x - x0);
        const sy = this.fade(y - y0);

        const n0 = this.dotGridGradient(x0, y0, x, y);
        const n1 = this.dotGridGradient(x1, y0, x, y);
        const ix0 = this.lerp(n0, n1, sx);

        const n2 = this.dotGridGradient(x0, y1, x, y);
        const n3 = this.dotGridGradient(x1, y1, x, y);
        const ix1 = this.lerp(n2, n3, sx);

        const value = this.lerp(ix0, ix1, sy);

        return (value + 1) / 2;
    }
}
