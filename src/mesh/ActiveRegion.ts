import { TESShalfEdge } from './TESShalfEdge';

/* For each pair of adjacent edges crossing the sweep line, there is
 * an ActiveRegion to represent the region between them.  The active
 * regions are kept in sorted order in a dynamic dictionary.  As the
 * sweep line crosses each vertex, we update the affected regions.
 */
export class ActiveRegion {
	eUp: TESShalfEdge = null; /* upper edge, directed right to left */
	nodeUp?: any = null; /* dictionary node corresponding to eUp */
	windingNumber: number = 0;
	/* used to determine which regions are
	 * inside the polygon */
	inside: boolean = false; /* is this region inside the polygon? */
	sentinel: boolean = false; /* marks fake edges at t = +/-infinity */
	dirty: boolean = false;
	/* marks regions where the upper or lower
	 * edge has changed, but we haven't checked
	 * whether they intersect yet */
	fixUpperEdge: boolean = false;
	/* marks temporary edges introduced when
	 * we process a "right vertex" (one without
	 * any edges leaving to the right) */
}
