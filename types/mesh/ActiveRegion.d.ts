import { TESShalfEdge } from './TESShalfEdge';
export declare class ActiveRegion {
    eUp: TESShalfEdge;
    nodeUp?: any;
    windingNumber: number;
    inside: boolean;
    sentinel: boolean;
    dirty: boolean;
    fixUpperEdge: boolean;
}
