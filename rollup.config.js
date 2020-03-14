import cleanup from 'rollup-plugin-cleanup';
import sourcemaps from 'rollup-plugin-sourcemaps';
import typescript from 'rollup-plugin-typescript2';

export default {
    input: "./src/index.ts",
    plugins: [
        sourcemaps(),
        cleanup(),
        typescript(),
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