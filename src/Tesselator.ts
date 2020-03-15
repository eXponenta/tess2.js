import { WINDING, ELEMENT } from './utils/constants';
import { TESSmesh } from './mesh/TESSmesh';
import { Geom } from "./utils/Geom";
import { Sweep } from "./utils/Sweep";
import { V3, V2 } from './type';
import { TESShalfEdge } from './mesh/TESShalfEdge';
import { PriorityQ } from './utils/PriorityQ';
import { Dict } from './utils/Dict';

type TESSface = any;
//type TESSmesh = any;
type TESSedge = any;

export class Tesselator {
	/*** state needed for collecting the input data ***/
	/* stores the input contours, and eventually the tessellation itself */
	mesh: TESSmesh = new TESSmesh();

	/*** state needed for projecting onto the sweep plane ***/
	normal: V3 = [0.0, 0.0, 0.0]; /* user-specified normal (if provided) */
	sUnit: V3 = [0.0, 0.0, 0.0]; /* unit vector in s-direction (debugging) */
	tUnit: V3 = [0.0, 0.0, 0.0]; /* unit vector in t-direction (debugging) */

	bmin: V2 = [0.0, 0.0];
	bmax: V2 = [0.0, 0.0];

	/*** state needed for the line sweep ***/
	/* rule for determining polygon interior */

	windingRule = WINDING.ODD;

	dict: Dict = null; /* edge dictionary for sweep line */
	pq: PriorityQ = null; /* priority queue of vertex events */
	event: any = null; /* current sweep event being processed */

	vertexIndexCounter: number = 0;

	vertices: Array<number> = [];
	vertexIndices: Array<number> = [];
	vertexCount: number = 0;
	elements: Array<number> = [];
	elementCount: number = 0;

	dot_(u: V3, v: V3) {
		return u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
	}

	normalize_(v: V3) {
		let len = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];

		if (!len) {
			throw "Zero-size vector!";
		}

		len = Math.sqrt(len);

		v[0] /= len;
		v[1] /= len;
		v[2] /= len;
	}

	longAxis_(v: V3) {
		let i = 0;

		if (Math.abs(v[1]) > Math.abs(v[0])) {
			i = 1;
		}

		if (Math.abs(v[2]) > Math.abs(v[i])) {
			i = 2;
		}

		return i;
	}

	computeNormal_(norm: V3) {
		let v: any, v1: any, v2: any;
		let c, tLen2, maxLen2;
		let maxVal: V3 = [0, 0, 0],
			minVal: V3 = [0, 0, 0],
			d1: V3 = [0, 0, 0],
			d2: V3 = [0, 0, 0],
			tNorm: V3 = [0, 0, 0];

		const maxVert:Array<any> = [null, null, null],
			minVert:Array<any> = [null, null, null];
		const vHead = this.mesh.vHead;

		v = vHead.next;
		for (let i = 0; i < 3; ++i) {
			c = v.coords[i];
			minVal[i] = c;
			minVert[i] = v;
			maxVal[i] = c;
			maxVert[i] = v;
		}

		for (v = vHead.next; v !== vHead; v = v.next) {
			for (let i = 0; i < 3; ++i) {
				c = v.coords[i];

				if (c < minVal[i]) {
					minVal[i] = c;
					minVert[i] = v;
				}

				if (c > maxVal[i]) {
					maxVal[i] = c;
					maxVert[i] = v;
				}
			}
		}

		/* Find two vertices separated by at least 1/sqrt(3) of the maximum
		 * distance between any two vertices
		 */
		let i = 0;
		if (maxVal[1] - minVal[1] > maxVal[0] - minVal[0]) {
			i = 1;
		}

		if (maxVal[2] - minVal[2] > maxVal[i] - minVal[i]) {
			i = 2;
		}

		if (minVal[i] >= maxVal[i]) {
			/* All vertices are the same -- normal doesn't matter */
			norm[0] = 0;
			norm[1] = 0;
			norm[2] = 1;
			return;
		}

		/* Look for a third vertex which forms the triangle with maximum area
		 * (Length of normal == twice the triangle area)
		 */
		maxLen2 = 0;
		v1 = minVert[i]!;
		v2 = maxVert[i]!;
		d1[0] = v1.coords[0] - v2.coords[0];
		d1[1] = v1.coords[1] - v2.coords[1];
		d1[2] = v1.coords[2] - v2.coords[2];

		for (v = vHead.next; v !== vHead; v = v.next) {
			d2[0] = v.coords[0] - v2.coords[0];
			d2[1] = v.coords[1] - v2.coords[1];
			d2[2] = v.coords[2] - v2.coords[2];

			tNorm[0] = d1[1] * d2[2] - d1[2] * d2[1];
			tNorm[1] = d1[2] * d2[0] - d1[0] * d2[2];
			tNorm[2] = d1[0] * d2[1] - d1[1] * d2[0];
			tLen2 = tNorm[0] * tNorm[0] + tNorm[1] * tNorm[1] + tNorm[2] * tNorm[2];

			if (tLen2 > maxLen2) {
				maxLen2 = tLen2;
				norm[0] = tNorm[0];
				norm[1] = tNorm[1];
				norm[2] = tNorm[2];
			}
		}

		if (maxLen2 <= 0) {
			/* All points lie on a single line -- any decent normal will do */
			norm[0] = norm[1] = norm[2] = 0;
			norm[this.longAxis_(d1)] = 1;
		}
	}

	checkOrientation_() {
		var f,
			fHead = this.mesh.fHead;
		var v,
			vHead = this.mesh.vHead;
		var e;

		/* When we compute the normal automatically, we choose the orientation
		 * so that the the sum of the signed areas of all contours is non-negative.
		 */
		let area = 0;

		for (let f = fHead.next!; f !== fHead; f = f.next!) {
			e = f.anEdge!;
			if (e.winding <= 0) continue;
			do {
				area += (e!.Org!.s! - e!.Dst!.s!) * (e!.Org!.t + e!.Dst!.t!);
				e = e!.Lnext!;
			} while (e !== f.anEdge);
		}

		if (area < 0) {
			/* Reverse the orientation by flipping all the t-coordinates */
			for (v = vHead.next!; v !== vHead; v = v!.next!) {
				v.t = -v.t;
			}
			this.tUnit[0] = -this.tUnit[0];
			this.tUnit[1] = -this.tUnit[1];
			this.tUnit[2] = -this.tUnit[2];
		}
	}

	/*	#ifdef FOR_TRITE_TEST_PROGRAM
		#include <stdlib.h>
		extern int RandomSweep;
		#define S_UNIT_X	(RandomSweep ? (2*drand48()-1) : 1.0)
		#define S_UNIT_Y	(RandomSweep ? (2*drand48()-1) : 0.0)
		#else
		#if defined(SLANTED_SWEEP) */
	/* The "feature merging" is not intended to be complete.  There are
	 * special cases where edges are nearly parallel to the sweep line
	 * which are not implemented.  The algorithm should still behave
	 * robustly (ie. produce a reasonable tesselation) in the presence
	 * of such edges, however it may miss features which could have been
	 * merged.  We could minimize this effect by choosing the sweep line
	 * direction to be something unusual (ie. not parallel to one of the
	 * coordinate axes).
	 */
	/*	#define S_UNIT_X	(TESSreal)0.50941539564955385	// Pre-normalized
		#define S_UNIT_Y	(TESSreal)0.86052074622010633
		#else
		#define S_UNIT_X	(TESSreal)1.0
		#define S_UNIT_Y	(TESSreal)0.0
		#endif
		#endif*/

	/* Determine the polygon normal and project vertices onto the plane
	 * of the polygon.
	 */
	projectPolygon_() {
		let v,
			vHead = this.mesh.vHead;
		let norm: V3 = [0, 0, 0];
		let sUnit, tUnit;
		let computedNormal = false;

		norm[0] = this.normal[0];
		norm[1] = this.normal[1];
		norm[2] = this.normal[2];

		if (!norm[0] && !norm[1] && !norm[2]) {
			this.computeNormal_(norm);
			computedNormal = true;
		}

		sUnit = this.sUnit;
		tUnit = this.tUnit;

		let axis = this.longAxis_(norm);

		/*	#if defined(FOR_TRITE_TEST_PROGRAM) || defined(TRUE_PROJECT)
			// Choose the initial sUnit vector to be approximately perpendicular
			// to the normal.
			
			Normalize( norm );

			sUnit[i] = 0;
			sUnit[(i+1)%3] = S_UNIT_X;
			sUnit[(i+2)%3] = S_UNIT_Y;

			// Now make it exactly perpendicular 
			w = Dot( sUnit, norm );
			sUnit[0] -= w * norm[0];
			sUnit[1] -= w * norm[1];
			sUnit[2] -= w * norm[2];
			Normalize( sUnit );

			// Choose tUnit so that (sUnit,tUnit,norm) form a right-handed frame 
			tUnit[0] = norm[1]*sUnit[2] - norm[2]*sUnit[1];
			tUnit[1] = norm[2]*sUnit[0] - norm[0]*sUnit[2];
			tUnit[2] = norm[0]*sUnit[1] - norm[1]*sUnit[0];
			Normalize( tUnit );
		#else*/
		/* Project perpendicular to a coordinate axis -- better numerically */
		sUnit[axis] = 0;
		sUnit[(axis + 1) % 3] = 1.0;
		sUnit[(axis + 2) % 3] = 0.0;

		tUnit[axis] = 0;
		tUnit[(axis + 1) % 3] = 0.0;
		tUnit[(axis + 2) % 3] = norm[axis] > 0 ? 1.0 : -1.0;
		//	#endif

		/* Project the vertices onto the sweep plane */
		for (let v = vHead.next!; v !== vHead; v = v!.next!) {
			v.s = this.dot_(v.coords, sUnit);
			v.t = this.dot_(v.coords, tUnit);
		}

		if (computedNormal) {
			this.checkOrientation_();
		}

		/* Compute ST bounds. */
		let first = true;

		for (let v = vHead.next; v !== vHead; v = v!.next!) {
			if (first) {
				this.bmin[0] = this.bmax[0] = v!.s;
				this.bmin[1] = this.bmax[1] = v!.t;

				first = false;
			} else {
				if (v!.s! < this.bmin[0]) this.bmin[0] = v!.s;
				if (v!.s! > this.bmax[0]) this.bmax[0] = v!.s;
				if (v!.t! < this.bmin[1]) this.bmin[1] = v!.t;
				if (v!.t! > this.bmax[1]) this.bmax[1] = v!.t;
			}
		}
	}

	addWinding_(eDst: any, eSrc: any) {
		eDst.winding += eSrc.winding;
		eDst.Sym.winding += eSrc.Sym.winding;
	}

	/* tessMeshTessellateMonoRegion( face ) tessellates a monotone region
	 * (what else would it do??)  The region must consist of a single
	 * loop of half-edges (see mesh.h) oriented CCW.  "Monotone" in this
	 * case means that any vertical line intersects the interior of the
	 * region in a single interval.
	 *
	 * Tessellation consists of adding interior edges (actually pairs of
	 * half-edges), to split the region into non-overlapping triangles.
	 *
	 * The basic idea is explained in Preparata and Shamos (which I don''t
	 * have handy right now), although their implementation is more
	 * complicated than this one.  The are two edge chains, an upper chain
	 * and a lower chain.  We process all vertices from both chains in order,
	 * from right to left.
	 *
	 * The algorithm ensures that the following invariant holds after each
	 * vertex is processed: the untessellated region consists of two
	 * chains, where one chain (say the upper) is a single edge, and
	 * the other chain is concave.  The left vertex of the single edge
	 * is always to the left of all vertices in the concave chain.
	 *
	 * Each step consists of adding the rightmost unprocessed vertex to one
	 * of the two chains, and forming a fan of triangles from the rightmost
	 * of two chain endpoints.  Determining whether we can add each triangle
	 * to the fan is a simple orientation test.  By making the fan as large
	 * as possible, we restore the invariant (check it yourself).
	 */
	//	int tessMeshTessellateMonoRegion( TESSmesh *mesh, TESSface *face )
	tessellateMonoRegion_(mesh: any, face: TESSface) {
		let up, lo;

		/* All edges are oriented CCW around the boundary of the region.
		 * First, find the half-edge whose origin vertex is rightmost.
		 * Since the sweep goes from left to right, face->anEdge should
		 * be close to the edge we want.
		 */
		up = face.anEdge;
		if (!(up.Lnext !== up && up.Lnext.Lnext !== up)) {
			throw "Mono region invalid";
		}

		for (; Geom.vertLeq(up.Dst, up.Org); up = up.Lprev);
		for (; Geom.vertLeq(up.Org, up.Dst); up = up.Lnext);

		lo = up.Lprev;

		let tempHalfEdge: any = undefined;

		while (up.Lnext !== lo) {
			if (Geom.vertLeq(up.Dst, lo.Org)) {
				/* up->Dst is on the left.  It is safe to form triangles from lo->Org.
				 * The EdgeGoesLeft test guarantees progress even when some triangles
				 * are CW, given that the upper and lower chains are truly monotone.
				 */
				while (
					lo.Lnext !== up &&
					(Geom.edgeGoesLeft(lo.Lnext) ||
						Geom.edgeSign(lo.Org, lo.Dst, lo.Lnext.Dst) <= 0.0)
				) {
					tempHalfEdge = mesh.connect(lo.Lnext, lo);
					//if (tempHalfEdge == NULL) return 0;
					lo = tempHalfEdge.Sym;
				}
				lo = lo.Lprev;
			} else {
				/* lo->Org is on the left.  We can make CCW triangles from up->Dst. */
				while (
					lo.Lnext !== up &&
					(Geom.edgeGoesRight(up.Lprev) ||
						Geom.edgeSign(up.Dst, up.Org, up.Lprev.Org) >= 0.0)
				) {
					tempHalfEdge = mesh.connect(up, up.Lprev);
					//if (tempHalfEdge == NULL) return 0;
					up = tempHalfEdge.Sym;
				}
				up = up.Lnext;
			}
		}

		/* Now lo->Org == up->Dst == the leftmost vertex.  The remaining region
		 * can be tessellated in a fan from this leftmost vertex.
		 */

		if (lo.Lnext === up) {
			throw "Mono region invalid";
		}

		while (lo.Lnext.Lnext !== up) {
			tempHalfEdge = mesh.connect(lo.Lnext, lo);
			//if (tempHalfEdge == NULL) return 0;
			lo = tempHalfEdge.Sym;
		}

		return true;
	}

	/* tessMeshTessellateInterior( mesh ) tessellates each region of
	 * the mesh which is marked "inside" the polygon.  Each such region
	 * must be monotone.
	 */
	//int tessMeshTessellateInterior( TESSmesh *mesh )
	tessellateInterior_(mesh: TESSmesh) {
		let next;

		/*LINTED*/
		for (let f = mesh.fHead.next; f !== mesh.fHead; f = next) {
			/* Make sure we don''t try to tessellate the new triangles. */
			next = f!.next!;
			if (f!.inside) {
				if (!this.tessellateMonoRegion_(mesh, f)) {
					return false;
				}
			}
		}

		return true;
	}

	/* tessMeshDiscardExterior( mesh ) zaps (ie. sets to NULL) all faces
	 * which are not marked "inside" the polygon.  Since further mesh operations
	 * on NULL faces are not allowed, the main purpose is to clean up the
	 * mesh so that exterior loops are not represented in the data structure.
	 */
	//void tessMeshDiscardExterior( TESSmesh *mesh )
	discardExterior_(mesh: TESSmesh) {
		let next;

		/*LINTED*/
		for (let f = mesh.fHead.next; f !== mesh.fHead; f = next) {
			/* Since f will be destroyed, save its next pointer. */
			next = f!.next;

			if (!f!.inside) {
				mesh.zapFace(f);
			}
		}
	}

	/* tessMeshSetWindingNumber( mesh, value, keepOnlyBoundary ) resets the
	 * winding numbers on all edges so that regions marked "inside" the
	 * polygon have a winding number of "value", and regions outside
	 * have a winding number of 0.
	 *
	 * If keepOnlyBoundary is TRUE, it also deletes all edges which do not
	 * separate an interior region from an exterior one.
	 */
	//	int tessMeshSetWindingNumber( TESSmesh *mesh, int value, int keepOnlyBoundary )
	setWindingNumber_(mesh: TESSmesh, value: number, keepOnlyBoundary: boolean) {
		let eNext;

		for (let e = mesh.eHead.next; e !== mesh.eHead; e = eNext) {
			eNext = e!.next;
			if (e.Rface.inside !== e.Lface.inside) {
				/* This is a boundary edge (one side is interior, one is exterior). */
				e.winding = e.Lface.inside ? value : -value;
			} else {
				/* Both regions are interior, or both are exterior. */
				if (!keepOnlyBoundary) {
					e.winding = 0;
				} else {
					mesh.delete(e);
				}
			}
		}
	}
	getNeighbourFace_(edge: TESSedge): TESSedge {
		if (!edge.Rface) return -1;
		if (!edge.Rface.inside) return -1;
		return edge.Rface.n;
	}

	outputPolymesh_(mesh: TESSmesh, elementType: number, polySize: number, vertexSize: number) {
		let edge;
		let maxFaceCount = 0;
		let maxVertexCount = 0;
		let faceVerts, i;

		// Assume that the input data is triangles now.
		// Try to merge as many polygons as possible
		if (polySize > 3) {
			mesh.mergeConvexFaces(polySize);
		}

		// Mark unused
		for (let v = mesh.vHead.next; v !== mesh.vHead; v = v.next) {
			v.n = -1;
		}

		// Create unique IDs for all vertices and faces.
		for (let f = mesh.fHead.next; f !== mesh.fHead; f = f.next) {
			f.n = -1;

			if (!f.inside) {
				continue;
			}

			edge = f.anEdge;
			faceVerts = 0;

			do {
				let v = edge.Org;
				if (v.n === -1) {
					v.n = maxVertexCount;
					maxVertexCount++;
				}
				faceVerts++;
				edge = edge.Lnext;
			} while (edge !== f.anEdge);

			if ((faceVerts > polySize)) {
				throw `Face vertex greater that support polygon`;
			}

			f.n = maxFaceCount;
			++maxFaceCount;
		}

		this.elementCount = maxFaceCount;
		if (elementType === ELEMENT.CONNECTED_POLYGONS) {
			maxFaceCount *= 2;
		}
		/*		tess.elements = (TESSindex*)tess->alloc.memalloc( tess->alloc.userData,
															  sizeof(TESSindex) * maxFaceCount * polySize );
			if (!tess->elements)
			{
				tess->outOfMemory = 1;
				return;
			}*/
		this.elements = [];
		this.elements.length = maxFaceCount * polySize;

		this.vertexCount = maxVertexCount;
		/*		tess->vertices = (TESSreal*)tess->alloc.memalloc( tess->alloc.userData,
															 sizeof(TESSreal) * tess->vertexCount * vertexSize );
			if (!tess->vertices)
			{
				tess->outOfMemory = 1;
				return;
			}*/
		this.vertices = [];
		this.vertices.length = maxVertexCount * vertexSize;

		/*		tess->vertexIndices = (TESSindex*)tess->alloc.memalloc( tess->alloc.userData,
																	sizeof(TESSindex) * tess->vertexCount );
			if (!tess->vertexIndices)
			{
				tess->outOfMemory = 1;
				return;
			}*/
		this.vertexIndices = [];
		this.vertexIndices.length = maxVertexCount;

		// Output vertices.
		for (let v = mesh.vHead.next; v !== mesh.vHead; v = v.next) {
			if (v.n !== -1) {
				// Store coordinate
				var idx = v.n * vertexSize;
				this.vertices[idx + 0] = v.coords[0];
				this.vertices[idx + 1] = v.coords[1];
				
				if (vertexSize > 2) {
					this.vertices[idx + 2] = v.coords[2];
				}
				// Store vertex index.
				this.vertexIndices[v.n] = v.idx;
			}
		}

		// Output indices.
		let nel = 0;
		for (let f = mesh.fHead.next; f !== mesh.fHead; f = f.next) {
			if (!f.inside) continue;

			// Store polygon
			edge = f.anEdge;
			faceVerts = 0;

			do {
				let v = edge.Org;
				this.elements[nel++] = v.n;
				faceVerts++;
				edge = edge.Lnext;
			} while (edge !== f.anEdge);
			// Fill unused.

			for (let i = faceVerts; i < polySize; ++i) {
				this.elements[nel++] = -1;
			}

			// Store polygon connectivity
			if (elementType === ELEMENT.CONNECTED_POLYGONS) {
				edge = f.anEdge;
				do {
					this.elements[nel++] = this.getNeighbourFace_(edge);
					edge = edge.Lnext;
				} while (edge !== f.anEdge);
				// Fill unused.
				for (let i = faceVerts; i < polySize; ++i) {
					this.elements[nel++] = -1;
				}
			}
		}
	}

	//	void OutputContours( TESStesselator *tess, TESSmesh *mesh, int vertexSize )
	outputContours_(mesh: TESSmesh, vertexSize: number) {
		let edge;
		let start;
		let startVert = 0;
		let vertCount = 0;

		this.vertexCount = 0;
		this.elementCount = 0;

		for (let f = mesh.fHead.next; f !== mesh.fHead; f = f.next) {
			if (!f.inside) {
				continue;
			}

			start = edge = f.anEdge;
			do {
				this.vertexCount++;
				edge = edge.Lnext;
			} while (edge !== start);

			this.elementCount++;
		}

		/*		tess->elements = (TESSindex*)tess->alloc.memalloc( tess->alloc.userData,
															  sizeof(TESSindex) * tess->elementCount * 2 );
			if (!tess->elements)
			{
				tess->outOfMemory = 1;
				return;
			}*/
		this.elements = [];
		this.elements.length = this.elementCount * 2;

		/*		tess->vertices = (TESSreal*)tess->alloc.memalloc( tess->alloc.userData,
															  sizeof(TESSreal) * tess->vertexCount * vertexSize );
			if (!tess->vertices)
			{
				tess->outOfMemory = 1;
				return;
			}*/
		this.vertices = [];
		this.vertices.length = this.vertexCount * vertexSize;

		/*		tess->vertexIndices = (TESSindex*)tess->alloc.memalloc( tess->alloc.userData,
																	sizeof(TESSindex) * tess->vertexCount );
			if (!tess->vertexIndices)
			{
				tess->outOfMemory = 1;
				return;
			}*/
		this.vertexIndices = [];
		this.vertexIndices.length = this.vertexCount;

		let nv = 0;
		let nvi = 0;
		let nel = 0;

		startVert = 0;

		for (let f = mesh.fHead.next; f !== mesh.fHead; f = f.next) {
			if (!f.inside) {
				continue;
			}

			vertCount = 0;
			start = edge = f.anEdge;

			do {
				this.vertices[nv++] = edge.Org.coords[0];
				this.vertices[nv++] = edge.Org.coords[1];
				
				if (vertexSize > 2) {
					this.vertices[nv++] = edge.Org.coords[2];
				}

				this.vertexIndices[nvi++] = edge.Org.idx;
				vertCount++;
				edge = edge.Lnext;
			} while (edge !== start);

			this.elements[nel++] = startVert;
			this.elements[nel++] = vertCount;

			startVert += vertCount;
		}
	}

	addContour(size: number, vertices: Array<number>) {

		if (this.mesh === null) {
			this.mesh = new TESSmesh();
		}
		/*	 	if ( tess->mesh == NULL ) {
			tess->outOfMemory = 1;
			return;
		}*/

		if (size < 2) {
			size = 2;
		}

		if (size > 3) {
			size = 3;
		}

		let e: TESShalfEdge = null;

		for (let i = 0; i < vertices.length; i += size) {
			if (e === null) {
				/* Make a self-loop (one vertex, one edge). */
				e = this.mesh.makeEdge();
				/*				if ( e == NULL ) {
						tess->outOfMemory = 1;
						return;
					}*/
				this.mesh.splice(e, e.Sym);
			} else {
				/* Create a new vertex and edge which immediately follow e
				 * in the ordering around the left face.
				 */
				this.mesh.splitEdge(e);
				e = e!.Lnext!;
			}

			/* The new vertex is now e->Org. */
			e.Org.coords[0] = vertices[i + 0];
			e.Org.coords[1] = vertices[i + 1];

			if (size > 2) {
				e.Org.coords[2] = vertices[i + 2];
			}
			else {
				e.Org.coords[2] = 0.0;
			}

			/* Store the insertion number so that the vertex can be later recognized. */
			e.Org.idx = this.vertexIndexCounter++;

			/* The winding of an edge says how the winding number changes as we
			 * cross from the edge''s right face to its left face.  We add the
			 * vertices in such an order that a CCW contour will add +1 to
			 * the winding number of the region inside the contour.
			 */
			e.winding = 1;
			e.Sym.winding = -1;
		}
	}

	//	int tessTesselate( TESStesselator *tess, int windingRule, int elementType, int polySize, int vertexSize, const TESSreal* normal )
	/**
	 * Run tesselation
	 * @param windingRule 
	 * @param elementType 
	 * @param polySize 
	 * @param vertexSize 
	 * @param normal 
	 * @param validate UNSAFE! Skip mesh validation pass, may throw any error.
	 */
	tesselate(
		windingRule: WINDING = WINDING.ODD,
		elementType: ELEMENT = ELEMENT.POLYGONS,
		polySize: number,
		vertexSize: 2 | 3,
		normal: V3,
		validate : boolean = true
	) {
		this.vertices = [];
		this.elements = [];
		this.vertexIndices = [];

		this.vertexIndexCounter = 0;

		if (normal) {
			this.normal[0] = normal[0];
			this.normal[1] = normal[1];
			this.normal[2] = normal[2];
		}

		this.windingRule = windingRule;

		if (vertexSize < 2) {
			vertexSize = 2;
		}

		if (vertexSize > 3) {
			vertexSize = 3;
		}

		/*		if (setjmp(tess->env) != 0) { 
				// come back here if out of memory
				return 0;
			}*/

		if (!this.mesh) {
			return false;
		}

		/* Determine the polygon normal and project vertices onto the plane
		 * of the polygon.
		 */
		this.projectPolygon_();

		/* tessComputeInterior( tess ) computes the planar arrangement specified
		 * by the given contours, and further subdivides this arrangement
		 * into regions.  Each region is marked "inside" if it belongs
		 * to the polygon, according to the rule given by tess->windingRule.
		 * Each interior region is guaranteed be monotone.
		 */
		Sweep.computeInterior(this, validate);

		var mesh = this.mesh;

		/* If the user wants only the boundary contours, we throw away all edges
		 * except those which separate the interior from the exterior.
		 * Otherwise we tessellate all the regions marked "inside".
		 */
		if (elementType === ELEMENT.BOUNDARY_CONTOURS) {
			this.setWindingNumber_(mesh, 1, true);
		} else {
			this.tessellateInterior_(mesh);
		}
		//		if (rc == 0) longjmp(tess->env,1);  /* could've used a label */

		if(validate){
			 mesh.check();
		}

		if (elementType === ELEMENT.BOUNDARY_CONTOURS) {
			this.outputContours_(mesh, vertexSize); /* output contours */
		} else {
			this.outputPolymesh_(
				mesh,
				elementType,
				polySize,
				vertexSize,
			); /* output polygons */
		}

		//			tess.mesh = null;

		return true;
	}
};