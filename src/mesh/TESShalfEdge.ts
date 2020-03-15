import { ActiveRegion } from './ActiveRegion';
import { TESSface } from './TESSface';
type TESSVertex = any;

export class TESShalfEdge {

	next: TESShalfEdge = null; /* doubly-linked list (prev==Sym->next) */
	Org: TESSVertex= null; /* origin vertex (Overtex too long) */
	Sym: TESShalfEdge = null; /* same edge, opposite direction */
	Onext: TESShalfEdge= null; /* next edge CCW around origin */
	Lnext: TESShalfEdge = null; /* next edge CCW around left face */
	Lface: TESSface = null; /* left face */

	/* Internal data (keep hidden) */
	activeRegion: ActiveRegion = null; /* a region with this upper edge (sweep.c) */
	winding: number = 0; /* change in winding number when crossing from the right face to the left face */

	constructor(public side: number) { };

	get Rface() {
		return this.Sym!.Lface;
	}

	set Rface(v: TESSface) {
		this.Sym!.Lface = v;
	}

	get Dst() {
		return this.Sym!.Org;
	}

	set Dst(v) {
		this.Sym!.Org = v;
	}

	get Oprev() {
		return this.Sym!.Lnext;
	}

	set Oprev(v: TESShalfEdge) {
		this.Sym!.Lnext = v;
	}

	get Lprev() {
		return this.Onext!.Sym;
	}
	set Lprev(v) {
		this.Onext!.Sym = v;
	}

	get Dprev() {
		return this.Lnext!.Sym;
	}

	set Dprev(v) {
		this.Lnext!.Sym = v;
	}
	get Rprev() {
		return this.Sym!.Onext;
	}
	set Rprev(v) {
		this.Sym!.Onext = v;
	}
	get Dnext() {
		return this.Sym!.Onext!.Sym;
	}
	set Dnext(v) {
		this.Sym!.Onext!.Sym = v;
	}
	get Rnext() {
		return this.Sym!.Lnext!.Sym;
	}
	set Rnext(v) {
		this.Sym!.Lnext!.Sym = v;
	}
};