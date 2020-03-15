import { TESSvertex, TESShalfEdge } from "../mesh/index";
export declare class Geom {
    static vertEq(u: TESSvertex, v: TESSvertex): boolean;
    static vertLeq(u: TESSvertex, v: TESSvertex): boolean;
    static transLeq(u: TESSvertex, v: TESSvertex): boolean;
    static edgeGoesLeft(e: TESShalfEdge): boolean;
    static edgeGoesRight(e: TESShalfEdge): boolean;
    static vertL1dist(u: TESSvertex, v: TESSvertex): number;
    static edgeEval(u: TESSvertex, v: TESSvertex, w: TESSvertex): number;
    static edgeSign(u: TESSvertex, v: TESSvertex, w: TESSvertex): number;
    static transEval(u: TESSvertex, v: TESSvertex, w: TESSvertex): number;
    static transSign(u: TESSvertex, v: TESSvertex, w: TESSvertex): number;
    static vertCCW(u: TESSvertex, v: TESSvertex, w: TESSvertex): boolean;
    static interpolate(a: number, x: number, b: number, y: number): number;
    static intersect(o1: TESSvertex, d1: TESSvertex, o2: TESSvertex, d2: TESSvertex, v: TESSvertex): void;
}
