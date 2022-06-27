export class Face {

    /**
     * Creates a new triangle face by the indices of each vertex.
     * 
     * @param {number} a Index of the first vertex
     * @param {number} b Index of the second vertex
     * @param {number} c Index of the third vertex
     */
    constructor(a, b, c) {
        this.a = a;
        this.b = b;
        this.c = c;
    }
}