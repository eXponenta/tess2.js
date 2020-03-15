import { TESShalfEdge } from './TESShalfEdge';
export declare class TESSface {
    next: TESSface;
    prev: TESSface;
    anEdge: TESShalfEdge;
    trail: any;
    n: number;
    marked: boolean;
    inside: boolean;
}
