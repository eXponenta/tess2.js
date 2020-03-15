import { V3 } from '../type';
import { TESShalfEdge } from './TESShalfEdge';

export class TESSvertex {
	next: TESSvertex = null; /* next vertex (never NULL) */
	prev: TESSvertex = null; /* previous vertex (never NULL) */
	anEdge: TESShalfEdge = null; /* a half-edge with this origin */

	/* Internal data (keep hidden) */
	coords: V3 = [0, 0, 0]; /* vertex location in 3D */
	s: number = 0.0;
	t: number = 0.0; /* projection onto the sweep plane */
	pqHandle: number = 0; /* to allow deletion from priority queue */
	n: number = 0; /* to allow identify unique vertices */
	idx: number = 0; /* to allow map result to original verts */
}