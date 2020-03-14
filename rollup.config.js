import cleanup from 'rollup-plugin-cleanup';
import sourcemaps from 'rollup-plugin-sourcemaps';

export default {
    input: "./src/index.js",
    plugins: [
        cleanup(),
        sourcemaps()
    ],
    output: [
        {
            file: "./dist/tess2.es.js",
            format: 'esm',
            sourcemap: true,
        },
        {
            file: "./dist/tess2.js",
            format:"iife",
            name: "Tess2",
            sourcemap: true,
        }
    ]
}