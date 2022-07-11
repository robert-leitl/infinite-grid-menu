import { vec2, vec3 } from "../web_modules/pkg/gl-matrix.js";
import { Face } from "./face.js";
import { Vertex } from "./vertex.js";

export class Geometry {
    constructor() {
        this.vertices = [];
        this.faces = [];
    }

    addVertex(x, y, z) {
        const args = arguments;
        for(let i = 0; i < args.length; i += 3) {
            this.vertices.push(
                new Vertex(args[i], args[i + 1], args[i + 2])
            );
        }

        return this;
    }

    addFace(a, b, c) {
        const args = arguments;
        for(let i = 0; i < args.length; i += 3) {
            this.faces.push(
                new Face(args[i], args[i + 1], args[i + 2])
            );
        }

        return this;
    }

    get lastVertex() {
        return this.vertices[this.vertices.length - 1];
    }

    subdivide(divisions = 1) {
        const midPointCache = {};
        let f = this.faces;

        for(let div = 0; div < divisions; ++div) {
            // each triangle face gets divided into four new triangle faces
            const newFaces = new Array(f.length * 4);

            f.forEach((face, ndx) => {
                // get the midpoints
                const mAB = this.getMidPoint(face.a, face.b, midPointCache);
                const mBC = this.getMidPoint(face.b, face.c, midPointCache);
                const mCA = this.getMidPoint(face.c, face.a, midPointCache);

                // create new faces
                const i = ndx * 4;
                newFaces[i + 0] = new Face(face.a, mAB, mCA);
                newFaces[i + 1] = new Face(face.b, mBC, mAB);
                newFaces[i + 2] = new Face(face.c, mCA, mBC);
                newFaces[i + 3] = new Face(mAB, mBC, mCA);

            });

            // swap faces for the next iteration
            f = newFaces;
        }

        this.faces = f;

        return this;
    }

    spherize(radius = 1) {
        this.vertices.forEach(vertex => {
            vec3.normalize(vertex.normal, vertex.position);
            vec3.scale(vertex.position, vertex.normal, radius);
        });

        return this;
    }

    get data() {
        return {
            vertices: this.vertexData,
            indices: this.indexData,
            normals: this.normalData,
            uvs: this.uvData
        };
    }

    get vertexData() {
        return new Float32Array(this.vertices.flatMap(v => Array.from(v.position)));
    }

    get normalData() {
        return new Float32Array(this.vertices.flatMap(v => Array.from(v.normal)));
    }

    get uvData() {
        return new Float32Array(this.vertices.flatMap(v => Array.from(v.uv)));
    }

    get indexData() {
        return new Uint16Array(this.faces.flatMap(f => [f.a, f.b, f.c]));
    }

    getMidPoint(ndxA, ndxB, cache) {
        const cacheKey = ndxA < ndxB ? `k_${ndxB}_${ndxA}` : `k_${ndxA}_${ndxB}`;
        if (cache.hasOwnProperty(cacheKey)) return cache[cacheKey];

        const a = this.vertices[ndxA].position;
        const b = this.vertices[ndxB].position;
        const ndx = this.vertices.length;
        cache[cacheKey] = ndx;
        this.addVertex(
            (a[0] + b[0]) * 0.5,
            (a[1] + b[1]) * 0.5,
            (a[2] + b[2]) * 0.5
        );

        return ndx;
    }
}