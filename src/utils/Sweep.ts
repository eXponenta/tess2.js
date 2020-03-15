import { Geom } from "./Geom";
import { assert } from "./../utils/assert";
import { PriorityQ } from "./PriorityQ";
import { WINDING } from "./constants";
import { ActiveRegion} from "./../mesh/ActiveRegion";
import { TESSvertex } from "./../mesh/TESSvertex";

import { Dict } from "./Dict";
import { TESSmesh } from "../mesh/TESSmesh";
import { TESShalfEdge } from "../mesh/index";
import { Tesselator } from "../index";

export class Sweep {

	static regionBelow(r: ActiveRegion) {
		return r.nodeUp.prev.key;
	}

	static regionAbove(r: ActiveRegion) {
		return r.nodeUp.next.key;
	}

	static debugEvent(tess: any) {
		// empty
	}

	/*
	 * Invariants for the Edge Dictionary.
	 * - each pair of adjacent edges e2=Succ(e1) satisfies EdgeLeq(e1,e2)
	 *   at any valid location of the sweep event
	 * - if EdgeLeq(e2,e1) as well (at any valid sweep event), then e1 and e2
	 *   share a common endpoint
	 * - for each e, e->Dst has been processed, but not e->Org
	 * - each edge e satisfies VertLeq(e->Dst,event) && VertLeq(event,e->Org)
	 *   where "event" is the current sweep line event.
	 * - no edge e has zero length
	 *
	 * Invariants for the Mesh (the processed portion).
	 * - the portion of the mesh left of the sweep line is a planar graph,
	 *   ie. there is *some* way to embed it in the plane
	 * - no processed edge has zero length
	 * - no two processed vertices have identical coordinates
	 * - each "inside" region is monotone, ie. can be broken into two chains
	 *   of monotonically increasing vertices according to VertLeq(v1,v2)
	 *   - a non-invariant: these chains may intersect (very slightly)
	 *
	 * Invariants for the Sweep.
	 * - if none of the edges incident to the event vertex have an activeRegion
	 *   (ie. none of these edges are in the edge dictionary), then the vertex
	 *   has only right-going edges.
	 * - if an edge is marked "fixUpperEdge" (it is a temporary edge introduced
	 *   by ConnectRightVertex), then it is the only right-going edge from
	 *   its associated vertex.  (This says that these edges exist only
	 *   when it is necessary.)
	 */

	/* When we merge two edges into one, we need to compute the combined
	 * winding of the new edge.
	 */
	static addWinding(eDst: TESShalfEdge, eSrc: TESShalfEdge) {
		eDst.winding += eSrc.winding;
		eDst.Sym.winding += eSrc.Sym.winding;
	}

	//static int EdgeLeq( TESStesselator *tess, ActiveRegion *reg1, ActiveRegion *reg2 )
	static edgeLeq(tess: Tesselator, reg1: ActiveRegion, reg2: ActiveRegion) {
		/*
		 * Both edges must be directed from right to left (this is the canonical
		 * direction for the upper edge of each region).
		 *
		 * The strategy is to evaluate a "t" value for each edge at the
		 * current sweep line position, given by tess->event.  The calculations
		 * are designed to be very stable, but of course they are not perfect.
		 *
		 * Special case: if both edge destinations are at the sweep event,
		 * we sort the edges by slope (they would otherwise compare equally).
		 */
		var ev = tess.event;
		
		var e1 = reg1.eUp;
		var e2 = reg2.eUp;

		if (e1.Dst === ev) {
			if (e2.Dst === ev) {
				/* Two edges right of the sweep line which meet at the sweep event.
				 * Sort them by slope.
				 */
				if (Geom.vertLeq(e1.Org, e2.Org)) {
					return Geom.edgeSign(e2.Dst, e1.Org, e2.Org) <= 0;
				}
				return Geom.edgeSign(e1.Dst, e2.Org, e1.Org) >= 0;
			}
			return Geom.edgeSign(e2.Dst, ev, e2.Org) <= 0;
		}
		if (e2.Dst === ev) {
			return Geom.edgeSign(e1.Dst, ev, e1.Org) >= 0;
		}

		/* General case - compute signed distance *from* e1, e2 to event */
		const t1 = Geom.edgeEval(e1.Dst, ev, e1.Org);
		const t2 = Geom.edgeEval(e2.Dst, ev, e2.Org);
		return t1 >= t2;
	}

	//static void DeleteRegion( TESStesselator *tess, ActiveRegion *reg )
	static deleteRegion(tess: Tesselator, reg: ActiveRegion) {
		if (reg.fixUpperEdge) {
			/* It was created with zero winding number, so it better be
			 * deleted with zero winding number (ie. it better not get merged
			 * with a real edge).
			 */
			assert(reg.eUp.winding === 0);
		}
		reg.eUp.activeRegion = null;
		tess.dict.delete(reg.nodeUp);
	}

	//static int FixUpperEdge( TESStesselator *tess, ActiveRegion *reg, TESShalfEdge *newEdge )
	static fixUpperEdge(tess: Tesselator, reg: ActiveRegion, newEdge: TESShalfEdge) {
		/*
		 * Replace an upper edge which needs fixing (see ConnectRightVertex).
		 */
		assert(reg.fixUpperEdge);
		tess.mesh.delete(reg.eUp);
		reg.fixUpperEdge = false;
		reg.eUp = newEdge;
		newEdge.activeRegion = reg;
	}

	//static ActiveRegion *TopLeftRegion( TESStesselator *tess, ActiveRegion *reg )
	static topLeftRegion(tess: Tesselator, reg: ActiveRegion) {
		var org = reg.eUp.Org;
		var e;

		/* Find the region above the uppermost edge with the same origin */
		do {
			reg = Sweep.regionAbove(reg);
		} while (reg.eUp.Org === org);

		/* If the edge above was a temporary edge introduced by ConnectRightVertex,
		 * now is the time to fix it.
		 */
		if (reg.fixUpperEdge) {
			e = tess.mesh.connect(
				Sweep.regionBelow(reg).eUp.Sym,
				reg.eUp.Lnext,
			);
			if (e === null) return null;
			Sweep.fixUpperEdge(tess, reg, e);
			reg = Sweep.regionAbove(reg);
		}
		return reg;
	}

	//static ActiveRegion *TopRightRegion( ActiveRegion *reg )
	static topRightRegion(reg: ActiveRegion) {
		var dst = reg.eUp.Dst;
		/* Find the region above the uppermost edge with the same destination */
		do {
			reg = Sweep.regionAbove(reg);
		} while (reg.eUp.Dst === dst);
		return reg;
	}

	//static ActiveRegion *AddRegionBelow( TESStesselator *tess, ActiveRegion *regAbove, TESShalfEdge *eNewUp )
	static addRegionBelow(tess: Tesselator, regAbove: ActiveRegion, eNewUp: TESShalfEdge) {
		/*
		 * Add a new active region to the sweep line, *somewhere* below "regAbove"
		 * (according to where the new edge belongs in the sweep-line dictionary).
		 * The upper edge of the new region will be "eNewUp".
		 * Winding number and "inside" flag are not updated.
		 */
		var regNew = new ActiveRegion();
		regNew.eUp = eNewUp;
		regNew.nodeUp = tess.dict.insertBefore(regAbove.nodeUp, regNew);
		//	if (regNew->nodeUp == NULL) longjmp(tess->env,1);
		regNew.fixUpperEdge = false;
		regNew.sentinel = false;
		regNew.dirty = false;

		eNewUp.activeRegion = regNew;
		return regNew;
	}

	//static int IsWindingInside( TESStesselator *tess, int n )
	static isWindingInside(tess:Tesselator, n: number) {
		switch (tess.windingRule) {
			case WINDING.ODD:
				return (n & 1) !== 0;
			case WINDING.NONZERO:
				return n !== 0;
			case WINDING.POSITIVE:
				return n > 0;
			case WINDING.NEGATIVE:
				return n < 0;
			case WINDING.ABS_GEQ_TWO:
				return n >= 2 || n <= -2;
		}

		throw new Error("Invalid winding rulle");
		return false;
	}

	//static void ComputeWinding( TESStesselator *tess, ActiveRegion *reg )
	static computeWinding(tess:Tesselator, reg:ActiveRegion) {
		reg.windingNumber =
			Sweep.regionAbove(reg).windingNumber + reg.eUp.winding;
		reg.inside = Sweep.isWindingInside(tess, reg.windingNumber);
	}

	//static void FinishRegion( TESStesselator *tess, ActiveRegion *reg )
	static finishRegion(tess:Tesselator, reg:ActiveRegion) {
		/*
		 * Delete a region from the sweep line.  This happens when the upper
		 * and lower chains of a region meet (at a vertex on the sweep line).
		 * The "inside" flag is copied to the appropriate mesh face (we could
		 * not do this before -- since the structure of the mesh is always
		 * changing, this face may not have even existed until now).
		 */
		var e = reg.eUp;
		var f = e.Lface;

		f.inside = reg.inside;
		f.anEdge = e; /* optimization for tessMeshTessellateMonoRegion() */
		Sweep.deleteRegion(tess, reg);
	}

	//static TESShalfEdge *FinishLeftRegions( TESStesselator *tess, ActiveRegion *regFirst, ActiveRegion *regLast )
	static finishLeftRegions(tess:Tesselator, regFirst:ActiveRegion, regLast:ActiveRegion) {
		/*
		 * We are given a vertex with one or more left-going edges.  All affected
		 * edges should be in the edge dictionary.  Starting at regFirst->eUp,
		 * we walk down deleting all regions where both edges have the same
		 * origin vOrg.  At the same time we copy the "inside" flag from the
		 * active region to the face, since at this point each face will belong
		 * to at most one region (this was not necessarily true until this point
		 * in the sweep).  The walk stops at the region above regLast; if regLast
		 * is NULL we walk as far as possible.  At the same time we relink the
		 * mesh if necessary, so that the ordering of edges around vOrg is the
		 * same as in the dictionary.
		 */
		var e;
		var reg = null;
		var regPrev = regFirst;
		var ePrev = regFirst.eUp;
		
		while (regPrev !== regLast) {
			regPrev.fixUpperEdge = false; /* placement was OK */
			reg = Sweep.regionBelow(regPrev);
			e = reg.eUp;
			if (e.Org != ePrev.Org) {
				if (!reg.fixUpperEdge) {
					/* Remove the last left-going edge.  Even though there are no further
					 * edges in the dictionary with this origin, there may be further
					 * such edges in the mesh (if we are adding left edges to a vertex
					 * that has already been processed).  Thus it is important to call
					 * FinishRegion rather than just DeleteRegion.
					 */
					Sweep.finishRegion(tess, regPrev);
					break;
				}
				/* If the edge below was a temporary edge introduced by
				 * ConnectRightVertex, now is the time to fix it.
				 */
				e = tess.mesh.connect(ePrev.Lprev, e.Sym);
				//			if (e == NULL) longjmp(tess->env,1);
				Sweep.fixUpperEdge(tess, reg, e);
			}

			/* Relink edges so that ePrev->Onext == e */
			if (ePrev.Onext !== e) {
				tess.mesh.splice(e.Oprev, e);
				tess.mesh.splice(ePrev, e);
			}
			Sweep.finishRegion(tess, regPrev); /* may change reg->eUp */
			ePrev = reg.eUp;
			regPrev = reg;
		}
		return ePrev;
	}

	//static void AddRightEdges( TESStesselator *tess, ActiveRegion *regUp, TESShalfEdge *eFirst, TESShalfEdge *eLast, TESShalfEdge *eTopLeft, int cleanUp )
	static addRightEdges(tess: Tesselator, regUp: ActiveRegion, eFirst: TESShalfEdge, eLast:TESShalfEdge, eTopLeft:TESShalfEdge, cleanUp: boolean) {
		/*
		 * Purpose: insert right-going edges into the edge dictionary, and update
		 * winding numbers and mesh connectivity appropriately.  All right-going
		 * edges share a common origin vOrg.  Edges are inserted CCW starting at
		 * eFirst; the last edge inserted is eLast->Oprev.  If vOrg has any
		 * left-going edges already processed, then eTopLeft must be the edge
		 * such that an imaginary upward vertical segment from vOrg would be
		 * contained between eTopLeft->Oprev and eTopLeft; otherwise eTopLeft
		 * should be NULL.
		 */
		var reg, regPrev;
		var e, ePrev;
		var firstTime = true;

		/* Insert the new right-going edges in the dictionary */
		e = eFirst;
		do {
			assert(Geom.vertLeq(e.Org, e.Dst));
			Sweep.addRegionBelow(tess, regUp, e.Sym);
			e = e.Onext;
		} while (e !== eLast);

		/* Walk *all* right-going edges from e->Org, in the dictionary order,
		 * updating the winding numbers of each region, and re-linking the mesh
		 * edges to match the dictionary ordering (if necessary).
		 */
		if (eTopLeft === null) {
			eTopLeft = Sweep.regionBelow(regUp).eUp.Rprev;
		}
		regPrev = regUp;
		ePrev = eTopLeft;
		for (;;) {
			reg = Sweep.regionBelow(regPrev);
			e = reg.eUp.Sym;
			if (e.Org !== ePrev.Org) break;

			if (e.Onext !== ePrev) {
				/* Unlink e from its current position, and relink below ePrev */
				tess.mesh.splice(e.Oprev, e);
				tess.mesh.splice(ePrev.Oprev, e);
			}
			/* Compute the winding number and "inside" flag for the new regions */
			reg.windingNumber = regPrev.windingNumber - e.winding;
			reg.inside = Sweep.isWindingInside(tess, reg.windingNumber);

			/* Check for two outgoing edges with same slope -- process these
			 * before any intersection tests (see example in tessComputeInterior).
			 */
			regPrev.dirty = true;
			if (!firstTime && Sweep.checkForRightSplice(tess, regPrev)) {
				Sweep.addWinding(e, ePrev);
				Sweep.deleteRegion(tess, regPrev);
				tess.mesh.delete(ePrev);
			}
			firstTime = false;
			regPrev = reg;
			ePrev = e;
		}
		regPrev.dirty = true;
		assert(regPrev.windingNumber - e.winding === reg.windingNumber);

		if (cleanUp) {
			/* Check for intersections between newly adjacent edges. */
			Sweep.walkDirtyRegions(tess, regPrev);
		}
	}

	//static void SpliceMergeVertices( TESStesselator *tess, TESShalfEdge *e1, TESShalfEdge *e2 )
	static spliceMergeVertices(tess: Tesselator, e1:TESShalfEdge, e2:TESShalfEdge) {
		/*
		 * Two vertices with idential coordinates are combined into one.
		 * e1->Org is kept, while e2->Org is discarded.
		 */
		tess.mesh.splice(e1, e2);
	}

	//static void VertexWeights( TESSvertex *isect, TESSvertex *org, TESSvertex *dst, TESSreal *weights )
	static vertexWeights(isect:TESSvertex, org:TESSvertex, dst: any) {
		/*
		 * Find some weights which describe how the intersection vertex is
		 * a linear combination of "org" and "dest".  Each of the two edges
		 * which generated "isect" is allocated 50% of the weight; each edge
		 * splits the weight between its org and dst according to the
		 * relative distance to "isect".
		 */
		var t1 = Geom.vertL1dist(org, isect);
		var t2 = Geom.vertL1dist(dst, isect);
		var w0 = (0.5 * t2) / (t1 + t2);
		var w1 = (0.5 * t1) / (t1 + t2);
		isect.coords[0] += w0 * org.coords[0] + w1 * dst.coords[0];
		isect.coords[1] += w0 * org.coords[1] + w1 * dst.coords[1];
		isect.coords[2] += w0 * org.coords[2] + w1 * dst.coords[2];
	}

	//static void GetIntersectData( TESStesselator *tess, TESSvertex *isect, TESSvertex *orgUp, TESSvertex *dstUp, TESSvertex *orgLo, TESSvertex *dstLo )
	static getIntersectData(tess: Tesselator, isect:TESSvertex, orgUp:TESSvertex, dstUp:TESSvertex, orgLo:TESSvertex, dstLo:TESSvertex) {
		/*
		 * We've computed a new intersection point, now we need a "data" pointer
		 * from the user so that we can refer to this new vertex in the
		 * rendering callbacks.
		 */
		isect.coords[0] = isect.coords[1] = isect.coords[2] = 0;
		isect.idx = -1;
		Sweep.vertexWeights(isect, orgUp, dstUp);
		Sweep.vertexWeights(isect, orgLo, dstLo);
	}

	//static int CheckForRightSplice( TESStesselator *tess, ActiveRegion *regUp )
	static checkForRightSplice(tess:Tesselator, regUp:ActiveRegion) {
		/*
		 * Check the upper and lower edge of "regUp", to make sure that the
		 * eUp->Org is above eLo, or eLo->Org is below eUp (depending on which
		 * origin is leftmost).
		 *
		 * The main purpose is to splice right-going edges with the same
		 * dest vertex and nearly identical slopes (ie. we can't distinguish
		 * the slopes numerically).  However the splicing can also help us
		 * to recover from numerical errors.  For example, suppose at one
		 * point we checked eUp and eLo, and decided that eUp->Org is barely
		 * above eLo.  Then later, we split eLo into two edges (eg. from
		 * a splice operation like this one).  This can change the result of
		 * our test so that now eUp->Org is incident to eLo, or barely below it.
		 * We must correct this condition to maintain the dictionary invariants.
		 *
		 * One possibility is to check these edges for intersection again
		 * (ie. CheckForIntersect).  This is what we do if possible.  However
		 * CheckForIntersect requires that tess->event lies between eUp and eLo,
		 * so that it has something to fall back on when the intersection
		 * calculation gives us an unusable answer.  So, for those cases where
		 * we can't check for intersection, this routine fixes the problem
		 * by just splicing the offending vertex into the other edge.
		 * This is a guaranteed solution, no matter how degenerate things get.
		 * Basically this is a combinatorial solution to a numerical problem.
		 */
		var regLo = Sweep.regionBelow(regUp);
		var eUp = regUp.eUp;
		var eLo = regLo.eUp;

		if (Geom.vertLeq(eUp.Org, eLo.Org)) {
			if (Geom.edgeSign(eLo.Dst, eUp.Org, eLo.Org) > 0) return false;

			/* eUp->Org appears to be below eLo */
			if (!Geom.vertEq(eUp.Org, eLo.Org)) {
				/* Splice eUp->Org into eLo */
				tess.mesh.splitEdge(eLo.Sym);
				tess.mesh.splice(eUp, eLo.Oprev);
				regUp.dirty = regLo.dirty = true;
			} else if (eUp.Org !== eLo.Org) {
				/* merge the two vertices, discarding eUp->Org */
				tess.pq.delete(eUp.Org.pqHandle);
				Sweep.spliceMergeVertices(tess, eLo.Oprev, eUp);
			}
		} else {
			if (Geom.edgeSign(eUp.Dst, eLo.Org, eUp.Org) < 0) return false;

			/* eLo->Org appears to be above eUp, so splice eLo->Org into eUp */
			Sweep.regionAbove(regUp).dirty = regUp.dirty = true;
			tess.mesh.splitEdge(eUp.Sym);
			tess.mesh.splice(eLo.Oprev, eUp);
		}
		return true;
	}

	//static int CheckForLeftSplice( TESStesselator *tess, ActiveRegion *regUp )
	static checkForLeftSplice(tess: Tesselator, regUp: ActiveRegion) {
		/*
		 * Check the upper and lower edge of "regUp", to make sure that the
		 * eUp->Dst is above eLo, or eLo->Dst is below eUp (depending on which
		 * destination is rightmost).
		 *
		 * Theoretically, this should always be true.  However, splitting an edge
		 * into two pieces can change the results of previous tests.  For example,
		 * suppose at one point we checked eUp and eLo, and decided that eUp->Dst
		 * is barely above eLo.  Then later, we split eLo into two edges (eg. from
		 * a splice operation like this one).  This can change the result of
		 * the test so that now eUp->Dst is incident to eLo, or barely below it.
		 * We must correct this condition to maintain the dictionary invariants
		 * (otherwise new edges might get inserted in the wrong place in the
		 * dictionary, and bad stuff will happen).
		 *
		 * We fix the problem by just splicing the offending vertex into the
		 * other edge.
		 */
		var regLo = Sweep.regionBelow(regUp);
		var eUp = regUp.eUp;
		var eLo = regLo.eUp;
		var e;

		assert(!Geom.vertEq(eUp.Dst, eLo.Dst));

		if (Geom.vertLeq(eUp.Dst, eLo.Dst)) {
			if (Geom.edgeSign(eUp.Dst, eLo.Dst, eUp.Org) < 0) return false;

			/* eLo->Dst is above eUp, so splice eLo->Dst into eUp */
			Sweep.regionAbove(regUp).dirty = regUp.dirty = true;
			e = tess.mesh.splitEdge(eUp);
			tess.mesh.splice(eLo.Sym, e);
			e.Lface.inside = regUp.inside;
		} else {
			if (Geom.edgeSign(eLo.Dst, eUp.Dst, eLo.Org) > 0) return false;

			/* eUp->Dst is below eLo, so splice eUp->Dst into eLo */
			regUp.dirty = regLo.dirty = true;
			e = tess.mesh.splitEdge(eLo);
			tess.mesh.splice(eUp.Lnext, eLo.Sym);
			e.Rface.inside = regUp.inside;
		}
		return true;
	}

	//static int CheckForIntersect( TESStesselator *tess, ActiveRegion *regUp )
	static checkForIntersect(tess: Tesselator, regUp: ActiveRegion) {
		/*
		 * Check the upper and lower edges of the given region to see if
		 * they intersect.  If so, create the intersection and add it
		 * to the data structures.
		 *
		 * Returns TRUE if adding the new intersection resulted in a recursive
		 * call to AddRightEdges(); in this case all "dirty" regions have been
		 * checked for intersections, and possibly regUp has been deleted.
		 */
		var regLo = Sweep.regionBelow(regUp);
		var eUp = regUp.eUp;
		var eLo = regLo.eUp;
		var orgUp = eUp.Org;
		var orgLo = eLo.Org;
		var dstUp = eUp.Dst;
		var dstLo = eLo.Dst;
		var tMinUp, tMaxLo;
		var isect = new TESSvertex(),
			orgMin;
		var e;

		assert(!Geom.vertEq(dstLo, dstUp));
		assert(Geom.edgeSign(dstUp, tess.event, orgUp) <= 0);
		assert(Geom.edgeSign(dstLo, tess.event, orgLo) >= 0);
		assert(orgUp !== tess.event && orgLo !== tess.event);
		assert(!regUp.fixUpperEdge && !regLo.fixUpperEdge);

		if (orgUp === orgLo) return false; /* right endpoints are the same */

		tMinUp = Math.min(orgUp.t, dstUp.t);
		tMaxLo = Math.max(orgLo.t, dstLo.t);
		if (tMinUp > tMaxLo) return false; /* t ranges do not overlap */

		if (Geom.vertLeq(orgUp, orgLo)) {
			if (Geom.edgeSign(dstLo, orgUp, orgLo) > 0) return false;
		} else {
			if (Geom.edgeSign(dstUp, orgLo, orgUp) < 0) return false;
		}

		/* At this point the edges intersect, at least marginally */
		Sweep.debugEvent(tess);

		Geom.intersect(dstUp, orgUp, dstLo, orgLo, isect);
		/* The following properties are guaranteed: */
		assert(Math.min(orgUp.t, dstUp.t) <= isect.t);
		assert(isect.t <= Math.max(orgLo.t, dstLo.t));
		assert(Math.min(dstLo.s, dstUp.s) <= isect.s);
		assert(isect.s <= Math.max(orgLo.s, orgUp.s));

		if (Geom.vertLeq(isect, tess.event)) {
			/* The intersection point lies slightly to the left of the sweep line,
			 * so move it until it''s slightly to the right of the sweep line.
			 * (If we had perfect numerical precision, this would never happen
			 * in the first place).  The easiest and safest thing to do is
			 * replace the intersection by tess->event.
			 */
			isect.s = tess.event.s;
			isect.t = tess.event.t;
		}
		/* Similarly, if the computed intersection lies to the right of the
		 * rightmost origin (which should rarely happen), it can cause
		 * unbelievable inefficiency on sufficiently degenerate inputs.
		 * (If you have the test program, try running test54.d with the
		 * "X zoom" option turned on).
		 */
		orgMin = Geom.vertLeq(orgUp, orgLo) ? orgUp : orgLo;
		if (Geom.vertLeq(orgMin, isect)) {
			isect.s = orgMin.s;
			isect.t = orgMin.t;
		}

		if (Geom.vertEq(isect, orgUp) || Geom.vertEq(isect, orgLo)) {
			/* Easy case -- intersection at one of the right endpoints */
			Sweep.checkForRightSplice(tess, regUp);
			return false;
		}

		if (
			(!Geom.vertEq(dstUp, tess.event) &&
				Geom.edgeSign(dstUp, tess.event, isect) >= 0) ||
			(!Geom.vertEq(dstLo, tess.event) &&
				Geom.edgeSign(dstLo, tess.event, isect) <= 0)
		) {
			/* Very unusual -- the new upper or lower edge would pass on the
			 * wrong side of the sweep event, or through it.  This can happen
			 * due to very small numerical errors in the intersection calculation.
			 */
			if (dstLo === tess.event) {
				/* Splice dstLo into eUp, and process the new region(s) */
				tess.mesh.splitEdge(eUp.Sym);
				tess.mesh.splice(eLo.Sym, eUp);
				regUp = Sweep.topLeftRegion(tess, regUp);
				//			if (regUp == NULL) longjmp(tess->env,1);
				eUp = Sweep.regionBelow(regUp).eUp;
				Sweep.finishLeftRegions(tess, Sweep.regionBelow(regUp), regLo);
				Sweep.addRightEdges(tess, regUp, eUp.Oprev, eUp, eUp, true);
				return true;
			}
			if (dstUp === tess.event) {
				/* Splice dstUp into eLo, and process the new region(s) */
				tess.mesh.splitEdge(eLo.Sym);
				tess.mesh.splice(eUp.Lnext, eLo.Oprev);
				regLo = regUp;
				regUp = Sweep.topRightRegion(regUp);
				e = Sweep.regionBelow(regUp).eUp.Rprev;
				regLo.eUp = eLo.Oprev;
				eLo = Sweep.finishLeftRegions(tess, regLo, null);
				Sweep.addRightEdges(tess, regUp, eLo.Onext, eUp.Rprev, e, true);
				return true;
			}
			/* Special case: called from ConnectRightVertex.  If either
			 * edge passes on the wrong side of tess->event, split it
			 * (and wait for ConnectRightVertex to splice it appropriately).
			 */
			if (Geom.edgeSign(dstUp, tess.event, isect) >= 0) {
				Sweep.regionAbove(regUp).dirty = regUp.dirty = true;
				tess.mesh.splitEdge(eUp.Sym);
				eUp.Org.s = tess.event.s;
				eUp.Org.t = tess.event.t;
			}
			if (Geom.edgeSign(dstLo, tess.event, isect) <= 0) {
				regUp.dirty = regLo.dirty = true;
				tess.mesh.splitEdge(eLo.Sym);
				eLo.Org.s = tess.event.s;
				eLo.Org.t = tess.event.t;
			}
			/* leave the rest for ConnectRightVertex */
			return false;
		}

		/* General case -- split both edges, splice into new vertex.
		 * When we do the splice operation, the order of the arguments is
		 * arbitrary as far as correctness goes.  However, when the operation
		 * creates a new face, the work done is proportional to the size of
		 * the new face.  We expect the faces in the processed part of
		 * the mesh (ie. eUp->Lface) to be smaller than the faces in the
		 * unprocessed original contours (which will be eLo->Oprev->Lface).
		 */
		tess.mesh.splitEdge(eUp.Sym);
		tess.mesh.splitEdge(eLo.Sym);
		tess.mesh.splice(eLo.Oprev, eUp);
		eUp.Org.s = isect.s;
		eUp.Org.t = isect.t;
		eUp.Org.pqHandle = tess.pq.insert(eUp.Org);
		Sweep.getIntersectData(tess, eUp.Org, orgUp, dstUp, orgLo, dstLo);
		Sweep.regionAbove(regUp).dirty = regUp.dirty = regLo.dirty = true;
		return false;
	}

	//static void WalkDirtyRegions( TESStesselator *tess, ActiveRegion *regUp )
	static walkDirtyRegions(tess: Tesselator, regUp: ActiveRegion) {
		/*
		 * When the upper or lower edge of any region changes, the region is
		 * marked "dirty".  This routine walks through all the dirty regions
		 * and makes sure that the dictionary invariants are satisfied
		 * (see the comments at the beginning of this file).  Of course
		 * new dirty regions can be created as we make changes to restore
		 * the invariants.
		 */
		var regLo = Sweep.regionBelow(regUp);
		var eUp, eLo;

		for (;;) {
			/* Find the lowest dirty region (we walk from the bottom up). */
			while (regLo.dirty) {
				regUp = regLo;
				regLo = Sweep.regionBelow(regLo);
			}
			if (!regUp.dirty) {
				regLo = regUp;
				regUp = Sweep.regionAbove(regUp);
				if (regUp === null || !regUp.dirty) {
					/* We've walked all the dirty regions */
					return;
				}
			}
			regUp.dirty = false;
			eUp = regUp.eUp;
			eLo = regLo.eUp;

			if (eUp.Dst !== eLo.Dst) {
				/* Check that the edge ordering is obeyed at the Dst vertices. */
				if (Sweep.checkForLeftSplice(tess, regUp)) {
					/* If the upper or lower edge was marked fixUpperEdge, then
					 * we no longer need it (since these edges are needed only for
					 * vertices which otherwise have no right-going edges).
					 */
					if (regLo.fixUpperEdge) {
						Sweep.deleteRegion(tess, regLo);
						tess.mesh.delete(eLo);
						regLo = Sweep.regionBelow(regUp);
						eLo = regLo.eUp;
					} else if (regUp.fixUpperEdge) {
						Sweep.deleteRegion(tess, regUp);
						tess.mesh.delete(eUp);
						regUp = Sweep.regionAbove(regLo);
						eUp = regUp.eUp;
					}
				}
			}
			if (eUp.Org !== eLo.Org) {
				if (
					eUp.Dst !== eLo.Dst &&
					!regUp.fixUpperEdge &&
					!regLo.fixUpperEdge &&
					(eUp.Dst === tess.event || eLo.Dst === tess.event)
				) {
					/* When all else fails in CheckForIntersect(), it uses tess->event
					 * as the intersection location.  To make this possible, it requires
					 * that tess->event lie between the upper and lower edges, and also
					 * that neither of these is marked fixUpperEdge (since in the worst
					 * case it might splice one of these edges into tess->event, and
					 * violate the invariant that fixable edges are the only right-going
					 * edge from their associated vertex).
					 */
					if (Sweep.checkForIntersect(tess, regUp)) {
						/* WalkDirtyRegions() was called recursively; we're done */
						return;
					}
				} else {
					/* Even though we can't use CheckForIntersect(), the Org vertices
					 * may violate the dictionary edge ordering.  Check and correct this.
					 */
					Sweep.checkForRightSplice(tess, regUp);
				}
			}
			if (eUp.Org === eLo.Org && eUp.Dst === eLo.Dst) {
				/* A degenerate loop consisting of only two edges -- delete it. */
				Sweep.addWinding(eLo, eUp);
				Sweep.deleteRegion(tess, regUp);
				tess.mesh.delete(eUp);
				regUp = Sweep.regionAbove(regLo);
			}
		}
	}

	//static void ConnectRightVertex( TESStesselator *tess, ActiveRegion *regUp, TESShalfEdge *eBottomLeft )
	static connectRightVertex(tess: Tesselator, regUp: ActiveRegion, eBottomLeft: TESShalfEdge) {
		/*
		 * Purpose: connect a "right" vertex vEvent (one where all edges go left)
		 * to the unprocessed portion of the mesh.  Since there are no right-going
		 * edges, two regions (one above vEvent and one below) are being merged
		 * into one.  "regUp" is the upper of these two regions.
		 *
		 * There are two reasons for doing this (adding a right-going edge):
		 *  - if the two regions being merged are "inside", we must add an edge
		 *    to keep them separated (the combined region would not be monotone).
		 *  - in any case, we must leave some record of vEvent in the dictionary,
		 *    so that we can merge vEvent with features that we have not seen yet.
		 *    For example, maybe there is a vertical edge which passes just to
		 *    the right of vEvent; we would like to splice vEvent into this edge.
		 *
		 * However, we don't want to connect vEvent to just any vertex.  We don''t
		 * want the new edge to cross any other edges; otherwise we will create
		 * intersection vertices even when the input data had no self-intersections.
		 * (This is a bad thing; if the user's input data has no intersections,
		 * we don't want to generate any false intersections ourselves.)
		 *
		 * Our eventual goal is to connect vEvent to the leftmost unprocessed
		 * vertex of the combined region (the union of regUp and regLo).
		 * But because of unseen vertices with all right-going edges, and also
		 * new vertices which may be created by edge intersections, we don''t
		 * know where that leftmost unprocessed vertex is.  In the meantime, we
		 * connect vEvent to the closest vertex of either chain, and mark the region
		 * as "fixUpperEdge".  This flag says to delete and reconnect this edge
		 * to the next processed vertex on the boundary of the combined region.
		 * Quite possibly the vertex we connected to will turn out to be the
		 * closest one, in which case we won''t need to make any changes.
		 */
		var eNew;
		var eTopLeft = eBottomLeft.Onext;
		var regLo = Sweep.regionBelow(regUp);
		var eUp = regUp.eUp;
		var eLo = regLo.eUp;
		var degenerate = false;

		if (eUp.Dst !== eLo.Dst) {
			Sweep.checkForIntersect(tess, regUp);
		}

		/* Possible new degeneracies: upper or lower edge of regUp may pass
		 * through vEvent, or may coincide with new intersection vertex
		 */
		if (Geom.vertEq(eUp.Org, tess.event)) {
			tess.mesh.splice(eTopLeft.Oprev, eUp);
			regUp = Sweep.topLeftRegion(tess, regUp);
			eTopLeft = Sweep.regionBelow(regUp).eUp;
			Sweep.finishLeftRegions(tess, Sweep.regionBelow(regUp), regLo);
			degenerate = true;
		}
		if (Geom.vertEq(eLo.Org, tess.event)) {
			tess.mesh.splice(eBottomLeft, eLo.Oprev);
			eBottomLeft = Sweep.finishLeftRegions(tess, regLo, null);
			degenerate = true;
		}
		if (degenerate) {
			Sweep.addRightEdges(
				tess,
				regUp,
				eBottomLeft.Onext,
				eTopLeft,
				eTopLeft,
				true,
			);
			return;
		}

		/* Non-degenerate situation -- need to add a temporary, fixable edge.
		 * Connect to the closer of eLo->Org, eUp->Org.
		 */
		if (Geom.vertLeq(eLo.Org, eUp.Org)) {
			eNew = eLo.Oprev;
		} else {
			eNew = eUp;
		}
		eNew = tess.mesh.connect(eBottomLeft.Lprev, eNew);

		/* Prevent cleanup, otherwise eNew might disappear before we've even
		 * had a chance to mark it as a temporary edge.
		 */
		Sweep.addRightEdges(tess, regUp, eNew, eNew.Onext, eNew.Onext, false);
		eNew.Sym.activeRegion.fixUpperEdge = true;
		Sweep.walkDirtyRegions(tess, regUp);
	}

	/* Because vertices at exactly the same location are merged together
	 * before we process the sweep event, some degenerate cases can't occur.
	 * However if someone eventually makes the modifications required to
	 * merge features which are close together, the cases below marked
	 * TOLERANCE_NONZERO will be useful.  They were debugged before the
	 * code to merge identical vertices in the main loop was added.
	 */
	//#define TOLERANCE_NONZERO	FALSE

	//static void ConnectLeftDegenerate( TESStesselator *tess, ActiveRegion *regUp, TESSvertex *vEvent )
	static connectLeftDegenerate(tess: Tesselator, regUp: ActiveRegion, vEvent: TESSvertex) {
		/*
		 * The event vertex lies exacty on an already-processed edge or vertex.
		 * Adding the new vertex involves splicing it into the already-processed
		 * part of the mesh.
		 */
		var e, eTopLeft, eTopRight, eLast;
		var reg;

		e = regUp.eUp;
		if (Geom.vertEq(e.Org, vEvent)) {
			/* e->Org is an unprocessed vertex - just combine them, and wait
			 * for e->Org to be pulled from the queue
			 */
			assert(false /*TOLERANCE_NONZERO*/);
			Sweep.spliceMergeVertices(tess, e, vEvent.anEdge);
			return;
		}

		if (!Geom.vertEq(e.Dst, vEvent)) {
			/* General case -- splice vEvent into edge e which passes through it */
			tess.mesh.splitEdge(e.Sym);
			if (regUp.fixUpperEdge) {
				/* This edge was fixable -- delete unused portion of original edge */
				tess.mesh.delete(e.Onext);
				regUp.fixUpperEdge = false;
			}
			tess.mesh.splice(vEvent.anEdge, e);
			Sweep.sweepEvent(tess, vEvent); /* recurse */
			return;
		}

		/* vEvent coincides with e->Dst, which has already been processed.
		 * Splice in the additional right-going edges.
		 */
		assert(false /*TOLERANCE_NONZERO*/);
		regUp = Sweep.topRightRegion(regUp);
		reg = Sweep.regionBelow(regUp);
		eTopRight = reg.eUp.Sym;
		eTopLeft = eLast = eTopRight.Onext;
		if (reg.fixUpperEdge) {
			/* Here e->Dst has only a single fixable edge going right.
			 * We can delete it since now we have some real right-going edges.
			 */
			assert(eTopLeft !== eTopRight); /* there are some left edges too */
			Sweep.deleteRegion(tess, reg);
			tess.mesh.delete(eTopRight);
			eTopRight = eTopLeft.Oprev;
		}
		tess.mesh.splice(vEvent.anEdge, eTopRight);
		if (!Geom.edgeGoesLeft(eTopLeft)) {
			/* e->Dst had no left-going edges -- indicate this to AddRightEdges() */
			eTopLeft = null;
		}
		Sweep.addRightEdges(
			tess,
			regUp,
			eTopRight.Onext,
			eLast,
			eTopLeft,
			true,
		);
	}

	//static void ConnectLeftVertex( TESStesselator *tess, TESSvertex *vEvent )
	static connectLeftVertex(tess: Tesselator, vEvent: TESSvertex) {
		/*
		 * Purpose: connect a "left" vertex (one where both edges go right)
		 * to the processed portion of the mesh.  Let R be the active region
		 * containing vEvent, and let U and L be the upper and lower edge
		 * chains of R.  There are two possibilities:
		 *
		 * - the normal case: split R into two regions, by connecting vEvent to
		 *   the rightmost vertex of U or L lying to the left of the sweep line
		 *
		 * - the degenerate case: if vEvent is close enough to U or L, we
		 *   merge vEvent into that edge chain.  The subcases are:
		 *	- merging with the rightmost vertex of U or L
		 *	- merging with the active edge of U or L
		 *	- merging with an already-processed portion of U or L
		 */
		var regUp, regLo, reg;
		var eUp, eLo, eNew;
		var tmp = new ActiveRegion();

		/* assert( vEvent->anEdge->Onext->Onext == vEvent->anEdge ); */

		/* Get a pointer to the active region containing vEvent */
		tmp.eUp = vEvent.anEdge.Sym; /* tessDictListSearch */
		/* __GL_DICTLISTKEY */ regUp = tess.dict.search(tmp).key;
		regLo = Sweep.regionBelow(regUp);
		if (!regLo) {
			// This may happen if the input polygon is coplanar.
			return;
		}
		eUp = regUp.eUp;
		eLo = regLo.eUp;

		/* Try merging with U or L first */
		if (Geom.edgeSign(eUp.Dst, vEvent, eUp.Org) === 0.0) {
			Sweep.connectLeftDegenerate(tess, regUp, vEvent);
			return;
		}

		/* Connect vEvent to rightmost processed vertex of either chain.
		 * e->Dst is the vertex that we will connect to vEvent.
		 */
		reg = Geom.vertLeq(eLo.Dst, eUp.Dst) ? regUp : regLo;

		if (regUp.inside || reg.fixUpperEdge) {
			if (reg === regUp) {
				eNew = tess.mesh.connect(vEvent.anEdge.Sym, eUp.Lnext);
			} else {
				var tempHalfEdge = tess.mesh.connect(eLo.Dnext, vEvent.anEdge);
				eNew = tempHalfEdge.Sym;
			}
			if (reg.fixUpperEdge) {
				Sweep.fixUpperEdge(tess, reg, eNew);
			} else {
				Sweep.computeWinding(
					tess,
					Sweep.addRegionBelow(tess, regUp, eNew),
				);
			}
			Sweep.sweepEvent(tess, vEvent);
		} else {
			/* The new vertex is in a region which does not belong to the polygon.
			 * We don''t need to connect this vertex to the rest of the mesh.
			 */
			Sweep.addRightEdges(
				tess,
				regUp,
				vEvent.anEdge,
				vEvent.anEdge,
				null,
				true,
			);
		}
	}

	//static void SweepEvent( TESStesselator *tess, TESSvertex *vEvent )
	static sweepEvent(tess: Tesselator, vEvent: TESSvertex) {
		/*
		 * Does everything necessary when the sweep line crosses a vertex.
		 * Updates the mesh and the edge dictionary.
		 */

		tess.event = vEvent; /* for access in EdgeLeq() */
		Sweep.debugEvent(tess);

		/* Check if this vertex is the right endpoint of an edge that is
		 * already in the dictionary.  In this case we don't need to waste
		 * time searching for the location to insert new edges.
		 */
		var e = vEvent.anEdge;
		while (e.activeRegion === null) {
			e = e.Onext;
			if (e === vEvent.anEdge) {
				/* All edges go right -- not incident to any processed edges */
				Sweep.connectLeftVertex(tess, vEvent);
				return;
			}
		}

		/* Processing consists of two phases: first we "finish" all the
		 * active regions where both the upper and lower edges terminate
		 * at vEvent (ie. vEvent is closing off these regions).
		 * We mark these faces "inside" or "outside" the polygon according
		 * to their winding number, and delete the edges from the dictionary.
		 * This takes care of all the left-going edges from vEvent.
		 */
		var regUp = Sweep.topLeftRegion(tess, e.activeRegion);
		assert(regUp !== null);
		//	if (regUp == NULL) longjmp(tess->env,1);
		var reg = Sweep.regionBelow(regUp);
		var eTopLeft = reg.eUp;
		var eBottomLeft = Sweep.finishLeftRegions(tess, reg, null);

		/* Next we process all the right-going edges from vEvent.  This
		 * involves adding the edges to the dictionary, and creating the
		 * associated "active regions" which record information about the
		 * regions between adjacent dictionary edges.
		 */
		if (eBottomLeft.Onext === eTopLeft) {
			/* No right-going edges -- add a temporary "fixable" edge */
			Sweep.connectRightVertex(tess, regUp, eBottomLeft);
		} else {
			Sweep.addRightEdges(
				tess,
				regUp,
				eBottomLeft.Onext,
				eTopLeft,
				eTopLeft,
				true,
			);
		}
	}

	/* Make the sentinel coordinates big enough that they will never be
	 * merged with real input features.
	 */

	//static void AddSentinel( TESStesselator *tess, TESSreal smin, TESSreal smax, TESSreal t )
	static addSentinel(tess: Tesselator, smin: number, smax: number, t: number) {
		/*
		 * We add two sentinel edges above and below all other edges,
		 * to avoid special cases at the top and bottom.
		 */
		var reg = new ActiveRegion();
		var e = tess.mesh.makeEdge();
		//	if (e == NULL) longjmp(tess->env,1);

		e.Org.s = smax;
		e.Org.t = t;
		e.Dst.s = smin;
		e.Dst.t = t;
		tess.event = e.Dst; /* initialize it */

		reg.eUp = e;
		reg.windingNumber = 0;
		reg.inside = false;
		reg.fixUpperEdge = false;
		reg.sentinel = true;
		reg.dirty = false;
		reg.nodeUp = tess.dict.insert(reg);
		//	if (reg->nodeUp == NULL) longjmp(tess->env,1);
	}

	//static void InitEdgeDict( TESStesselator *tess )
	static initEdgeDict(tess: Tesselator) {
		/*
		 * We maintain an ordering of edge intersections with the sweep line.
		 * This order is maintained in a dynamic dictionary.
		 */
		tess.dict = new Dict(tess, Sweep.edgeLeq);
		//	if (tess->dict == NULL) longjmp(tess->env,1);

		var w = tess.bmax[0] - tess.bmin[0];
		var h = tess.bmax[1] - tess.bmin[1];

		var smin = tess.bmin[0] - w;
		var smax = tess.bmax[0] + w;
		var tmin = tess.bmin[1] - h;
		var tmax = tess.bmax[1] + h;

		Sweep.addSentinel(tess, smin, smax, tmin);
		Sweep.addSentinel(tess, smin, smax, tmax);
	}

	static doneEdgeDict(tess: Tesselator) {
		var reg;
		var fixedEdges = 0;

		while ((reg = tess.dict.min().key) !== null) {
			/*
			 * At the end of all processing, the dictionary should contain
			 * only the two sentinel edges, plus at most one "fixable" edge
			 * created by ConnectRightVertex().
			 */
			if (!reg.sentinel) {
				assert(reg.fixUpperEdge);
				assert(++fixedEdges === 1);
			}
			assert(reg.windingNumber === 0);
			Sweep.deleteRegion(tess, reg);
			/*    tessMeshDelete( reg->eUp );*/
		}
		//	dictDeleteDict( &tess->alloc, tess->dict );
	}

	static removeDegenerateEdges(tess:Tesselator) {
		/*
		 * Remove zero-length edges, and contours with fewer than 3 vertices.
		 */
		var e, eNext, eLnext;
		var eHead = tess.mesh.eHead;

		/*LINTED*/
		for (e = eHead.next; e !== eHead; e = eNext) {
			eNext = e.next;
			eLnext = e.Lnext;

			if (Geom.vertEq(e.Org, e.Dst) && e.Lnext.Lnext !== e) {
				/* Zero-length edge, contour has at least 3 edges */
				Sweep.spliceMergeVertices(tess, eLnext, e); /* deletes e->Org */
				tess.mesh.delete(e); /* e is a self-loop */
				e = eLnext;
				eLnext = e.Lnext;
			}
			if (eLnext.Lnext === e) {
				/* Degenerate contour (one or two edges) */
				if (eLnext !== e) {
					if (eLnext === eNext || eLnext === eNext.Sym) {
						eNext = eNext.next;
					}
					tess.mesh.delete(eLnext);
				}
				if (e === eNext || e === eNext.Sym) {
					eNext = eNext.next;
				}
				tess.mesh.delete(e);
			}
		}
	}

	static initPriorityQ(tess:Tesselator) {
		/*
		 * Insert all vertices into the priority queue which determines the
		 * order in which vertices cross the sweep line.
		 */
		var pq;
		var v, vHead;
		var vertexCount = 0;

		vHead = tess.mesh.vHead;
		for (v = vHead.next; v !== vHead; v = v.next) {
			vertexCount++;
		}
		/* Make sure there is enough space for sentinels. */
		vertexCount += 8; //MAX( 8, tess->alloc.extraVertices );

		pq = tess.pq = new PriorityQ(vertexCount, Geom.vertLeq);
		//	if (pq == NULL) return 0;

		vHead = tess.mesh.vHead;
		for (v = vHead.next; v !== vHead; v = v.next) {
			v.pqHandle = pq.insert(v);
			//		if (v.pqHandle == INV_HANDLE)
			//			break;
		}

		if (v !== vHead) {
			return false;
		}

		pq.init();

		return true;
	}

	static donePriorityQ(tess: Tesselator) {
		tess.pq = null;
	}

	static removeDegenerateFaces(tess: Tesselator, mesh:TESSmesh) {
		/*
		 * Delete any degenerate faces with only two edges.  WalkDirtyRegions()
		 * will catch almost all of these, but it won't catch degenerate faces
		 * produced by splice operations on already-processed edges.
		 * The two places this can happen are in FinishLeftRegions(), when
		 * we splice in a "temporary" edge produced by ConnectRightVertex(),
		 * and in CheckForLeftSplice(), where we splice already-processed
		 * edges to ensure that our dictionary invariants are not violated
		 * by numerical errors.
		 *
		 * In both these cases it is *very* dangerous to delete the offending
		 * edge at the time, since one of the routines further up the stack
		 * will sometimes be keeping a pointer to that edge.
		 */
		var f, fNext;
		var e;

		/*LINTED*/
		for (f = mesh.fHead.next; f !== mesh.fHead; f = fNext) {
			fNext = f.next;
			e = f.anEdge;
			assert(e.Lnext !== e);

			if (e.Lnext.Lnext === e) {
				/* A face with only two edges */
				Sweep.addWinding(e.Onext, e);
				tess.mesh.delete(e);
			}
		}
		return true;
	}

	static computeInterior(tess:Tesselator, validate: boolean = true) {
		/*
		 * tessComputeInterior( tess ) computes the planar arrangement specified
		 * by the given contours, and further subdivides this arrangement
		 * into regions.  Each region is marked "inside" if it belongs
		 * to the polygon, according to the rule given by tess->windingRule.
		 * Each interior region is guaranteed be monotone.
		 */
		var v, vNext;

		/* Each vertex defines an event for our sweep line.  Start by inserting
		 * all the vertices in a priority queue.  Events are processed in
		 * lexicographic order, ie.
		 *
		 *	e1 < e2  iff  e1.x < e2.x || (e1.x == e2.x && e1.y < e2.y)
		 */
		Sweep.removeDegenerateEdges(tess);
		
		/* if error */
		if (!Sweep.initPriorityQ(tess)) {
			return false;
		}

		Sweep.initEdgeDict(tess);

		while ((v = tess.pq.extractMin()) !== null) {
			for (;;) {
				vNext = tess.pq.min();
				if (vNext === null || !Geom.vertEq(vNext, v)) break;

				/* Merge together all vertices at exactly the same location.
				 * This is more efficient than processing them one at a time,
				 * simplifies the code (see ConnectLeftDegenerate), and is also
				 * important for correct handling of certain degenerate cases.
				 * For example, suppose there are two identical edges A and B
				 * that belong to different contours (so without this code they would
				 * be processed by separate sweep events).  Suppose another edge C
				 * crosses A and B from above.  When A is processed, we split it
				 * at its intersection point with C.  However this also splits C,
				 * so when we insert B we may compute a slightly different
				 * intersection point.  This might leave two edges with a small
				 * gap between them.  This kind of error is especially obvious
				 * when using boundary extraction (TESS_BOUNDARY_ONLY).
				 */
				vNext = tess.pq.extractMin();
				Sweep.spliceMergeVertices(tess, v.anEdge, vNext.anEdge);
			}
			Sweep.sweepEvent(tess, v);
		}

		/* Set tess->event for debugging purposes */
		tess.event = tess.dict.min().key.eUp.Org;

		Sweep.debugEvent(tess);
		Sweep.doneEdgeDict(tess);
		Sweep.donePriorityQ(tess);

		if (!Sweep.removeDegenerateFaces(tess, tess.mesh)) {
			return false;
		}

		if(validate) {
			tess.mesh.check();
		}

		return true;
	}
}
