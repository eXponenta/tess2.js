import { Tesselator } from "./Tesselator";
import { WINDING, ELEMENT } from "./utils/constants";
import { V3 } from "./type";
export interface IOptions {
    windingRule?: number;
    elementType?: number;
    polySize?: number;
    vertexSize?: 2 | 3;
    normal?: V3;
    contours: Array<Array<number>>;
    strict?: boolean;
    debug?: boolean;
}
export interface IResult {
    vertices: Array<number>;
    vertexIndices: Array<number>;
    vertexCount: number;
    elements: Array<number>;
    elementCount: number;
    mesh: any;
}
export { Tesselator, WINDING, ELEMENT };
export declare function tesselate({ windingRule, elementType, polySize, vertexSize, normal, contours, strict, debug, }: IOptions): IResult | undefined;
export declare const WINDING_ODD = WINDING.ODD;
export declare const WINDING_NONZERO = WINDING.NONZERO;
export declare const WINDING_POSITIVE = WINDING.POSITIVE;
export declare const WINDING_NEGATIVE = WINDING.NEGATIVE;
export declare const WINDING_ABS_GEQ_TWO = WINDING.ABS_GEQ_TWO;
export declare const POLYGONS = ELEMENT.POLYGONS;
export declare const CONNECTED_POLYGONS = ELEMENT.CONNECTED_POLYGONS;
export declare const BOUNDARY_CONTOURS = ELEMENT.BOUNDARY_CONTOURS;
