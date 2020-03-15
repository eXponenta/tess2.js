export declare class PQnode {
    handle: any;
}
export declare class PQhandleElem {
    key: any;
    node: number;
}
export declare class PriorityQ {
    leq: (...args: any) => boolean;
    max: number;
    nodes: Array<PQnode>;
    handles: Array<PQhandleElem>;
    initialized: boolean;
    freeList: number;
    size: number;
    constructor(size: number, leq: (...args: any) => boolean);
    floatDown_(curr: number): void;
    floatUp_(curr: number): void;
    init(): void;
    min(): any;
    insert(keyNew: any): number;
    extractMin(): any;
    delete(hCurr: number): void;
}
