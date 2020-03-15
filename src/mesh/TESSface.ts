import { TESShalfEdge } from './TESShalfEdge';
export class TESSface {
	next: TESSface = null; /* next face (never NULL) */
	prev: TESSface = null; /* previous face (never NULL) */
	anEdge: TESShalfEdge = null; /* a half edge with this left face */

	/* Internal data (keep hidden) */
	trail: any = null; /* "stack" for conversion to strips */
	n: number = 0; /* to allow identiy unique faces */
	marked: boolean = false; /* flag for conversion to strips */
	inside: boolean = false; /* this face is in the polygon interior */
}