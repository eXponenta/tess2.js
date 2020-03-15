import { V3 } from '../type';
import { TESShalfEdge } from './TESShalfEdge';
export declare class TESSvertex {
    next: TESSvertex;
    prev: TESSvertex;
    anEdge: TESShalfEdge;
    coords: V3;
    s: number;
    t: number;
    pqHandle: number;
    n: number;
    idx: number;
}
