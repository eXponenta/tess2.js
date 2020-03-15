import { TESSface } from "./TESSface";
import { TESShalfEdge } from "./TESShalfEdge";
import { TESSvertex } from "./TESSvertex";
export declare class TESSmesh {
    vHead: TESSvertex;
    fHead: TESSface;
    eHead: TESShalfEdge;
    eHeadSym: TESShalfEdge;
    constructor();
    makeEdge_(eNext: TESShalfEdge): TESShalfEdge;
    splice_(a: TESShalfEdge, b: TESShalfEdge): void;
    makeVertex_(newVertex: TESSvertex, eOrig: TESShalfEdge, vNext: TESSvertex): void;
    makeFace_(newFace: TESSface, eOrig: TESShalfEdge, fNext: TESSface): void;
    killEdge_(eDel: TESShalfEdge): void;
    killVertex_(vDel: TESSvertex, newOrg: TESSvertex): void;
    killFace_(fDel: TESSface, newLface: TESSface): void;
    makeEdge(): TESShalfEdge;
    splice(eOrg: TESShalfEdge, eDst: TESShalfEdge): void;
    delete(eDel: TESShalfEdge): void;
    addEdgeVertex(eOrg: TESShalfEdge): TESShalfEdge;
    splitEdge(eOrg: TESShalfEdge): TESShalfEdge;
    connect(eOrg: TESShalfEdge, eDst: TESShalfEdge): TESShalfEdge;
    zapFace(fZap: TESSface): void;
    countFaceVerts_(f: TESSface): number;
    mergeConvexFaces(maxVertsPerFace: number): boolean;
    check(): void;
}
