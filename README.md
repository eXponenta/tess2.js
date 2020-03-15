
tess2-ts
=

Port of tess2.js to typescript

The tess2.js library performs polygon boolean operations and tesselation to triangles and convex polygons. It is a port of libtess2, which is turn is a cleaned up version of the stock GLU tesselator. The original code was written Eric Veach in 1994. The greatest thing about tess2.js is that it handles all kinds of input like self-intersecting polygons or any nomber of holes and contours.

Differences from tess2.js
-

* Typescript
* Include types
* es6
* Many errors has clear description
* Allowed to disable validation passed to increase performance
* Direct accces to Tesselator class


---

Installation:
-

```npm install tess2-ts --save```

Example use:
```javascript

import {tesselate, WINDING, ELEMENT } from 'tess2-ts';

// Define input
var ca = [0,0, 10,0, 5,10];
var cb = [0,2, 10,2, 10,6, 0,6];
var contours = [ca,cb];

// Tesselate
var res = tesselate({
	contours: contours,
	windingRule: WINDING.ODD, // default
	elementType: ELEMENT.POLYGONS, // default
	polySize: 3, // default
	vertexSize: 2 // default
	strict: true // default, enable mesh validation 
});

// Use vertices
for (var i = 0; i < res.vertices.length; i += 2) {
	drawVertex(res.vertices[i], res.vertices[i+1]);
}
// Use triangles
for (var i = 0; i < res.elements.length; i += 3) {
	var a = res.elements[i], b = res.elements[i+1], c = res.elements[i+2];
	drawTriangle(res.vertices[a*2], res.vertices[a*2+1],
		res.vertices[b*2], res.vertices[b*2+1],
		res.vertices[c*2], res.vertices[c*2+1]);
}
```

Further reading:
http://www.glprogramming.com/red/chapter11.html

## Browser

like a simple script tag:

```html
<script src="tess2.js"></script>
<script>
var res = Tess2.tesselate({ ... });

//same as above...
</script>
```

## Building

To build, enter the following:

```
npm i
npm run build
```