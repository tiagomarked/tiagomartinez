import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        target: 'esnext', // needed for native ES module workers
    }
});