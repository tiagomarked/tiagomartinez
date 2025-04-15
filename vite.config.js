import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        target: 'esnext', // needed for native ES module workers
        outDir: '../dist', // Output folder for the build files
        emptyOutDir: true,

    },
    root: 'public', // Change the root to the 'public' folder
    server: {
        open: true, // Automatically open the browser
    }
});