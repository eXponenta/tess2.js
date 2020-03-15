import typescript from 'rollup-plugin-typescript2';
import { terser } from "rollup-plugin-terser";

export default {
    input: "./src/index.ts",
    plugins: [
        //sourcemaps(),
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
        },
        {
            file: "./dist/tess2.min.js",
            format:"iife",
            name: "Tess2",
            plugins: [terser({
                mangle: {
                    properties: true
                }
            })]
        },
        
    ]
}