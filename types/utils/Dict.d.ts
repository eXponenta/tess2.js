export declare class DictNode {
    key: any;
    next: DictNode;
    prev: DictNode;
}
export declare class Dict {
    frame: any;
    leq: (...arg: any) => boolean;
    head: DictNode;
    constructor(frame: any, leq: (...arg: any) => boolean);
    min(): DictNode;
    max(): DictNode;
    insert(k: any): DictNode;
    search(key: any): DictNode;
    insertBefore(node: DictNode, key: any): DictNode;
    delete(node: DictNode): void;
}
