import {Geom} from "./Geom";
import {assert} from "./assert";

/* Internal */


/* The mesh structure is similar in spirit, notation, and operations
 * to the "quad-edge" structure (see L. Guibas and J. Stolfi, Primitives
 * for the manipulation of general subdivisions and the computation of
 * Voronoi diagrams, ACM Transactions on Graphics, 4(2):74-123, April 1985).
 * For a simplified description, see the course notes for CS348a,
 * "Mathematical Foundations of Computer Graphics", available at the
 * Stanford bookstore (and taught during the fall quarter).
 * The implementation also borrows a tiny subset of the graph-based approach
 * use in Mantyla's Geometric Work Bench (see M. Mantyla, An Introduction
 * to Sold Modeling, Computer Science Press, Rockville, Maryland, 1988).
 *
 * The fundamental data structure is the "half-edge".  Two half-edges
 * go together to make an edge, but they point in opposite directions.
 * Each half-edge has a pointer to its mate (the "symmetric" half-edge Sym),
 * its origin vertex (Org), the face on its left side (Lface), and the
 * adjacent half-edges in the CCW direction around the origin vertex
 * (Onext) and around the left face (Lnext).  There is also a "next"
 * pointer for the global edge list (see below).
 *
 * The notation used for mesh navigation:
 *  Sym   = the mate of a half-edge (same edge, but opposite direction)
 *  Onext = edge CCW around origin vertex (keep same origin)
 *  Dnext = edge CCW around destination vertex (keep same dest)
 *  Lnext = edge CCW around left face (dest becomes new origin)
 *  Rnext = edge CCW around right face (origin becomes new dest)
 *
 * "prev" means to substitute CW for CCW in the definitions above.
 *
 * The mesh keeps global lists of all vertices, faces, and edges,
 * stored as doubly-linked circular lists with a dummy header node.
 * The mesh stores pointers to these dummy headers (vHead, fHead, eHead).
 *
 * The circular edge list is special; since half-edges always occur
 * in pairs (e and e->Sym), each half-edge stores a pointer in only
 * one direction.  Starting at eHead and following the e->next pointers
 * will visit each *edge* once (ie. e or e->Sym, but not both).
 * e->Sym stores a pointer in the opposite direction, thus it is
 * always true that e->Sym->next->Sym->next == e.
 *
 * Each vertex has a pointer to next and previous vertices in the
 * circular list, and a pointer to a half-edge with this vertex as
 * the origin (NULL if this is the dummy header).  There is also a
 * field "data" for client data.
 *
 * Each face has a pointer to the next and previous faces in the
 * circular list, and a pointer to a half-edge with this face as
 * the left face (NULL if this is the dummy header).  There is also
 * a field "data" for client data.
 *
 * Note that what we call a "face" is really a loop; faces may consist
 * of more than one loop (ie. not simply connected), but there is no
 * record of this in the data structure.  The mesh may consist of
 * several disconnected regions, so it may not be possible to visit
 * the entire mesh by starting at a half-edge and traversing the edge
 * structure.
 *
 * The mesh does NOT support isolated vertices; a vertex is deleted along
 * with its last edge.  Similarly when two faces are merged, one of the
 * faces is deleted (see tessMeshDelete below).  For mesh operations,
 * all face (loop) and vertex pointers must not be NULL.  However, once
 * mesh manipulation is finished, TESSmeshZapFace can be used to delete
 * faces of the mesh, one at a time.  All external faces can be "zapped"
 * before the mesh is returned to the client; then a NULL face indicates
 * a region which is not part of the output polygon.
 */

export function TESSvertex() {
	this.next = null; /* next vertex (never NULL) */
	this.prev = null; /* previous vertex (never NULL) */
	this.anEdge = null; /* a half-edge with this origin */

	/* Internal data (keep hidden) */
	this.coords = [0, 0, 0]; /* vertex location in 3D */
	this.s = 0.0;
	this.t = 0.0; /* projection onto the sweep plane */
	this.pqHandle = 0; /* to allow deletion from priority queue */
	this.n = 0; /* to allow identify unique vertices */
	this.idx = 0; /* to allow map result to original verts */
}

function TESSface() {
	this.next = null; /* next face (never NULL) */
	this.prev = null; /* previous face (never NULL) */
	this.anEdge = null; /* a half edge with this left face */

	/* Internal data (keep hidden) */
	this.trail = null; /* "stack" for conversion to strips */
	this.n = 0; /* to allow identiy unique faces */
	this.marked = false; /* flag for conversion to strips */
	this.inside = false; /* this face is in the polygon interior */
}

function TESShalfEdge(side) {
	this.next = null; /* doubly-linked list (prev==Sym->next) */
	this.Sym = null; /* same edge, opposite direction */
	this.Onext = null; /* next edge CCW around origin */
	this.Lnext = null; /* next edge CCW around left face */
	this.Org = null; /* origin vertex (Overtex too long) */
	this.Lface = null; /* left face */

	/* Internal data (keep hidden) */
	this.activeRegion = null; /* a region with this upper edge (sweep.c) */
	this.winding = 0; /* change in winding number when crossing
									   from the right face to the left face */
	this.side = side;
}

TESShalfEdge.prototype = {
	get Rface() {
		return this.Sym.Lface;
	},
	set Rface(v) {
		this.Sym.Lface = v;
	},
	get Dst() {
		return this.Sym.Org;
	},
	set Dst(v) {
		this.Sym.Org = v;
	},
	get Oprev() {
		return this.Sym.Lnext;
	},
	set Oprev(v) {
		this.Sym.Lnext = v;
	},
	get Lprev() {
		return this.Onext.Sym;
	},
	set Lprev(v) {
		this.Onext.Sym = v;
	},
	get Dprev() {
		return this.Lnext.Sym;
	},
	set Dprev(v) {
		this.Lnext.Sym = v;
	},
	get Rprev() {
		return this.Sym.Onext;
	},
	set Rprev(v) {
		this.Sym.Onext = v;
	},
	get Dnext() {
		return /*this.Rprev*/ this.Sym.Onext.Sym;
	} /* 3 pointers */,
	set Dnext(v) {
		/*this.Rprev*/ this.Sym.Onext.Sym = v;
	} /* 3 pointers */,
	get Rnext() {
		return /*this.Oprev*/ this.Sym.Lnext.Sym;
	} /* 3 pointers */,
	set Rnext(v) {
		/*this.Oprev*/ this.Sym.Lnext.Sym = v;
	} /* 3 pointers */,
};

export function TESSmesh() {
	var v = new TESSvertex();
	var f = new TESSface();
	var e = new TESShalfEdge(0);
	var eSym = new TESShalfEdge(1);

	v.next = v.prev = v;
	v.anEdge = null;

	f.next = f.prev = f;
	f.anEdge = null;
	f.trail = null;
	f.marked = false;
	f.inside = false;

	e.next = e;
	e.Sym = eSym;
	e.Onext = null;
	e.Lnext = null;
	e.Org = null;
	e.Lface = null;
	e.winding = 0;
	e.activeRegion = null;

	eSym.next = eSym;
	eSym.Sym = e;
	eSym.Onext = null;
	eSym.Lnext = null;
	eSym.Org = null;
	eSym.Lface = null;
	eSym.winding = 0;
	eSym.activeRegion = null;

	this.vHead = v; /* dummy header for vertex list */
	this.fHead = f; /* dummy header for face list */
	this.eHead = e; /* dummy header for edge list */
	this.eHeadSym = eSym; /* and its symmetric counterpart */
}

/* The mesh operations below have three motivations: completeness,
 * convenience, and efficiency.  The basic mesh operations are MakeEdge,
 * Splice, and Delete.  All the other edge operations can be implemented
 * in terms of these.  The other operations are provided for convenience
 * and/or efficiency.
 *
 * When a face is split or a vertex is added, they are inserted into the
 * global list *before* the existing vertex or face (ie. e->Org or e->Lface).
 * This makes it easier to process all vertices or faces in the global lists
 * without worrying about processing the same data twice.  As a convenience,
 * when a face is split, the "inside" flag is copied from the old face.
 * Other internal data (v->data, v->activeRegion, f->data, f->marked,
 * f->trail, e->winding) is set to zero.
 *
 * ********************** Basic Edge Operations **************************
 *
 * tessMeshMakeEdge( mesh ) creates one edge, two vertices, and a loop.
 * The loop (face) consists of the two new half-edges.
 *
 * tessMeshSplice( eOrg, eDst ) is the basic operation for changing the
 * mesh connectivity and topology.  It changes the mesh so that
 *  eOrg->Onext <- OLD( eDst->Onext )
 *  eDst->Onext <- OLD( eOrg->Onext )
 * where OLD(...) means the value before the meshSplice operation.
 *
 * This can have two effects on the vertex structure:
 *  - if eOrg->Org != eDst->Org, the two vertices are merged together
 *  - if eOrg->Org == eDst->Org, the origin is split into two vertices
 * In both cases, eDst->Org is changed and eOrg->Org is untouched.
 *
 * Similarly (and independently) for the face structure,
 *  - if eOrg->Lface == eDst->Lface, one loop is split into two
 *  - if eOrg->Lface != eDst->Lface, two distinct loops are joined into one
 * In both cases, eDst->Lface is changed and eOrg->Lface is unaffected.
 *
 * tessMeshDelete( eDel ) removes the edge eDel.  There are several cases:
 * if (eDel->Lface != eDel->Rface), we join two loops into one; the loop
 * eDel->Lface is deleted.  Otherwise, we are splitting one loop into two;
 * the newly created loop will contain eDel->Dst.  If the deletion of eDel
 * would create isolated vertices, those are deleted as well.
 *
 * ********************** Other Edge Operations **************************
 *
 * tessMeshAddEdgeVertex( eOrg ) creates a new edge eNew such that
 * eNew == eOrg->Lnext, and eNew->Dst is a newly created vertex.
 * eOrg and eNew will have the same left face.
 *
 * tessMeshSplitEdge( eOrg ) splits eOrg into two edges eOrg and eNew,
 * such that eNew == eOrg->Lnext.  The new vertex is eOrg->Dst == eNew->Org.
 * eOrg and eNew will have the same left face.
 *
 * tessMeshConnect( eOrg, eDst ) creates a new edge from eOrg->Dst
 * to eDst->Org, and returns the corresponding half-edge eNew.
 * If eOrg->Lface == eDst->Lface, this splits one loop into two,
 * and the newly created loop is eNew->Lface.  Otherwise, two disjoint
 * loops are merged into one, and the loop eDst->Lface is destroyed.
 *
 * ************************ Other Operations *****************************
 *
 * tessMeshNewMesh() creates a new mesh with no edges, no vertices,
 * and no loops (what we usually call a "face").
 *
 * tessMeshUnion( mesh1, mesh2 ) forms the union of all structures in
 * both meshes, and returns the new mesh (the old meshes are destroyed).
 *
 * tessMeshDeleteMesh( mesh ) will free all storage for any valid mesh.
 *
 * tessMeshZapFace( fZap ) destroys a face and removes it from the
 * global face list.  All edges of fZap will have a NULL pointer as their
 * left face.  Any edges which also have a NULL pointer as their right face
 * are deleted entirely (along with any isolated vertices this produces).
 * An entire mesh can be deleted by zapping its faces, one at a time,
 * in any order.  Zapped faces cannot be used in further mesh operations!
 *
 * tessMeshCheckMesh( mesh ) checks a mesh for self-consistency.
 */

TESSmesh.prototype = {
	/* MakeEdge creates a new pair of half-edges which form their own loop.
	 * No vertex or face structures are allocated, but these must be assigned
	 * before the current edge operation is completed.
	 */
	//static TESShalfEdge *MakeEdge( TESSmesh* mesh, TESShalfEdge *eNext )
	makeEdge_: function(eNext) {
		var e = new TESShalfEdge(0);
		var eSym = new TESShalfEdge(1);

		/* Make sure eNext points to the first edge of the edge pair */
		if (eNext.Sym.side < eNext.side) {
			eNext = eNext.Sym;
		}

		/* Insert in circular doubly-linked list before eNext.
		 * Note that the prev pointer is stored in Sym->next.
		 */
		var ePrev = eNext.Sym.next;
		eSym.next = ePrev;
		ePrev.Sym.next = e;
		e.next = eNext;
		eNext.Sym.next = eSym;

		e.Sym = eSym;
		e.Onext = e;
		e.Lnext = eSym;
		e.Org = null;
		e.Lface = null;
		e.winding = 0;
		e.activeRegion = null;

		eSym.Sym = e;
		eSym.Onext = eSym;
		eSym.Lnext = e;
		eSym.Org = null;
		eSym.Lface = null;
		eSym.winding = 0;
		eSym.activeRegion = null;

		return e;
	},

	/* Splice( a, b ) is best described by the Guibas/Stolfi paper or the
	 * CS348a notes (see mesh.h).  Basically it modifies the mesh so that
	 * a->Onext and b->Onext are exchanged.  This can have various effects
	 * depending on whether a and b belong to different face or vertex rings.
	 * For more explanation see tessMeshSplice() below.
	 */
	// static void Splice( TESShalfEdge *a, TESShalfEdge *b )
	splice_: function(a, b) {
		var aOnext = a.Onext;
		var bOnext = b.Onext;
		aOnext.Sym.Lnext = b;
		bOnext.Sym.Lnext = a;
		a.Onext = bOnext;
		b.Onext = aOnext;
	},

	/* MakeVertex( newVertex, eOrig, vNext ) attaches a new vertex and makes it the
	 * origin of all edges in the vertex loop to which eOrig belongs. "vNext" gives
	 * a place to insert the new vertex in the global vertex list.  We insert
	 * the new vertex *before* vNext so that algorithms which walk the vertex
	 * list will not see the newly created vertices.
	 */
	//static void MakeVertex( TESSvertex *newVertex, TESShalfEdge *eOrig, TESSvertex *vNext )
	makeVertex_: function(newVertex, eOrig, vNext) {
		var vNew = newVertex;
		
		assert(vNew);

		/* insert in circular doubly-linked list before vNext */
		var vPrev = vNext.prev;
		vNew.prev = vPrev;
		vPrev.next = vNew;
		vNew.next = vNext;
		vNext.prev = vNew;

		vNew.anEdge = eOrig;
		/* leave coords, s, t undefined */

		/* fix other edges on this vertex loop */
		var e = eOrig;
		do {
			e.Org = vNew;
			e = e.Onext;
		} while (e !== eOrig);
	},

	/* MakeFace( newFace, eOrig, fNext ) attaches a new face and makes it the left
	 * face of all edges in the face loop to which eOrig belongs.  "fNext" gives
	 * a place to insert the new face in the global face list.  We insert
	 * the new face *before* fNext so that algorithms which walk the face
	 * list will not see the newly created faces.
	 */
	// static void MakeFace( TESSface *newFace, TESShalfEdge *eOrig, TESSface *fNext )
	makeFace_: function(newFace, eOrig, fNext) {
		var fNew = newFace;
		assert(fNew !== null);

		/* insert in circular doubly-linked list before fNext */
		var fPrev = fNext.prev;
		fNew.prev = fPrev;
		fPrev.next = fNew;
		fNew.next = fNext;
		fNext.prev = fNew;

		fNew.anEdge = eOrig;
		fNew.trail = null;
		fNew.marked = false;

		/* The new face is marked "inside" if the old one was.  This is a
		 * convenience for the common case where a face has been split in two.
		 */
		fNew.inside = fNext.inside;

		/* fix other edges on this face loop */
		var e = eOrig;
		do {
			e.Lface = fNew;
			e = e.Lnext;
		} while (e !== eOrig);
	},

	/* KillEdge( eDel ) destroys an edge (the half-edges eDel and eDel->Sym),
	 * and removes from the global edge list.
	 */
	//static void KillEdge( TESSmesh *mesh, TESShalfEdge *eDel )
	killEdge_: function(eDel) {
		/* Half-edges are allocated in pairs, see EdgePair above */
		if (eDel.Sym.side < eDel.side) {
			eDel = eDel.Sym;
		}

		/* delete from circular doubly-linked list */
		var eNext = eDel.next;
		var ePrev = eDel.Sym.next;
		eNext.Sym.next = ePrev;
		ePrev.Sym.next = eNext;
	},

	/* KillVertex( vDel ) destroys a vertex and removes it from the global
	 * vertex list.  It updates the vertex loop to point to a given new vertex.
	 */
	//static void KillVertex( TESSmesh *mesh, TESSvertex *vDel, TESSvertex *newOrg )
	killVertex_: function(vDel, newOrg) {
		var eStart = vDel.anEdge;
		/* change the origin of all affected edges */
		var e = eStart;
		do {
			e.Org = newOrg;
			e = e.Onext;
		} while (e !== eStart);

		/* delete from circular doubly-linked list */
		var vPrev = vDel.prev;
		var vNext = vDel.next;
		vNext.prev = vPrev;
		vPrev.next = vNext;
	},

	/* KillFace( fDel ) destroys a face and removes it from the global face
	 * list.  It updates the face loop to point to a given new face.
	 */
	//static void KillFace( TESSmesh *mesh, TESSface *fDel, TESSface *newLface )
	killFace_: function(fDel, newLface) {
		var eStart = fDel.anEdge;

		/* change the left face of all affected edges */
		var e = eStart;
		do {
			e.Lface = newLface;
			e = e.Lnext;
		} while (e !== eStart);

		/* delete from circular doubly-linked list */
		var fPrev = fDel.prev;
		var fNext = fDel.next;
		fNext.prev = fPrev;
		fPrev.next = fNext;
	},

	/****************** Basic Edge Operations **********************/

	/* tessMeshMakeEdge creates one edge, two vertices, and a loop (face).
	 * The loop consists of the two new half-edges.
	 */
	//TESShalfEdge *tessMeshMakeEdge( TESSmesh *mesh )
	makeEdge: function() {
		var newVertex1 = new TESSvertex();
		var newVertex2 = new TESSvertex();
		var newFace = new TESSface();
		var e = this.makeEdge_(this.eHead);
		this.makeVertex_(newVertex1, e, this.vHead);
		this.makeVertex_(newVertex2, e.Sym, this.vHead);
		this.makeFace_(newFace, e, this.fHead);
		return e;
	},

	/* tessMeshSplice( eOrg, eDst ) is the basic operation for changing the
	 * mesh connectivity and topology.  It changes the mesh so that
	 *	eOrg->Onext <- OLD( eDst->Onext )
	 *	eDst->Onext <- OLD( eOrg->Onext )
	 * where OLD(...) means the value before the meshSplice operation.
	 *
	 * This can have two effects on the vertex structure:
	 *  - if eOrg->Org != eDst->Org, the two vertices are merged together
	 *  - if eOrg->Org == eDst->Org, the origin is split into two vertices
	 * In both cases, eDst->Org is changed and eOrg->Org is untouched.
	 *
	 * Similarly (and independently) for the face structure,
	 *  - if eOrg->Lface == eDst->Lface, one loop is split into two
	 *  - if eOrg->Lface != eDst->Lface, two distinct loops are joined into one
	 * In both cases, eDst->Lface is changed and eOrg->Lface is unaffected.
	 *
	 * Some special cases:
	 * If eDst == eOrg, the operation has no effect.
	 * If eDst == eOrg->Lnext, the new face will have a single edge.
	 * If eDst == eOrg->Lprev, the old face will have a single edge.
	 * If eDst == eOrg->Onext, the new vertex will have a single edge.
	 * If eDst == eOrg->Oprev, the old vertex will have a single edge.
	 */
	//int tessMeshSplice( TESSmesh* mesh, TESShalfEdge *eOrg, TESShalfEdge *eDst )
	splice: function(eOrg, eDst) {
		var joiningLoops = false;
		var joiningVertices = false;

		if (eOrg === eDst) return;

		if (eDst.Org !== eOrg.Org) {
			/* We are merging two disjoint vertices -- destroy eDst->Org */
			joiningVertices = true;
			this.killVertex_(eDst.Org, eOrg.Org);
		}
		if (eDst.Lface !== eOrg.Lface) {
			/* We are connecting two disjoint loops -- destroy eDst->Lface */
			joiningLoops = true;
			this.killFace_(eDst.Lface, eOrg.Lface);
		}

		/* Change the edge structure */
		this.splice_(eDst, eOrg);

		if (!joiningVertices) {
			var newVertex = new TESSvertex();

			/* We split one vertex into two -- the new vertex is eDst->Org.
			 * Make sure the old vertex points to a valid half-edge.
			 */
			this.makeVertex_(newVertex, eDst, eOrg.Org);
			eOrg.Org.anEdge = eOrg;
		}
		if (!joiningLoops) {
			var newFace = new TESSface();

			/* We split one loop into two -- the new loop is eDst->Lface.
			 * Make sure the old face points to a valid half-edge.
			 */
			this.makeFace_(newFace, eDst, eOrg.Lface);
			eOrg.Lface.anEdge = eOrg;
		}
	},

	/* tessMeshDelete( eDel ) removes the edge eDel.  There are several cases:
	 * if (eDel->Lface != eDel->Rface), we join two loops into one; the loop
	 * eDel->Lface is deleted.  Otherwise, we are splitting one loop into two;
	 * the newly created loop will contain eDel->Dst.  If the deletion of eDel
	 * would create isolated vertices, those are deleted as well.
	 *
	 * This function could be implemented as two calls to tessMeshSplice
	 * plus a few calls to memFree, but this would allocate and delete
	 * unnecessary vertices and faces.
	 */
	//int tessMeshDelete( TESSmesh *mesh, TESShalfEdge *eDel )
	delete: function(eDel) {
		var eDelSym = eDel.Sym;
		var joiningLoops = false;

		/* First step: disconnect the origin vertex eDel->Org.  We make all
		 * changes to get a consistent mesh in this "intermediate" state.
		 */
		if (eDel.Lface !== eDel.Rface) {
			/* We are joining two loops into one -- remove the left face */
			joiningLoops = true;
			this.killFace_(eDel.Lface, eDel.Rface);
		}

		if (eDel.Onext === eDel) {
			this.killVertex_(eDel.Org, null);
		} else {
			/* Make sure that eDel->Org and eDel->Rface point to valid half-edges */
			eDel.Rface.anEdge = eDel.Oprev;
			eDel.Org.anEdge = eDel.Onext;

			this.splice_(eDel, eDel.Oprev);
			if (!joiningLoops) {
				var newFace = new TESSface();

				/* We are splitting one loop into two -- create a new loop for eDel. */
				this.makeFace_(newFace, eDel, eDel.Lface);
			}
		}

		/* Claim: the mesh is now in a consistent state, except that eDel->Org
		 * may have been deleted.  Now we disconnect eDel->Dst.
		 */
		if (eDelSym.Onext === eDelSym) {
			this.killVertex_(eDelSym.Org, null);
			this.killFace_(eDelSym.Lface, null);
		} else {
			/* Make sure that eDel->Dst and eDel->Lface point to valid half-edges */
			eDel.Lface.anEdge = eDelSym.Oprev;
			eDelSym.Org.anEdge = eDelSym.Onext;
			this.splice_(eDelSym, eDelSym.Oprev);
		}

		/* Any isolated vertices or faces have already been freed. */
		this.killEdge_(eDel);
	},

	/******************** Other Edge Operations **********************/

	/* All these routines can be implemented with the basic edge
	 * operations above.  They are provided for convenience and efficiency.
	 */

	/* tessMeshAddEdgeVertex( eOrg ) creates a new edge eNew such that
	 * eNew == eOrg->Lnext, and eNew->Dst is a newly created vertex.
	 * eOrg and eNew will have the same left face.
	 */
	// TESShalfEdge *tessMeshAddEdgeVertex( TESSmesh *mesh, TESShalfEdge *eOrg );
	addEdgeVertex: function(eOrg) {
		var eNew = this.makeEdge_(eOrg);
		var eNewSym = eNew.Sym;

		/* Connect the new edge appropriately */
		this.splice_(eNew, eOrg.Lnext);

		/* Set the vertex and face information */
		eNew.Org = eOrg.Dst;

		var newVertex = new TESSvertex();
		this.makeVertex_(newVertex, eNewSym, eNew.Org);

		eNew.Lface = eNewSym.Lface = eOrg.Lface;

		return eNew;
	},

	/* tessMeshSplitEdge( eOrg ) splits eOrg into two edges eOrg and eNew,
	 * such that eNew == eOrg->Lnext.  The new vertex is eOrg->Dst == eNew->Org.
	 * eOrg and eNew will have the same left face.
	 */
	// TESShalfEdge *tessMeshSplitEdge( TESSmesh *mesh, TESShalfEdge *eOrg );
	splitEdge: function(eOrg, eDst) {
		var tempHalfEdge = this.addEdgeVertex(eOrg);
		var eNew = tempHalfEdge.Sym;

		/* Disconnect eOrg from eOrg->Dst and connect it to eNew->Org */
		this.splice_(eOrg.Sym, eOrg.Sym.Oprev);
		this.splice_(eOrg.Sym, eNew);

		/* Set the vertex and face information */
		eOrg.Dst = eNew.Org;
		eNew.Dst.anEdge = eNew.Sym; /* may have pointed to eOrg->Sym */
		eNew.Rface = eOrg.Rface;
		eNew.winding = eOrg.winding; /* copy old winding information */
		eNew.Sym.winding = eOrg.Sym.winding;

		return eNew;
	},

	/* tessMeshConnect( eOrg, eDst ) creates a new edge from eOrg->Dst
	 * to eDst->Org, and returns the corresponding half-edge eNew.
	 * If eOrg->Lface == eDst->Lface, this splits one loop into two,
	 * and the newly created loop is eNew->Lface.  Otherwise, two disjoint
	 * loops are merged into one, and the loop eDst->Lface is destroyed.
	 *
	 * If (eOrg == eDst), the new face will have only two edges.
	 * If (eOrg->Lnext == eDst), the old face is reduced to a single edge.
	 * If (eOrg->Lnext->Lnext == eDst), the old face is reduced to two edges.
	 */

	// TESShalfEdge *tessMeshConnect( TESSmesh *mesh, TESShalfEdge *eOrg, TESShalfEdge *eDst );
	connect: function(eOrg, eDst) {
		var joiningLoops = false;
		var eNew = this.makeEdge_(eOrg);
		var eNewSym = eNew.Sym;

		if (eDst.Lface !== eOrg.Lface) {
			/* We are connecting two disjoint loops -- destroy eDst->Lface */
			joiningLoops = true;
			this.killFace_(eDst.Lface, eOrg.Lface);
		}

		/* Connect the new edge appropriately */
		this.splice_(eNew, eOrg.Lnext);
		this.splice_(eNewSym, eDst);

		/* Set the vertex and face information */
		eNew.Org = eOrg.Dst;
		eNewSym.Org = eDst.Org;
		eNew.Lface = eNewSym.Lface = eOrg.Lface;

		/* Make sure the old face points to a valid half-edge */
		eOrg.Lface.anEdge = eNewSym;

		if (!joiningLoops) {
			var newFace = new TESSface();
			/* We split one loop into two -- the new loop is eNew->Lface */
			this.makeFace_(newFace, eNew, eOrg.Lface);
		}
		return eNew;
	},

	/* tessMeshZapFace( fZap ) destroys a face and removes it from the
	 * global face list.  All edges of fZap will have a NULL pointer as their
	 * left face.  Any edges which also have a NULL pointer as their right face
	 * are deleted entirely (along with any isolated vertices this produces).
	 * An entire mesh can be deleted by zapping its faces, one at a time,
	 * in any order.  Zapped faces cannot be used in further mesh operations!
	 */
	zapFace: function(fZap) {
		var eStart = fZap.anEdge;
		var e, eNext, eSym;
		var fPrev, fNext;

		/* walk around face, deleting edges whose right face is also NULL */
		eNext = eStart.Lnext;
		do {
			e = eNext;
			eNext = e.Lnext;

			e.Lface = null;
			if (e.Rface === null) {
				/* delete the edge -- see TESSmeshDelete above */

				if (e.Onext === e) {
					this.killVertex_(e.Org, null);
				} else {
					/* Make sure that e->Org points to a valid half-edge */
					e.Org.anEdge = e.Onext;
					this.splice_(e, e.Oprev);
				}
				eSym = e.Sym;
				if (eSym.Onext === eSym) {
					this.killVertex_(eSym.Org, null);
				} else {
					/* Make sure that eSym->Org points to a valid half-edge */
					eSym.Org.anEdge = eSym.Onext;
					this.splice_(eSym, eSym.Oprev);
				}
				this.killEdge_(e);
			}
		} while (e != eStart);

		/* delete from circular doubly-linked list */
		fPrev = fZap.prev;
		fNext = fZap.next;
		fNext.prev = fPrev;
		fPrev.next = fNext;
	},

	countFaceVerts_: function(f) {
		var eCur = f.anEdge;
		var n = 0;
		do {
			n++;
			eCur = eCur.Lnext;
		} while (eCur !== f.anEdge);
		return n;
	},

	//int tessMeshMergeConvexFaces( TESSmesh *mesh, int maxVertsPerFace )
	mergeConvexFaces: function(maxVertsPerFace) {
		var f;
		var eCur, eNext, eSym;
		var vStart;
		var curNv, symNv;

		for (f = this.fHead.next; f !== this.fHead; f = f.next) {
			// Skip faces which are outside the result.
			if (!f.inside) continue;

			eCur = f.anEdge;
			vStart = eCur.Org;

			while (true) {
				eNext = eCur.Lnext;
				eSym = eCur.Sym;

				// Try to merge if the neighbour face is valid.
				if (eSym && eSym.Lface && eSym.Lface.inside) {
					// Try to merge the neighbour faces if the resulting polygons
					// does not exceed maximum number of vertices.
					curNv = this.countFaceVerts_(f);
					symNv = this.countFaceVerts_(eSym.Lface);
					if (curNv + symNv - 2 <= maxVertsPerFace) {
						// Merge if the resulting poly is convex.
						if (
							Geom.vertCCW(
								eCur.Lprev.Org,
								eCur.Org,
								eSym.Lnext.Lnext.Org,
							) &&
							Geom.vertCCW(
								eSym.Lprev.Org,
								eSym.Org,
								eCur.Lnext.Lnext.Org,
							)
						) {
							eNext = eSym.Lnext;
							this.delete(eSym);
							eCur = null;
							eSym = null;
						}
					}
				}

				if (eCur && eCur.Lnext.Org === vStart) break;

				// Continue to next edge.
				eCur = eNext;
			}
		}

		return true;
	},

	/* tessMeshCheckMesh( mesh ) checks a mesh for self-consistency.
	 */
	check: function() {
		var fHead = this.fHead;
		var vHead = this.vHead;
		var eHead = this.eHead;
		var f, fPrev, v, vPrev, e, ePrev;

		fPrev = fHead;
		for (fPrev = fHead; (f = fPrev.next) !== fHead; fPrev = f) {
			assert(f.prev === fPrev);
			e = f.anEdge;
			do {
				assert(e.Sym !== e);
				assert(e.Sym.Sym === e);
				assert(e.Lnext.Onext.Sym === e);
				assert(e.Onext.Sym.Lnext === e);
				assert(e.Lface === f);
				e = e.Lnext;
			} while (e !== f.anEdge);
		}
		assert(f.prev === fPrev && f.anEdge === null);

		vPrev = vHead;
		for (vPrev = vHead; (v = vPrev.next) !== vHead; vPrev = v) {
			assert(v.prev === vPrev);
			e = v.anEdge;
			do {
				assert(e.Sym !== e);
				assert(e.Sym.Sym === e);
				assert(e.Lnext.Onext.Sym === e);
				assert(e.Onext.Sym.Lnext === e);
				assert(e.Org === v);
				e = e.Onext;
			} while (e !== v.anEdge);
		}
		assert(v.prev === vPrev && v.anEdge === null);

		ePrev = eHead;
		for (ePrev = eHead; (e = ePrev.next) !== eHead; ePrev = e) {
			assert(e.Sym.next === ePrev.Sym);
			assert(e.Sym !== e);
			assert(e.Sym.Sym === e);
			assert(e.Org !== null);
			assert(e.Dst !== null);
			assert(e.Lnext.Onext.Sym === e);
			assert(e.Onext.Sym.Lnext === e);
		}
		assert(
			e.Sym.next === ePrev.Sym &&
				e.Sym === this.eHeadSym &&
				e.Sym.Sym === e &&
				e.Org === null &&
				e.Dst === null &&
				e.Lface === null &&
				e.Rface === null,
		);
	},
};

function DictNode() {
	this.key = null;
	this.next = null;
	this.prev = null;
}

export function Dict(frame, leq) {
	this.head = new DictNode();
	this.head.next = this.head;
	this.head.prev = this.head;
	this.frame = frame;
	this.leq = leq;
}

Dict.prototype = {
	min: function() {
		return this.head.next;
	},

	max: function() {
		return this.head.prev;
	},

	insert: function(k) {
		return this.insertBefore(this.head, k);
	},

	search: function(key) {
		/* Search returns the node with the smallest key greater than or equal
		 * to the given key.  If there is no such key, returns a node whose
		 * key is NULL.  Similarly, Succ(Max(d)) has a NULL key, etc.
		 */
		var node = this.head;
		do {
			node = node.next;
		} while (node.key !== null && !this.leq(this.frame, key, node.key));

		return node;
	},

	insertBefore: function(node, key) {
		do {
			node = node.prev;
		} while (node.key !== null && !this.leq(this.frame, node.key, key));

		var newNode = new DictNode();
		newNode.key = key;
		newNode.next = node.next;
		node.next.prev = newNode;
		newNode.prev = node;
		node.next = newNode;

		return newNode;
	},

	delete: function(node) {
		node.next.prev = node.prev;
		node.prev.next = node.next;
	},
};

function PQnode() {
	this.handle = null;
}

function PQhandleElem() {
	this.key = null;
	this.node = null;
}

export function PriorityQ(size, leq) {
	this.size = 0;
	this.max = size;

	this.nodes = [];
	this.nodes.length = size + 1;
	var i;

	for (i = 0; i < this.nodes.length; i++) this.nodes[i] = new PQnode();

	this.handles = [];
	this.handles.length = size + 1;
	for (i = 0; i < this.handles.length; i++)
		this.handles[i] = new PQhandleElem();

	this.initialized = false;
	this.freeList = 0;
	this.leq = leq;

	this.nodes[1].handle = 1; /* so that Minimum() returns NULL */
	this.handles[1].key = null;
}

PriorityQ.prototype = {
	floatDown_: function(curr) {
		var n = this.nodes;
		var h = this.handles;
		var hCurr, hChild;
		var child;

		hCurr = n[curr].handle;
		for (;;) {
			child = curr << 1;
			if (
				child < this.size &&
				this.leq(h[n[child + 1].handle].key, h[n[child].handle].key)
			) {
				++child;
			}

			assert(child <= this.max);

			hChild = n[child].handle;
			if (child > this.size || this.leq(h[hCurr].key, h[hChild].key)) {
				n[curr].handle = hCurr;
				h[hCurr].node = curr;
				break;
			}
			n[curr].handle = hChild;
			h[hChild].node = curr;
			curr = child;
		}
	},

	floatUp_: function(curr) {
		var n = this.nodes;
		var h = this.handles;
		var hCurr, hParent;
		var parent;

		hCurr = n[curr].handle;
		for (;;) {
			parent = curr >> 1;
			hParent = n[parent].handle;
			if (parent === 0 || this.leq(h[hParent].key, h[hCurr].key)) {
				n[curr].handle = hCurr;
				h[hCurr].node = curr;
				break;
			}
			n[curr].handle = hParent;
			h[hParent].node = curr;
			curr = parent;
		}
	},

	init: function() {
		/* This method of building a heap is O(n), rather than O(n lg n). */
		for (var i = this.size; i >= 1; --i) {
			this.floatDown_(i);
		}
		this.initialized = true;
	},

	min: function() {
		return this.handles[this.nodes[1].handle].key;
	},

	/* really pqHeapInsert */
	/* returns INV_HANDLE iff out of memory */
	//PQhandle pqHeapInsert( TESSalloc* alloc, PriorityQHeap *pq, PQkey keyNew )
	insert: function(keyNew) {
		var curr;
		var free;

		curr = ++this.size;
		if (curr * 2 > this.max) {
			this.max *= 2;
			var i;
			var s;
			s = this.nodes.length;
			this.nodes.length = this.max + 1;
			for (i = s; i < this.nodes.length; i++)
				this.nodes[i] = new PQnode();

			s = this.handles.length;
			this.handles.length = this.max + 1;
			for (i = s; i < this.handles.length; i++)
				this.handles[i] = new PQhandleElem();
		}

		if (this.freeList === 0) {
			free = curr;
		} else {
			free = this.freeList;
			this.freeList = this.handles[free].node;
		}

		this.nodes[curr].handle = free;
		this.handles[free].node = curr;
		this.handles[free].key = keyNew;

		if (this.initialized) {
			this.floatUp_(curr);
		}
		return free;
	},

	//PQkey pqHeapExtractMin( PriorityQHeap *pq )
	extractMin: function() {
		var n = this.nodes;
		var h = this.handles;
		var hMin = n[1].handle;
		var min = h[hMin].key;

		if (this.size > 0) {
			n[1].handle = n[this.size].handle;
			h[n[1].handle].node = 1;

			h[hMin].key = null;
			h[hMin].node = this.freeList;
			this.freeList = hMin;

			--this.size;
			if (this.size > 0) {
				this.floatDown_(1);
			}
		}
		return min;
	},

	delete: function(hCurr) {
		var n = this.nodes;
		var h = this.handles;
		var curr;

		assert(hCurr >= 1 && hCurr <= this.max && h[hCurr].key !== null);

		curr = h[hCurr].node;
		n[curr].handle = n[this.size].handle;
		h[n[curr].handle].node = curr;

		--this.size;
		if (curr <= this.size) {
			if (
				curr <= 1 ||
				this.leq(h[n[curr >> 1].handle].key, h[n[curr].handle].key)
			) {
				this.floatDown_(curr);
			} else {
				this.floatUp_(curr);
			}
		}
		h[hCurr].key = null;
		h[hCurr].node = this.freeList;
		this.freeList = hCurr;
	},
};

/* For each pair of adjacent edges crossing the sweep line, there is
 * an ActiveRegion to represent the region between them.  The active
 * regions are kept in sorted order in a dynamic dictionary.  As the
 * sweep line crosses each vertex, we update the affected regions.
 */

export function ActiveRegion() {
	this.eUp = null; /* upper edge, directed right to left */
	this.nodeUp = null; /* dictionary node corresponding to eUp */
	this.windingNumber = 0;
	/* used to determine which regions are
	 * inside the polygon */
	this.inside = false; /* is this region inside the polygon? */
	this.sentinel = false; /* marks fake edges at t = +/-infinity */
	this.dirty = false;
	/* marks regions where the upper or lower
	 * edge has changed, but we haven't checked
	 * whether they intersect yet */
	this.fixUpperEdge = false;
	/* marks temporary edges introduced when
	 * we process a "right vertex" (one without
	 * any edges leaving to the right) */
}
