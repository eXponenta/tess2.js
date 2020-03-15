import { TESShalfEdge } from './TESShalfEdge';
export class TESSface {
	next?: TESSface = undefined; /* next face (never NULL) */
	prev?: TESSface = undefined; /* previous face (never NULL) */
	anEdge?: TESShalfEdge = undefined; /* a half edge with this left face */

	/* Internal data (keep hidden) */
	trail: any = null; /* "stack" for conversion to strips */
	n: number = 0; /* to allow identiy unique faces */
	marked: boolean = false; /* flag for conversion to strips */
	inside: boolean = false; /* this face is in the polygon interior */
}