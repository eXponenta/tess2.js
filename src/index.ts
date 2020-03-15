/*
 ** SGI FREE SOFTWARE LICENSE B (Version 2.0, Sept. 18, 2008)
 ** Copyright (C) [dates of first publication] Silicon Graphics, Inc.
 ** All Rights Reserved.
 **
 ** Permission is hereby granted, free of charge, to any person obtaining a copy
 ** of this software and associated documentation files (the "Software"), to deal
 ** in the Software without restriction, including without limitation the rights
 ** to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 ** of the Software, and to permit persons to whom the Software is furnished to do so,
 ** subject to the following conditions:
 **
 ** The above copyright notice including the dates of first publication and either this
 ** permission notice or a reference to http://oss.sgi.com/projects/FreeB/ shall be
 ** included in all copies or substantial portions of the Software.
 **
 ** THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 ** INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 ** PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL SILICON GRAPHICS, INC.
 ** BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 ** TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE
 ** OR OTHER DEALINGS IN THE SOFTWARE.
 **
 ** Except as contained in this notice, the name of Silicon Graphics, Inc. shall not
 ** be used in advertising or otherwise to promote the sale, use or other dealings in
 ** this Software without prior written authorization from Silicon Graphics, Inc.
 */
/*
 ** Author: Mikko Mononen, Aug 2013.
 ** TS-version: Timoshenko Konstantin, Mart 2020.
 ** The code is based on GLU libtess by Eric Veach, July 1994
 */

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

export function tesselate({
	windingRule = WINDING.ODD,
	elementType = ELEMENT.POLYGONS,
	polySize = 3,
	vertexSize = 2,
	normal = [0, 0, 1],
	contours = [],
	strict = true,
	debug = false,
}: IOptions): IResult | undefined {
	if (!contours && strict) {
		throw new Error("Contours can't be empty");
	}

	if (!contours) {
		return undefined;
	}

	const tess = new Tesselator();

	for (let i = 0; i < contours.length; i++) {
		tess.addContour(vertexSize || 2, contours[i]);
	}

	tess.tesselate(
		windingRule,
		elementType,
		polySize,
		vertexSize,
		normal,
		strict,
	);

	return {
		vertices: tess.vertices,
		vertexIndices: tess.vertexIndices,
		vertexCount: tess.vertexCount,
		elements: tess.elements,
		elementCount: tess.elementCount,
		mesh: debug ? tess.mesh : undefined,
	};
}

// legacy, compatibility exports


export const WINDING_ODD = WINDING.ODD;
export const WINDING_NONZERO = WINDING.NONZERO;
export const WINDING_POSITIVE = WINDING.POSITIVE;
export const WINDING_NEGATIVE = WINDING.NEGATIVE;
export const WINDING_ABS_GEQ_TWO = WINDING.ABS_GEQ_TWO;

export const POLYGONS = ELEMENT.POLYGONS;
export const CONNECTED_POLYGONS = ELEMENT.CONNECTED_POLYGONS;
export const BOUNDARY_CONTOURS = ELEMENT.BOUNDARY_CONTOURS;