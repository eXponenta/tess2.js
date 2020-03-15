var Tess2 = (function (exports) {
	'use strict';

	(function (WINDING) {
	    WINDING[WINDING["ODD"] = 0] = "ODD";
	    WINDING[WINDING["NONZERO"] = 1] = "NONZERO";
	    WINDING[WINDING["POSITIVE"] = 2] = "POSITIVE";
	    WINDING[WINDING["NEGATIVE"] = 3] = "NEGATIVE";
	    WINDING[WINDING["ABS_GEQ_TWO"] = 4] = "ABS_GEQ_TWO";
	})(exports.WINDING || (exports.WINDING = {}));
	(function (ELEMENT) {
	    ELEMENT[ELEMENT["POLYGONS"] = 0] = "POLYGONS";
	    ELEMENT[ELEMENT["CONNECTED_POLYGONS"] = 1] = "CONNECTED_POLYGONS";
	    ELEMENT[ELEMENT["BOUNDARY_CONTOURS"] = 2] = "BOUNDARY_CONTOURS";
	})(exports.MODE || (exports.MODE = {}));

	function assert(cond, message = undefined) {
	    if (!cond) {
	        throw message || "Assertion Failed!";
	    }
	}

	class Geom {
	    static vertEq(u, v) {
	        return u.s === v.s && u.t === v.t;
	    }
	    static vertLeq(u, v) {
	        return u.s < v.s || (u.s === v.s && u.t <= v.t);
	    }
	    static transLeq(u, v) {
	        return u.t < v.t || (u.t === v.t && u.s <= v.s);
	    }
	    static edgeGoesLeft(e) {
	        return Geom.vertLeq(e.Dst, e.Org);
	    }
	    static edgeGoesRight(e) {
	        return Geom.vertLeq(e.Org, e.Dst);
	    }
	    static vertL1dist(u, v) {
	        return Math.abs(u.s - v.s) + Math.abs(u.t - v.t);
	    }
	    static edgeEval(u, v, w) {
	        assert(Geom.vertLeq(u, v) && Geom.vertLeq(v, w));
	        var gapL = v.s - u.s;
	        var gapR = w.s - v.s;
	        if (gapL + gapR > 0.0) {
	            if (gapL < gapR) {
	                return v.t - u.t + (u.t - w.t) * (gapL / (gapL + gapR));
	            }
	            else {
	                return v.t - w.t + (w.t - u.t) * (gapR / (gapL + gapR));
	            }
	        }
	        return 0.0;
	    }
	    static edgeSign(u, v, w) {
	        assert(Geom.vertLeq(u, v) && Geom.vertLeq(v, w));
	        var gapL = v.s - u.s;
	        var gapR = w.s - v.s;
	        if (gapL + gapR > 0.0) {
	            return (v.t - w.t) * gapL + (v.t - u.t) * gapR;
	        }
	        return 0.0;
	    }
	    static transEval(u, v, w) {
	        assert(Geom.transLeq(u, v) && Geom.transLeq(v, w));
	        var gapL = v.t - u.t;
	        var gapR = w.t - v.t;
	        if (gapL + gapR > 0.0) {
	            if (gapL < gapR) {
	                return v.s - u.s + (u.s - w.s) * (gapL / (gapL + gapR));
	            }
	            else {
	                return v.s - w.s + (w.s - u.s) * (gapR / (gapL + gapR));
	            }
	        }
	        return 0.0;
	    }
	    static transSign(u, v, w) {
	        assert(Geom.transLeq(u, v) && Geom.transLeq(v, w));
	        var gapL = v.t - u.t;
	        var gapR = w.t - v.t;
	        if (gapL + gapR > 0.0) {
	            return (v.s - w.s) * gapL + (v.s - u.s) * gapR;
	        }
	        return 0.0;
	    }
	    static vertCCW(u, v, w) {
	        return u.s * (v.t - w.t) + v.s * (w.t - u.t) + w.s * (u.t - v.t) >= 0.0;
	    }
	    static interpolate(a, x, b, y) {
	        return ((a = a < 0 ? 0 : a),
	            (b = b < 0 ? 0 : b),
	            a <= b
	                ? b === 0
	                    ? (x + y) / 2
	                    : x + (y - x) * (a / (a + b))
	                : y + (x - y) * (b / (a + b)));
	    }
	    static intersect(o1, d1, o2, d2, v) {
	        var z1, z2;
	        var t;
	        if (!Geom.vertLeq(o1, d1)) {
	            t = o1;
	            o1 = d1;
	            d1 = t;
	        }
	        if (!Geom.vertLeq(o2, d2)) {
	            t = o2;
	            o2 = d2;
	            d2 = t;
	        }
	        if (!Geom.vertLeq(o1, o2)) {
	            t = o1;
	            o1 = o2;
	            o2 = t;
	            t = d1;
	            d1 = d2;
	            d2 = t;
	        }
	        if (!Geom.vertLeq(o2, d1)) {
	            v.s = (o2.s + d1.s) / 2;
	        }
	        else if (Geom.vertLeq(d1, d2)) {
	            z1 = Geom.edgeEval(o1, o2, d1);
	            z2 = Geom.edgeEval(o2, d1, d2);
	            if (z1 + z2 < 0) {
	                z1 = -z1;
	                z2 = -z2;
	            }
	            v.s = Geom.interpolate(z1, o2.s, z2, d1.s);
	        }
	        else {
	            z1 = Geom.edgeSign(o1, o2, d1);
	            z2 = -Geom.edgeSign(o1, d2, d1);
	            if (z1 + z2 < 0) {
	                z1 = -z1;
	                z2 = -z2;
	            }
	            v.s = Geom.interpolate(z1, o2.s, z2, d2.s);
	        }
	        if (!Geom.transLeq(o1, d1)) {
	            t = o1;
	            o1 = d1;
	            d1 = t;
	        }
	        if (!Geom.transLeq(o2, d2)) {
	            t = o2;
	            o2 = d2;
	            d2 = t;
	        }
	        if (!Geom.transLeq(o1, o2)) {
	            t = o1;
	            o1 = o2;
	            o2 = t;
	            t = d1;
	            d1 = d2;
	            d2 = t;
	        }
	        if (!Geom.transLeq(o2, d1)) {
	            v.t = (o2.t + d1.t) / 2;
	        }
	        else if (Geom.transLeq(d1, d2)) {
	            z1 = Geom.transEval(o1, o2, d1);
	            z2 = Geom.transEval(o2, d1, d2);
	            if (z1 + z2 < 0) {
	                z1 = -z1;
	                z2 = -z2;
	            }
	            v.t = Geom.interpolate(z1, o2.t, z2, d1.t);
	        }
	        else {
	            z1 = Geom.transSign(o1, o2, d1);
	            z2 = -Geom.transSign(o1, d2, d1);
	            if (z1 + z2 < 0) {
	                z1 = -z1;
	                z2 = -z2;
	            }
	            v.t = Geom.interpolate(z1, o2.t, z2, d2.t);
	        }
	    }
	}

	class TESSface {
	    constructor() {
	        this.next = null;
	        this.prev = null;
	        this.anEdge = null;
	        this.trail = null;
	        this.n = 0;
	        this.marked = false;
	        this.inside = false;
	    }
	}

	class TESShalfEdge {
	    constructor(side) {
	        this.side = side;
	        this.next = null;
	        this.Org = null;
	        this.Sym = null;
	        this.Onext = null;
	        this.Lnext = null;
	        this.Lface = null;
	        this.activeRegion = null;
	        this.winding = 0;
	    }
	    ;
	    get Rface() {
	        return this.Sym.Lface;
	    }
	    set Rface(v) {
	        this.Sym.Lface = v;
	    }
	    get Dst() {
	        return this.Sym.Org;
	    }
	    set Dst(v) {
	        this.Sym.Org = v;
	    }
	    get Oprev() {
	        return this.Sym.Lnext;
	    }
	    set Oprev(v) {
	        this.Sym.Lnext = v;
	    }
	    get Lprev() {
	        return this.Onext.Sym;
	    }
	    set Lprev(v) {
	        this.Onext.Sym = v;
	    }
	    get Dprev() {
	        return this.Lnext.Sym;
	    }
	    set Dprev(v) {
	        this.Lnext.Sym = v;
	    }
	    get Rprev() {
	        return this.Sym.Onext;
	    }
	    set Rprev(v) {
	        this.Sym.Onext = v;
	    }
	    get Dnext() {
	        return this.Sym.Onext.Sym;
	    }
	    set Dnext(v) {
	        this.Sym.Onext.Sym = v;
	    }
	    get Rnext() {
	        return this.Sym.Lnext.Sym;
	    }
	    set Rnext(v) {
	        this.Sym.Lnext.Sym = v;
	    }
	}

	class TESSvertex {
	    constructor() {
	        this.next = null;
	        this.prev = null;
	        this.anEdge = null;
	        this.coords = [0, 0, 0];
	        this.s = 0.0;
	        this.t = 0.0;
	        this.pqHandle = 0;
	        this.n = 0;
	        this.idx = 0;
	    }
	}

	class TESSmesh {
	    constructor() {
	        const v = new TESSvertex();
	        const f = new TESSface();
	        const e = new TESShalfEdge(0);
	        const eSym = new TESShalfEdge(1);
	        v.next = v.prev = v;
	        v.anEdge = null;
	        f.next = f.prev = f;
	        e.next = e;
	        e.Sym = eSym;
	        eSym.next = eSym;
	        eSym.Sym = e;
	        this.vHead = v;
	        this.fHead = f;
	        this.eHead = e;
	        this.eHeadSym = eSym;
	    }
	    makeEdge_(eNext) {
	        var e = new TESShalfEdge(0);
	        var eSym = new TESShalfEdge(1);
	        if (eNext.Sym.side < eNext.side) {
	            eNext = eNext.Sym;
	        }
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
	    }
	    splice_(a, b) {
	        var aOnext = a.Onext;
	        var bOnext = b.Onext;
	        aOnext.Sym.Lnext = b;
	        bOnext.Sym.Lnext = a;
	        a.Onext = bOnext;
	        b.Onext = aOnext;
	    }
	    makeVertex_(newVertex, eOrig, vNext) {
	        var vNew = newVertex;
	        assert(vNew, "Vertex can't be null!");
	        var vPrev = vNext.prev;
	        vNew.prev = vPrev;
	        vPrev.next = vNew;
	        vNew.next = vNext;
	        vNext.prev = vNew;
	        vNew.anEdge = eOrig;
	        var e = eOrig;
	        do {
	            e.Org = vNew;
	            e = e.Onext;
	        } while (e !== eOrig);
	    }
	    makeFace_(newFace, eOrig, fNext) {
	        var fNew = newFace;
	        assert(fNew, "Face can't be null");
	        var fPrev = fNext.prev;
	        fNew.prev = fPrev;
	        fPrev.next = fNew;
	        fNew.next = fNext;
	        fNext.prev = fNew;
	        fNew.anEdge = eOrig;
	        fNew.trail = null;
	        fNew.marked = false;
	        fNew.inside = fNext.inside;
	        var e = eOrig;
	        do {
	            e.Lface = fNew;
	            e = e.Lnext;
	        } while (e !== eOrig);
	    }
	    killEdge_(eDel) {
	        if (eDel.Sym.side < eDel.side) {
	            eDel = eDel.Sym;
	        }
	        var eNext = eDel.next;
	        var ePrev = eDel.Sym.next;
	        eNext.Sym.next = ePrev;
	        ePrev.Sym.next = eNext;
	    }
	    killVertex_(vDel, newOrg) {
	        var eStart = vDel.anEdge;
	        var e = eStart;
	        do {
	            e.Org = newOrg;
	            e = e.Onext;
	        } while (e !== eStart);
	        var vPrev = vDel.prev;
	        var vNext = vDel.next;
	        vNext.prev = vPrev;
	        vPrev.next = vNext;
	    }
	    killFace_(fDel, newLface) {
	        var eStart = fDel.anEdge;
	        var e = eStart;
	        do {
	            e.Lface = newLface;
	            e = e.Lnext;
	        } while (e !== eStart);
	        var fPrev = fDel.prev;
	        var fNext = fDel.next;
	        fNext.prev = fPrev;
	        fPrev.next = fNext;
	    }
	    makeEdge() {
	        var newVertex1 = new TESSvertex();
	        var newVertex2 = new TESSvertex();
	        var newFace = new TESSface();
	        var e = this.makeEdge_(this.eHead);
	        this.makeVertex_(newVertex1, e, this.vHead);
	        this.makeVertex_(newVertex2, e.Sym, this.vHead);
	        this.makeFace_(newFace, e, this.fHead);
	        return e;
	    }
	    splice(eOrg, eDst) {
	        var joiningLoops = false;
	        var joiningVertices = false;
	        if (eOrg === eDst)
	            return;
	        if (eDst.Org !== eOrg.Org) {
	            joiningVertices = true;
	            this.killVertex_(eDst.Org, eOrg.Org);
	        }
	        if (eDst.Lface !== eOrg.Lface) {
	            joiningLoops = true;
	            this.killFace_(eDst.Lface, eOrg.Lface);
	        }
	        this.splice_(eDst, eOrg);
	        if (!joiningVertices) {
	            var newVertex = new TESSvertex();
	            this.makeVertex_(newVertex, eDst, eOrg.Org);
	            eOrg.Org.anEdge = eOrg;
	        }
	        if (!joiningLoops) {
	            var newFace = new TESSface();
	            this.makeFace_(newFace, eDst, eOrg.Lface);
	            eOrg.Lface.anEdge = eOrg;
	        }
	    }
	    delete(eDel) {
	        var eDelSym = eDel.Sym;
	        var joiningLoops = false;
	        if (eDel.Lface !== eDel.Rface) {
	            joiningLoops = true;
	            this.killFace_(eDel.Lface, eDel.Rface);
	        }
	        if (eDel.Onext === eDel) {
	            this.killVertex_(eDel.Org, null);
	        }
	        else {
	            eDel.Rface.anEdge = eDel.Oprev;
	            eDel.Org.anEdge = eDel.Onext;
	            this.splice_(eDel, eDel.Oprev);
	            if (!joiningLoops) {
	                var newFace = new TESSface();
	                this.makeFace_(newFace, eDel, eDel.Lface);
	            }
	        }
	        if (eDelSym.Onext === eDelSym) {
	            this.killVertex_(eDelSym.Org, null);
	            this.killFace_(eDelSym.Lface, null);
	        }
	        else {
	            eDel.Lface.anEdge = eDelSym.Oprev;
	            eDelSym.Org.anEdge = eDelSym.Onext;
	            this.splice_(eDelSym, eDelSym.Oprev);
	        }
	        this.killEdge_(eDel);
	    }
	    addEdgeVertex(eOrg) {
	        var eNew = this.makeEdge_(eOrg);
	        var eNewSym = eNew.Sym;
	        this.splice_(eNew, eOrg.Lnext);
	        eNew.Org = eOrg.Dst;
	        var newVertex = new TESSvertex();
	        this.makeVertex_(newVertex, eNewSym, eNew.Org);
	        eNew.Lface = eNewSym.Lface = eOrg.Lface;
	        return eNew;
	    }
	    splitEdge(eOrg) {
	        var tempHalfEdge = this.addEdgeVertex(eOrg);
	        var eNew = tempHalfEdge.Sym;
	        this.splice_(eOrg.Sym, eOrg.Sym.Oprev);
	        this.splice_(eOrg.Sym, eNew);
	        eOrg.Dst = eNew.Org;
	        eNew.Dst.anEdge = eNew.Sym;
	        eNew.Rface = eOrg.Rface;
	        eNew.winding = eOrg.winding;
	        eNew.Sym.winding = eOrg.Sym.winding;
	        return eNew;
	    }
	    connect(eOrg, eDst) {
	        var joiningLoops = false;
	        var eNew = this.makeEdge_(eOrg);
	        var eNewSym = eNew.Sym;
	        if (eDst.Lface !== eOrg.Lface) {
	            joiningLoops = true;
	            this.killFace_(eDst.Lface, eOrg.Lface);
	        }
	        this.splice_(eNew, eOrg.Lnext);
	        this.splice_(eNewSym, eDst);
	        eNew.Org = eOrg.Dst;
	        eNewSym.Org = eDst.Org;
	        eNew.Lface = eNewSym.Lface = eOrg.Lface;
	        eOrg.Lface.anEdge = eNewSym;
	        if (!joiningLoops) {
	            var newFace = new TESSface();
	            this.makeFace_(newFace, eNew, eOrg.Lface);
	        }
	        return eNew;
	    }
	    zapFace(fZap) {
	        var eStart = fZap.anEdge;
	        var e, eNext, eSym;
	        var fPrev, fNext;
	        eNext = eStart.Lnext;
	        do {
	            e = eNext;
	            eNext = e.Lnext;
	            e.Lface = null;
	            if (e.Rface === null) {
	                if (e.Onext === e) {
	                    this.killVertex_(e.Org, null);
	                }
	                else {
	                    e.Org.anEdge = e.Onext;
	                    this.splice_(e, e.Oprev);
	                }
	                eSym = e.Sym;
	                if (eSym.Onext === eSym) {
	                    this.killVertex_(eSym.Org, null);
	                }
	                else {
	                    eSym.Org.anEdge = eSym.Onext;
	                    this.splice_(eSym, eSym.Oprev);
	                }
	                this.killEdge_(e);
	            }
	        } while (e != eStart);
	        fPrev = fZap.prev;
	        fNext = fZap.next;
	        fNext.prev = fPrev;
	        fPrev.next = fNext;
	    }
	    countFaceVerts_(f) {
	        var eCur = f.anEdge;
	        var n = 0;
	        do {
	            n++;
	            eCur = eCur.Lnext;
	        } while (eCur !== f.anEdge);
	        return n;
	    }
	    mergeConvexFaces(maxVertsPerFace) {
	        var f;
	        var eCur, eNext, eSym;
	        var vStart;
	        var curNv, symNv;
	        for (f = this.fHead.next; f !== this.fHead; f = f.next) {
	            if (!f.inside)
	                continue;
	            eCur = f.anEdge;
	            vStart = eCur.Org;
	            while (true) {
	                eNext = eCur.Lnext;
	                eSym = eCur.Sym;
	                if (eSym && eSym.Lface && eSym.Lface.inside) {
	                    curNv = this.countFaceVerts_(f);
	                    symNv = this.countFaceVerts_(eSym.Lface);
	                    if (curNv + symNv - 2 <= maxVertsPerFace) {
	                        if (Geom.vertCCW(eCur.Lprev.Org, eCur.Org, eSym.Lnext.Lnext.Org) &&
	                            Geom.vertCCW(eSym.Lprev.Org, eSym.Org, eCur.Lnext.Lnext.Org)) {
	                            eNext = eSym.Lnext;
	                            this.delete(eSym);
	                            eCur = null;
	                            eSym = null;
	                        }
	                    }
	                }
	                if (eCur && eCur.Lnext.Org === vStart)
	                    break;
	                eCur = eNext;
	            }
	        }
	        return true;
	    }
	    check() {
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
	        assert(e.Sym.next === ePrev.Sym &&
	            e.Sym === this.eHeadSym &&
	            e.Sym.Sym === e &&
	            e.Org === null &&
	            e.Dst === null &&
	            e.Lface === null &&
	            e.Rface === null);
	    }
	}

	class PQnode {
	    constructor() {
	        this.handle = null;
	    }
	}
	class PQhandleElem {
	    constructor() {
	        this.key = null;
	        this.node = 0;
	    }
	}
	class PriorityQ {
	    constructor(size, leq) {
	        this.leq = leq;
	        this.max = 0;
	        this.nodes = [];
	        this.handles = [];
	        this.initialized = false;
	        this.freeList = 0;
	        this.size = 0;
	        this.max = size;
	        this.nodes = Array.from({ length: size + 1 }, () => new PQnode());
	        this.handles = Array.from({ length: size + 1 }, () => new PQhandleElem());
	        this.initialized = false;
	        this.nodes[1].handle = 1;
	        this.handles[1].key = null;
	    }
	    floatDown_(curr) {
	        var n = this.nodes;
	        var h = this.handles;
	        var hCurr, hChild;
	        var child;
	        hCurr = n[curr].handle;
	        for (;;) {
	            child = curr << 1;
	            if (child < this.size &&
	                this.leq(h[n[child + 1].handle].key, h[n[child].handle].key)) {
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
	    }
	    floatUp_(curr) {
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
	    }
	    init() {
	        for (let i = this.size; i >= 1; --i) {
	            this.floatDown_(i);
	        }
	        this.initialized = true;
	    }
	    min() {
	        return this.handles[this.nodes[1].handle].key;
	    }
	    insert(keyNew) {
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
	        }
	        else {
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
	    }
	    extractMin() {
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
	    }
	    delete(hCurr) {
	        var n = this.nodes;
	        var h = this.handles;
	        var curr;
	        assert(hCurr >= 1 && hCurr <= this.max && h[hCurr].key !== null);
	        curr = h[hCurr].node;
	        n[curr].handle = n[this.size].handle;
	        h[n[curr].handle].node = curr;
	        --this.size;
	        if (curr <= this.size) {
	            if (curr <= 1 ||
	                this.leq(h[n[curr >> 1].handle].key, h[n[curr].handle].key)) {
	                this.floatDown_(curr);
	            }
	            else {
	                this.floatUp_(curr);
	            }
	        }
	        h[hCurr].key = null;
	        h[hCurr].node = this.freeList;
	        this.freeList = hCurr;
	    }
	}

	class ActiveRegion {
	    constructor() {
	        this.eUp = null;
	        this.nodeUp = null;
	        this.windingNumber = 0;
	        this.inside = false;
	        this.sentinel = false;
	        this.dirty = false;
	        this.fixUpperEdge = false;
	    }
	}

	class DictNode {
	    constructor() {
	        this.key = null;
	        this.next = null;
	        this.prev = null;
	    }
	}
	class Dict {
	    constructor(frame, leq) {
	        this.frame = frame;
	        this.leq = leq;
	        this.head = new DictNode();
	        this.head.next = this.head;
	        this.head.prev = this.head;
	    }
	    min() {
	        return this.head.next;
	    }
	    max() {
	        return this.head.prev;
	    }
	    insert(k) {
	        return this.insertBefore(this.head, k);
	    }
	    search(key) {
	        let node = this.head;
	        do {
	            node = node.next;
	        } while (node.key !== null && !this.leq(this.frame, key, node.key));
	        return node;
	    }
	    insertBefore(node, key) {
	        do {
	            node = node.prev;
	        } while (node.key !== null && !this.leq(this.frame, node.key, key));
	        const newNode = new DictNode();
	        newNode.key = key;
	        newNode.next = node.next;
	        node.next.prev = newNode;
	        newNode.prev = node;
	        node.next = newNode;
	        return newNode;
	    }
	    delete(node) {
	        node.next.prev = node.prev;
	        node.prev.next = node.next;
	    }
	}

	class Sweep {
	    static regionBelow(r) {
	        return r.nodeUp.prev.key;
	    }
	    static regionAbove(r) {
	        return r.nodeUp.next.key;
	    }
	    static debugEvent(tess) {
	    }
	    static addWinding(eDst, eSrc) {
	        eDst.winding += eSrc.winding;
	        eDst.Sym.winding += eSrc.Sym.winding;
	    }
	    static edgeLeq(tess, reg1, reg2) {
	        var ev = tess.event;
	        var e1 = reg1.eUp;
	        var e2 = reg2.eUp;
	        if (e1.Dst === ev) {
	            if (e2.Dst === ev) {
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
	        const t1 = Geom.edgeEval(e1.Dst, ev, e1.Org);
	        const t2 = Geom.edgeEval(e2.Dst, ev, e2.Org);
	        return t1 >= t2;
	    }
	    static deleteRegion(tess, reg) {
	        if (reg.fixUpperEdge) {
	            assert(reg.eUp.winding === 0);
	        }
	        reg.eUp.activeRegion = null;
	        tess.dict.delete(reg.nodeUp);
	    }
	    static fixUpperEdge(tess, reg, newEdge) {
	        assert(reg.fixUpperEdge);
	        tess.mesh.delete(reg.eUp);
	        reg.fixUpperEdge = false;
	        reg.eUp = newEdge;
	        newEdge.activeRegion = reg;
	    }
	    static topLeftRegion(tess, reg) {
	        var org = reg.eUp.Org;
	        var e;
	        do {
	            reg = Sweep.regionAbove(reg);
	        } while (reg.eUp.Org === org);
	        if (reg.fixUpperEdge) {
	            e = tess.mesh.connect(Sweep.regionBelow(reg).eUp.Sym, reg.eUp.Lnext);
	            if (e === null)
	                return null;
	            Sweep.fixUpperEdge(tess, reg, e);
	            reg = Sweep.regionAbove(reg);
	        }
	        return reg;
	    }
	    static topRightRegion(reg) {
	        var dst = reg.eUp.Dst;
	        do {
	            reg = Sweep.regionAbove(reg);
	        } while (reg.eUp.Dst === dst);
	        return reg;
	    }
	    static addRegionBelow(tess, regAbove, eNewUp) {
	        var regNew = new ActiveRegion();
	        regNew.eUp = eNewUp;
	        regNew.nodeUp = tess.dict.insertBefore(regAbove.nodeUp, regNew);
	        regNew.fixUpperEdge = false;
	        regNew.sentinel = false;
	        regNew.dirty = false;
	        eNewUp.activeRegion = regNew;
	        return regNew;
	    }
	    static isWindingInside(tess, n) {
	        switch (tess.windingRule) {
	            case exports.WINDING.ODD:
	                return (n & 1) !== 0;
	            case exports.WINDING.NONZERO:
	                return n !== 0;
	            case exports.WINDING.POSITIVE:
	                return n > 0;
	            case exports.WINDING.NEGATIVE:
	                return n < 0;
	            case exports.WINDING.ABS_GEQ_TWO:
	                return n >= 2 || n <= -2;
	        }
	        throw new Error("Invalid winding rulle");
	    }
	    static computeWinding(tess, reg) {
	        reg.windingNumber =
	            Sweep.regionAbove(reg).windingNumber + reg.eUp.winding;
	        reg.inside = Sweep.isWindingInside(tess, reg.windingNumber);
	    }
	    static finishRegion(tess, reg) {
	        var e = reg.eUp;
	        var f = e.Lface;
	        f.inside = reg.inside;
	        f.anEdge = e;
	        Sweep.deleteRegion(tess, reg);
	    }
	    static finishLeftRegions(tess, regFirst, regLast) {
	        var e;
	        var reg = null;
	        var regPrev = regFirst;
	        var ePrev = regFirst.eUp;
	        while (regPrev !== regLast) {
	            regPrev.fixUpperEdge = false;
	            reg = Sweep.regionBelow(regPrev);
	            e = reg.eUp;
	            if (e.Org != ePrev.Org) {
	                if (!reg.fixUpperEdge) {
	                    Sweep.finishRegion(tess, regPrev);
	                    break;
	                }
	                e = tess.mesh.connect(ePrev.Lprev, e.Sym);
	                Sweep.fixUpperEdge(tess, reg, e);
	            }
	            if (ePrev.Onext !== e) {
	                tess.mesh.splice(e.Oprev, e);
	                tess.mesh.splice(ePrev, e);
	            }
	            Sweep.finishRegion(tess, regPrev);
	            ePrev = reg.eUp;
	            regPrev = reg;
	        }
	        return ePrev;
	    }
	    static addRightEdges(tess, regUp, eFirst, eLast, eTopLeft, cleanUp) {
	        var reg, regPrev;
	        var e, ePrev;
	        var firstTime = true;
	        e = eFirst;
	        do {
	            assert(Geom.vertLeq(e.Org, e.Dst));
	            Sweep.addRegionBelow(tess, regUp, e.Sym);
	            e = e.Onext;
	        } while (e !== eLast);
	        if (eTopLeft === null) {
	            eTopLeft = Sweep.regionBelow(regUp).eUp.Rprev;
	        }
	        regPrev = regUp;
	        ePrev = eTopLeft;
	        for (;;) {
	            reg = Sweep.regionBelow(regPrev);
	            e = reg.eUp.Sym;
	            if (e.Org !== ePrev.Org)
	                break;
	            if (e.Onext !== ePrev) {
	                tess.mesh.splice(e.Oprev, e);
	                tess.mesh.splice(ePrev.Oprev, e);
	            }
	            reg.windingNumber = regPrev.windingNumber - e.winding;
	            reg.inside = Sweep.isWindingInside(tess, reg.windingNumber);
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
	            Sweep.walkDirtyRegions(tess, regPrev);
	        }
	    }
	    static spliceMergeVertices(tess, e1, e2) {
	        tess.mesh.splice(e1, e2);
	    }
	    static vertexWeights(isect, org, dst) {
	        var t1 = Geom.vertL1dist(org, isect);
	        var t2 = Geom.vertL1dist(dst, isect);
	        var w0 = (0.5 * t2) / (t1 + t2);
	        var w1 = (0.5 * t1) / (t1 + t2);
	        isect.coords[0] += w0 * org.coords[0] + w1 * dst.coords[0];
	        isect.coords[1] += w0 * org.coords[1] + w1 * dst.coords[1];
	        isect.coords[2] += w0 * org.coords[2] + w1 * dst.coords[2];
	    }
	    static getIntersectData(tess, isect, orgUp, dstUp, orgLo, dstLo) {
	        isect.coords[0] = isect.coords[1] = isect.coords[2] = 0;
	        isect.idx = -1;
	        Sweep.vertexWeights(isect, orgUp, dstUp);
	        Sweep.vertexWeights(isect, orgLo, dstLo);
	    }
	    static checkForRightSplice(tess, regUp) {
	        var regLo = Sweep.regionBelow(regUp);
	        var eUp = regUp.eUp;
	        var eLo = regLo.eUp;
	        if (Geom.vertLeq(eUp.Org, eLo.Org)) {
	            if (Geom.edgeSign(eLo.Dst, eUp.Org, eLo.Org) > 0)
	                return false;
	            if (!Geom.vertEq(eUp.Org, eLo.Org)) {
	                tess.mesh.splitEdge(eLo.Sym);
	                tess.mesh.splice(eUp, eLo.Oprev);
	                regUp.dirty = regLo.dirty = true;
	            }
	            else if (eUp.Org !== eLo.Org) {
	                tess.pq.delete(eUp.Org.pqHandle);
	                Sweep.spliceMergeVertices(tess, eLo.Oprev, eUp);
	            }
	        }
	        else {
	            if (Geom.edgeSign(eUp.Dst, eLo.Org, eUp.Org) < 0)
	                return false;
	            Sweep.regionAbove(regUp).dirty = regUp.dirty = true;
	            tess.mesh.splitEdge(eUp.Sym);
	            tess.mesh.splice(eLo.Oprev, eUp);
	        }
	        return true;
	    }
	    static checkForLeftSplice(tess, regUp) {
	        var regLo = Sweep.regionBelow(regUp);
	        var eUp = regUp.eUp;
	        var eLo = regLo.eUp;
	        var e;
	        assert(!Geom.vertEq(eUp.Dst, eLo.Dst));
	        if (Geom.vertLeq(eUp.Dst, eLo.Dst)) {
	            if (Geom.edgeSign(eUp.Dst, eLo.Dst, eUp.Org) < 0)
	                return false;
	            Sweep.regionAbove(regUp).dirty = regUp.dirty = true;
	            e = tess.mesh.splitEdge(eUp);
	            tess.mesh.splice(eLo.Sym, e);
	            e.Lface.inside = regUp.inside;
	        }
	        else {
	            if (Geom.edgeSign(eLo.Dst, eUp.Dst, eLo.Org) > 0)
	                return false;
	            regUp.dirty = regLo.dirty = true;
	            e = tess.mesh.splitEdge(eLo);
	            tess.mesh.splice(eUp.Lnext, eLo.Sym);
	            e.Rface.inside = regUp.inside;
	        }
	        return true;
	    }
	    static checkForIntersect(tess, regUp) {
	        var regLo = Sweep.regionBelow(regUp);
	        var eUp = regUp.eUp;
	        var eLo = regLo.eUp;
	        var orgUp = eUp.Org;
	        var orgLo = eLo.Org;
	        var dstUp = eUp.Dst;
	        var dstLo = eLo.Dst;
	        var tMinUp, tMaxLo;
	        var isect = new TESSvertex(), orgMin;
	        var e;
	        assert(!Geom.vertEq(dstLo, dstUp));
	        assert(Geom.edgeSign(dstUp, tess.event, orgUp) <= 0);
	        assert(Geom.edgeSign(dstLo, tess.event, orgLo) >= 0);
	        assert(orgUp !== tess.event && orgLo !== tess.event);
	        assert(!regUp.fixUpperEdge && !regLo.fixUpperEdge);
	        if (orgUp === orgLo)
	            return false;
	        tMinUp = Math.min(orgUp.t, dstUp.t);
	        tMaxLo = Math.max(orgLo.t, dstLo.t);
	        if (tMinUp > tMaxLo)
	            return false;
	        if (Geom.vertLeq(orgUp, orgLo)) {
	            if (Geom.edgeSign(dstLo, orgUp, orgLo) > 0)
	                return false;
	        }
	        else {
	            if (Geom.edgeSign(dstUp, orgLo, orgUp) < 0)
	                return false;
	        }
	        Sweep.debugEvent(tess);
	        Geom.intersect(dstUp, orgUp, dstLo, orgLo, isect);
	        assert(Math.min(orgUp.t, dstUp.t) <= isect.t);
	        assert(isect.t <= Math.max(orgLo.t, dstLo.t));
	        assert(Math.min(dstLo.s, dstUp.s) <= isect.s);
	        assert(isect.s <= Math.max(orgLo.s, orgUp.s));
	        if (Geom.vertLeq(isect, tess.event)) {
	            isect.s = tess.event.s;
	            isect.t = tess.event.t;
	        }
	        orgMin = Geom.vertLeq(orgUp, orgLo) ? orgUp : orgLo;
	        if (Geom.vertLeq(orgMin, isect)) {
	            isect.s = orgMin.s;
	            isect.t = orgMin.t;
	        }
	        if (Geom.vertEq(isect, orgUp) || Geom.vertEq(isect, orgLo)) {
	            Sweep.checkForRightSplice(tess, regUp);
	            return false;
	        }
	        if ((!Geom.vertEq(dstUp, tess.event) &&
	            Geom.edgeSign(dstUp, tess.event, isect) >= 0) ||
	            (!Geom.vertEq(dstLo, tess.event) &&
	                Geom.edgeSign(dstLo, tess.event, isect) <= 0)) {
	            if (dstLo === tess.event) {
	                tess.mesh.splitEdge(eUp.Sym);
	                tess.mesh.splice(eLo.Sym, eUp);
	                regUp = Sweep.topLeftRegion(tess, regUp);
	                eUp = Sweep.regionBelow(regUp).eUp;
	                Sweep.finishLeftRegions(tess, Sweep.regionBelow(regUp), regLo);
	                Sweep.addRightEdges(tess, regUp, eUp.Oprev, eUp, eUp, true);
	                return true;
	            }
	            if (dstUp === tess.event) {
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
	            return false;
	        }
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
	    static walkDirtyRegions(tess, regUp) {
	        var regLo = Sweep.regionBelow(regUp);
	        var eUp, eLo;
	        for (;;) {
	            while (regLo.dirty) {
	                regUp = regLo;
	                regLo = Sweep.regionBelow(regLo);
	            }
	            if (!regUp.dirty) {
	                regLo = regUp;
	                regUp = Sweep.regionAbove(regUp);
	                if (regUp === null || !regUp.dirty) {
	                    return;
	                }
	            }
	            regUp.dirty = false;
	            eUp = regUp.eUp;
	            eLo = regLo.eUp;
	            if (eUp.Dst !== eLo.Dst) {
	                if (Sweep.checkForLeftSplice(tess, regUp)) {
	                    if (regLo.fixUpperEdge) {
	                        Sweep.deleteRegion(tess, regLo);
	                        tess.mesh.delete(eLo);
	                        regLo = Sweep.regionBelow(regUp);
	                        eLo = regLo.eUp;
	                    }
	                    else if (regUp.fixUpperEdge) {
	                        Sweep.deleteRegion(tess, regUp);
	                        tess.mesh.delete(eUp);
	                        regUp = Sweep.regionAbove(regLo);
	                        eUp = regUp.eUp;
	                    }
	                }
	            }
	            if (eUp.Org !== eLo.Org) {
	                if (eUp.Dst !== eLo.Dst &&
	                    !regUp.fixUpperEdge &&
	                    !regLo.fixUpperEdge &&
	                    (eUp.Dst === tess.event || eLo.Dst === tess.event)) {
	                    if (Sweep.checkForIntersect(tess, regUp)) {
	                        return;
	                    }
	                }
	                else {
	                    Sweep.checkForRightSplice(tess, regUp);
	                }
	            }
	            if (eUp.Org === eLo.Org && eUp.Dst === eLo.Dst) {
	                Sweep.addWinding(eLo, eUp);
	                Sweep.deleteRegion(tess, regUp);
	                tess.mesh.delete(eUp);
	                regUp = Sweep.regionAbove(regLo);
	            }
	        }
	    }
	    static connectRightVertex(tess, regUp, eBottomLeft) {
	        var eNew;
	        var eTopLeft = eBottomLeft.Onext;
	        var regLo = Sweep.regionBelow(regUp);
	        var eUp = regUp.eUp;
	        var eLo = regLo.eUp;
	        var degenerate = false;
	        if (eUp.Dst !== eLo.Dst) {
	            Sweep.checkForIntersect(tess, regUp);
	        }
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
	            Sweep.addRightEdges(tess, regUp, eBottomLeft.Onext, eTopLeft, eTopLeft, true);
	            return;
	        }
	        if (Geom.vertLeq(eLo.Org, eUp.Org)) {
	            eNew = eLo.Oprev;
	        }
	        else {
	            eNew = eUp;
	        }
	        eNew = tess.mesh.connect(eBottomLeft.Lprev, eNew);
	        Sweep.addRightEdges(tess, regUp, eNew, eNew.Onext, eNew.Onext, false);
	        eNew.Sym.activeRegion.fixUpperEdge = true;
	        Sweep.walkDirtyRegions(tess, regUp);
	    }
	    static connectLeftDegenerate(tess, regUp, vEvent) {
	        var e, eTopLeft, eTopRight, eLast;
	        var reg;
	        e = regUp.eUp;
	        if (Geom.vertEq(e.Org, vEvent)) {
	            assert(false);
	            Sweep.spliceMergeVertices(tess, e, vEvent.anEdge);
	            return;
	        }
	        if (!Geom.vertEq(e.Dst, vEvent)) {
	            tess.mesh.splitEdge(e.Sym);
	            if (regUp.fixUpperEdge) {
	                tess.mesh.delete(e.Onext);
	                regUp.fixUpperEdge = false;
	            }
	            tess.mesh.splice(vEvent.anEdge, e);
	            Sweep.sweepEvent(tess, vEvent);
	            return;
	        }
	        assert(false);
	        regUp = Sweep.topRightRegion(regUp);
	        reg = Sweep.regionBelow(regUp);
	        eTopRight = reg.eUp.Sym;
	        eTopLeft = eLast = eTopRight.Onext;
	        if (reg.fixUpperEdge) {
	            assert(eTopLeft !== eTopRight);
	            Sweep.deleteRegion(tess, reg);
	            tess.mesh.delete(eTopRight);
	            eTopRight = eTopLeft.Oprev;
	        }
	        tess.mesh.splice(vEvent.anEdge, eTopRight);
	        if (!Geom.edgeGoesLeft(eTopLeft)) {
	            eTopLeft = null;
	        }
	        Sweep.addRightEdges(tess, regUp, eTopRight.Onext, eLast, eTopLeft, true);
	    }
	    static connectLeftVertex(tess, vEvent) {
	        var regUp, regLo, reg;
	        var eUp, eLo, eNew;
	        var tmp = new ActiveRegion();
	        tmp.eUp = vEvent.anEdge.Sym;
	        regUp = tess.dict.search(tmp).key;
	        regLo = Sweep.regionBelow(regUp);
	        if (!regLo) {
	            return;
	        }
	        eUp = regUp.eUp;
	        eLo = regLo.eUp;
	        if (Geom.edgeSign(eUp.Dst, vEvent, eUp.Org) === 0.0) {
	            Sweep.connectLeftDegenerate(tess, regUp, vEvent);
	            return;
	        }
	        reg = Geom.vertLeq(eLo.Dst, eUp.Dst) ? regUp : regLo;
	        if (regUp.inside || reg.fixUpperEdge) {
	            if (reg === regUp) {
	                eNew = tess.mesh.connect(vEvent.anEdge.Sym, eUp.Lnext);
	            }
	            else {
	                var tempHalfEdge = tess.mesh.connect(eLo.Dnext, vEvent.anEdge);
	                eNew = tempHalfEdge.Sym;
	            }
	            if (reg.fixUpperEdge) {
	                Sweep.fixUpperEdge(tess, reg, eNew);
	            }
	            else {
	                Sweep.computeWinding(tess, Sweep.addRegionBelow(tess, regUp, eNew));
	            }
	            Sweep.sweepEvent(tess, vEvent);
	        }
	        else {
	            Sweep.addRightEdges(tess, regUp, vEvent.anEdge, vEvent.anEdge, null, true);
	        }
	    }
	    static sweepEvent(tess, vEvent) {
	        tess.event = vEvent;
	        Sweep.debugEvent(tess);
	        var e = vEvent.anEdge;
	        while (e.activeRegion === null) {
	            e = e.Onext;
	            if (e === vEvent.anEdge) {
	                Sweep.connectLeftVertex(tess, vEvent);
	                return;
	            }
	        }
	        var regUp = Sweep.topLeftRegion(tess, e.activeRegion);
	        assert(regUp !== null);
	        var reg = Sweep.regionBelow(regUp);
	        var eTopLeft = reg.eUp;
	        var eBottomLeft = Sweep.finishLeftRegions(tess, reg, null);
	        if (eBottomLeft.Onext === eTopLeft) {
	            Sweep.connectRightVertex(tess, regUp, eBottomLeft);
	        }
	        else {
	            Sweep.addRightEdges(tess, regUp, eBottomLeft.Onext, eTopLeft, eTopLeft, true);
	        }
	    }
	    static addSentinel(tess, smin, smax, t) {
	        var reg = new ActiveRegion();
	        var e = tess.mesh.makeEdge();
	        e.Org.s = smax;
	        e.Org.t = t;
	        e.Dst.s = smin;
	        e.Dst.t = t;
	        tess.event = e.Dst;
	        reg.eUp = e;
	        reg.windingNumber = 0;
	        reg.inside = false;
	        reg.fixUpperEdge = false;
	        reg.sentinel = true;
	        reg.dirty = false;
	        reg.nodeUp = tess.dict.insert(reg);
	    }
	    static initEdgeDict(tess) {
	        tess.dict = new Dict(tess, Sweep.edgeLeq);
	        var w = tess.bmax[0] - tess.bmin[0];
	        var h = tess.bmax[1] - tess.bmin[1];
	        var smin = tess.bmin[0] - w;
	        var smax = tess.bmax[0] + w;
	        var tmin = tess.bmin[1] - h;
	        var tmax = tess.bmax[1] + h;
	        Sweep.addSentinel(tess, smin, smax, tmin);
	        Sweep.addSentinel(tess, smin, smax, tmax);
	    }
	    static doneEdgeDict(tess) {
	        var reg;
	        var fixedEdges = 0;
	        while ((reg = tess.dict.min().key) !== null) {
	            if (!reg.sentinel) {
	                assert(reg.fixUpperEdge);
	                assert(++fixedEdges === 1);
	            }
	            assert(reg.windingNumber === 0);
	            Sweep.deleteRegion(tess, reg);
	        }
	    }
	    static removeDegenerateEdges(tess) {
	        var e, eNext, eLnext;
	        var eHead = tess.mesh.eHead;
	        for (e = eHead.next; e !== eHead; e = eNext) {
	            eNext = e.next;
	            eLnext = e.Lnext;
	            if (Geom.vertEq(e.Org, e.Dst) && e.Lnext.Lnext !== e) {
	                Sweep.spliceMergeVertices(tess, eLnext, e);
	                tess.mesh.delete(e);
	                e = eLnext;
	                eLnext = e.Lnext;
	            }
	            if (eLnext.Lnext === e) {
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
	    static initPriorityQ(tess) {
	        var pq;
	        var v, vHead;
	        var vertexCount = 0;
	        vHead = tess.mesh.vHead;
	        for (v = vHead.next; v !== vHead; v = v.next) {
	            vertexCount++;
	        }
	        vertexCount += 8;
	        pq = tess.pq = new PriorityQ(vertexCount, Geom.vertLeq);
	        vHead = tess.mesh.vHead;
	        for (v = vHead.next; v !== vHead; v = v.next) {
	            v.pqHandle = pq.insert(v);
	        }
	        if (v !== vHead) {
	            return false;
	        }
	        pq.init();
	        return true;
	    }
	    static donePriorityQ(tess) {
	        tess.pq = null;
	    }
	    static removeDegenerateFaces(tess, mesh) {
	        var f, fNext;
	        var e;
	        for (f = mesh.fHead.next; f !== mesh.fHead; f = fNext) {
	            fNext = f.next;
	            e = f.anEdge;
	            assert(e.Lnext !== e);
	            if (e.Lnext.Lnext === e) {
	                Sweep.addWinding(e.Onext, e);
	                tess.mesh.delete(e);
	            }
	        }
	        return true;
	    }
	    static computeInterior(tess, validate = true) {
	        var v, vNext;
	        Sweep.removeDegenerateEdges(tess);
	        if (!Sweep.initPriorityQ(tess)) {
	            return false;
	        }
	        Sweep.initEdgeDict(tess);
	        while ((v = tess.pq.extractMin()) !== null) {
	            for (;;) {
	                vNext = tess.pq.min();
	                if (vNext === null || !Geom.vertEq(vNext, v))
	                    break;
	                vNext = tess.pq.extractMin();
	                Sweep.spliceMergeVertices(tess, v.anEdge, vNext.anEdge);
	            }
	            Sweep.sweepEvent(tess, v);
	        }
	        tess.event = tess.dict.min().key.eUp.Org;
	        Sweep.debugEvent(tess);
	        Sweep.doneEdgeDict(tess);
	        Sweep.donePriorityQ(tess);
	        if (!Sweep.removeDegenerateFaces(tess, tess.mesh)) {
	            return false;
	        }
	        if (validate) {
	            tess.mesh.check();
	        }
	        return true;
	    }
	}

	class Tesselator {
	    constructor() {
	        this.mesh = new TESSmesh();
	        this.normal = [0.0, 0.0, 0.0];
	        this.sUnit = [0.0, 0.0, 0.0];
	        this.tUnit = [0.0, 0.0, 0.0];
	        this.bmin = [0.0, 0.0];
	        this.bmax = [0.0, 0.0];
	        this.windingRule = exports.WINDING.ODD;
	        this.dict = null;
	        this.pq = null;
	        this.event = null;
	        this.vertexIndexCounter = 0;
	        this.vertices = [];
	        this.vertexIndices = [];
	        this.vertexCount = 0;
	        this.elements = [];
	        this.elementCount = 0;
	    }
	    dot_(u, v) {
	        return u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
	    }
	    normalize_(v) {
	        let len = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
	        if (!len) {
	            throw "Zero-size vector!";
	        }
	        len = Math.sqrt(len);
	        v[0] /= len;
	        v[1] /= len;
	        v[2] /= len;
	    }
	    longAxis_(v) {
	        let i = 0;
	        if (Math.abs(v[1]) > Math.abs(v[0])) {
	            i = 1;
	        }
	        if (Math.abs(v[2]) > Math.abs(v[i])) {
	            i = 2;
	        }
	        return i;
	    }
	    computeNormal_(norm) {
	        let v, v1, v2;
	        let c, tLen2, maxLen2;
	        let maxVal = [0, 0, 0], minVal = [0, 0, 0], d1 = [0, 0, 0], d2 = [0, 0, 0], tNorm = [0, 0, 0];
	        const maxVert = [null, null, null], minVert = [null, null, null];
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
	        let i = 0;
	        if (maxVal[1] - minVal[1] > maxVal[0] - minVal[0]) {
	            i = 1;
	        }
	        if (maxVal[2] - minVal[2] > maxVal[i] - minVal[i]) {
	            i = 2;
	        }
	        if (minVal[i] >= maxVal[i]) {
	            norm[0] = 0;
	            norm[1] = 0;
	            norm[2] = 1;
	            return;
	        }
	        maxLen2 = 0;
	        v1 = minVert[i];
	        v2 = maxVert[i];
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
	            norm[0] = norm[1] = norm[2] = 0;
	            norm[this.longAxis_(d1)] = 1;
	        }
	    }
	    checkOrientation_() {
	        var fHead = this.mesh.fHead;
	        var v, vHead = this.mesh.vHead;
	        var e;
	        let area = 0;
	        for (let f = fHead.next; f !== fHead; f = f.next) {
	            e = f.anEdge;
	            if (e.winding <= 0)
	                continue;
	            do {
	                area += (e.Org.s - e.Dst.s) * (e.Org.t + e.Dst.t);
	                e = e.Lnext;
	            } while (e !== f.anEdge);
	        }
	        if (area < 0) {
	            for (v = vHead.next; v !== vHead; v = v.next) {
	                v.t = -v.t;
	            }
	            this.tUnit[0] = -this.tUnit[0];
	            this.tUnit[1] = -this.tUnit[1];
	            this.tUnit[2] = -this.tUnit[2];
	        }
	    }
	    projectPolygon_() {
	        let vHead = this.mesh.vHead;
	        let norm = [0, 0, 0];
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
	        sUnit[axis] = 0;
	        sUnit[(axis + 1) % 3] = 1.0;
	        sUnit[(axis + 2) % 3] = 0.0;
	        tUnit[axis] = 0;
	        tUnit[(axis + 1) % 3] = 0.0;
	        tUnit[(axis + 2) % 3] = norm[axis] > 0 ? 1.0 : -1.0;
	        for (let v = vHead.next; v !== vHead; v = v.next) {
	            v.s = this.dot_(v.coords, sUnit);
	            v.t = this.dot_(v.coords, tUnit);
	        }
	        if (computedNormal) {
	            this.checkOrientation_();
	        }
	        let first = true;
	        for (let v = vHead.next; v !== vHead; v = v.next) {
	            if (first) {
	                this.bmin[0] = this.bmax[0] = v.s;
	                this.bmin[1] = this.bmax[1] = v.t;
	                first = false;
	            }
	            else {
	                if (v.s < this.bmin[0])
	                    this.bmin[0] = v.s;
	                if (v.s > this.bmax[0])
	                    this.bmax[0] = v.s;
	                if (v.t < this.bmin[1])
	                    this.bmin[1] = v.t;
	                if (v.t > this.bmax[1])
	                    this.bmax[1] = v.t;
	            }
	        }
	    }
	    addWinding_(eDst, eSrc) {
	        eDst.winding += eSrc.winding;
	        eDst.Sym.winding += eSrc.Sym.winding;
	    }
	    tessellateMonoRegion_(mesh, face) {
	        let up, lo;
	        up = face.anEdge;
	        if (!(up.Lnext !== up && up.Lnext.Lnext !== up)) {
	            throw "Mono region invalid";
	        }
	        for (; Geom.vertLeq(up.Dst, up.Org); up = up.Lprev)
	            ;
	        for (; Geom.vertLeq(up.Org, up.Dst); up = up.Lnext)
	            ;
	        lo = up.Lprev;
	        let tempHalfEdge = undefined;
	        while (up.Lnext !== lo) {
	            if (Geom.vertLeq(up.Dst, lo.Org)) {
	                while (lo.Lnext !== up &&
	                    (Geom.edgeGoesLeft(lo.Lnext) ||
	                        Geom.edgeSign(lo.Org, lo.Dst, lo.Lnext.Dst) <= 0.0)) {
	                    tempHalfEdge = mesh.connect(lo.Lnext, lo);
	                    lo = tempHalfEdge.Sym;
	                }
	                lo = lo.Lprev;
	            }
	            else {
	                while (lo.Lnext !== up &&
	                    (Geom.edgeGoesRight(up.Lprev) ||
	                        Geom.edgeSign(up.Dst, up.Org, up.Lprev.Org) >= 0.0)) {
	                    tempHalfEdge = mesh.connect(up, up.Lprev);
	                    up = tempHalfEdge.Sym;
	                }
	                up = up.Lnext;
	            }
	        }
	        if (lo.Lnext === up) {
	            throw "Mono region invalid";
	        }
	        while (lo.Lnext.Lnext !== up) {
	            tempHalfEdge = mesh.connect(lo.Lnext, lo);
	            lo = tempHalfEdge.Sym;
	        }
	        return true;
	    }
	    tessellateInterior_(mesh) {
	        let next;
	        for (let f = mesh.fHead.next; f !== mesh.fHead; f = next) {
	            next = f.next;
	            if (f.inside) {
	                if (!this.tessellateMonoRegion_(mesh, f)) {
	                    return false;
	                }
	            }
	        }
	        return true;
	    }
	    discardExterior_(mesh) {
	        let next;
	        for (let f = mesh.fHead.next; f !== mesh.fHead; f = next) {
	            next = f.next;
	            if (!f.inside) {
	                mesh.zapFace(f);
	            }
	        }
	    }
	    setWindingNumber_(mesh, value, keepOnlyBoundary) {
	        let eNext;
	        for (let e = mesh.eHead.next; e !== mesh.eHead; e = eNext) {
	            eNext = e.next;
	            if (e.Rface.inside !== e.Lface.inside) {
	                e.winding = e.Lface.inside ? value : -value;
	            }
	            else {
	                if (!keepOnlyBoundary) {
	                    e.winding = 0;
	                }
	                else {
	                    mesh.delete(e);
	                }
	            }
	        }
	    }
	    getNeighbourFace_(edge) {
	        if (!edge.Rface)
	            return -1;
	        if (!edge.Rface.inside)
	            return -1;
	        return edge.Rface.n;
	    }
	    outputPolymesh_(mesh, elementType, polySize, vertexSize) {
	        let edge;
	        let maxFaceCount = 0;
	        let maxVertexCount = 0;
	        let faceVerts;
	        if (polySize > 3) {
	            mesh.mergeConvexFaces(polySize);
	        }
	        for (let v = mesh.vHead.next; v !== mesh.vHead; v = v.next) {
	            v.n = -1;
	        }
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
	        if (elementType === exports.MODE.CONNECTED_POLYGONS) {
	            maxFaceCount *= 2;
	        }
	        this.elements = [];
	        this.elements.length = maxFaceCount * polySize;
	        this.vertexCount = maxVertexCount;
	        this.vertices = [];
	        this.vertices.length = maxVertexCount * vertexSize;
	        this.vertexIndices = [];
	        this.vertexIndices.length = maxVertexCount;
	        for (let v = mesh.vHead.next; v !== mesh.vHead; v = v.next) {
	            if (v.n !== -1) {
	                var idx = v.n * vertexSize;
	                this.vertices[idx + 0] = v.coords[0];
	                this.vertices[idx + 1] = v.coords[1];
	                if (vertexSize > 2) {
	                    this.vertices[idx + 2] = v.coords[2];
	                }
	                this.vertexIndices[v.n] = v.idx;
	            }
	        }
	        let nel = 0;
	        for (let f = mesh.fHead.next; f !== mesh.fHead; f = f.next) {
	            if (!f.inside)
	                continue;
	            edge = f.anEdge;
	            faceVerts = 0;
	            do {
	                let v = edge.Org;
	                this.elements[nel++] = v.n;
	                faceVerts++;
	                edge = edge.Lnext;
	            } while (edge !== f.anEdge);
	            for (let i = faceVerts; i < polySize; ++i) {
	                this.elements[nel++] = -1;
	            }
	            if (elementType === exports.MODE.CONNECTED_POLYGONS) {
	                edge = f.anEdge;
	                do {
	                    this.elements[nel++] = this.getNeighbourFace_(edge);
	                    edge = edge.Lnext;
	                } while (edge !== f.anEdge);
	                for (let i = faceVerts; i < polySize; ++i) {
	                    this.elements[nel++] = -1;
	                }
	            }
	        }
	    }
	    outputContours_(mesh, vertexSize) {
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
	        this.elements = [];
	        this.elements.length = this.elementCount * 2;
	        this.vertices = [];
	        this.vertices.length = this.vertexCount * vertexSize;
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
	    addContour(size, vertices) {
	        if (this.mesh === null) {
	            this.mesh = new TESSmesh();
	        }
	        if (size < 2) {
	            size = 2;
	        }
	        if (size > 3) {
	            size = 3;
	        }
	        let e = null;
	        for (let i = 0; i < vertices.length; i += size) {
	            if (e === null) {
	                e = this.mesh.makeEdge();
	                this.mesh.splice(e, e.Sym);
	            }
	            else {
	                this.mesh.splitEdge(e);
	                e = e.Lnext;
	            }
	            e.Org.coords[0] = vertices[i + 0];
	            e.Org.coords[1] = vertices[i + 1];
	            if (size > 2) {
	                e.Org.coords[2] = vertices[i + 2];
	            }
	            else {
	                e.Org.coords[2] = 0.0;
	            }
	            e.Org.idx = this.vertexIndexCounter++;
	            e.winding = 1;
	            e.Sym.winding = -1;
	        }
	    }
	    tesselate(windingRule = exports.WINDING.ODD, elementType = exports.MODE.POLYGONS, polySize, vertexSize, normal, validate = true) {
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
	        if (!this.mesh) {
	            return false;
	        }
	        this.projectPolygon_();
	        Sweep.computeInterior(this, validate);
	        var mesh = this.mesh;
	        if (elementType === exports.MODE.BOUNDARY_CONTOURS) {
	            this.setWindingNumber_(mesh, 1, true);
	        }
	        else {
	            this.tessellateInterior_(mesh);
	        }
	        if (!validate) {
	            mesh.check();
	        }
	        if (elementType === exports.MODE.BOUNDARY_CONTOURS) {
	            this.outputContours_(mesh, vertexSize);
	        }
	        else {
	            this.outputPolymesh_(mesh, elementType, polySize, vertexSize);
	        }
	        return true;
	    }
	}

	function tesselate({ windingRule = exports.WINDING.ODD, elementType = exports.MODE.POLYGONS, polySize = 3, vertexSize = 2, normal = [0, 0, 1], contours = [], strict = true, debug = false, }) {
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
	    tess.tesselate(windingRule, elementType, polySize, vertexSize, normal, strict);
	    return {
	        vertices: tess.vertices,
	        vertexIndices: tess.vertexIndices,
	        vertexCount: tess.vertexCount,
	        elements: tess.elements,
	        elementCount: tess.elementCount,
	        mesh: debug ? tess.mesh : undefined,
	    };
	}

	exports.Tesselator = Tesselator;
	exports.tesselate = tesselate;

	return exports;

}({}));
//# sourceMappingURL=tess2.js.map
