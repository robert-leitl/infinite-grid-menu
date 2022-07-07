import { mat4, quat, vec2, vec3 } from "./web_modules/pkg/gl-matrix.js";
import { IcosahedronGeometry } from "./geometry/icosahedron-geometry.js";
import { ArcballControl } from './utils/arcball-control.js';
import { createAndSetupTexture, createFramebuffer, createProgram, makeBuffer, makeVertexArray, resizeCanvasToDisplaySize, setFramebuffer } from './utils/webgl-utils.js';


const testVertShaderSource = `#version 300 es

    uniform mat4 uWorldMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uWorldInverseTransposeMatrix;
    uniform vec3 uCameraPosition;

    in vec3 aModelPosition;
    in vec3 aModelNormal;

    out vec4 vColor;

    void main() {
        vec4 worldPosition = uWorldMatrix * vec4(aModelPosition, 1.);
        gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
        gl_PointSize = (worldPosition.z) * 20.;
        gl_PointSize *= 2.;
        vColor = vec4(1.);
    }
`;
const testFragShaderSource = `#version 300 es

    precision highp float;

    uniform float uFrames;
    uniform float uScaleFactor;
    uniform vec3 uCameraPosition;

    out vec4 outColor;

    in vec4 vColor;

    void main() {
        vec2 st = gl_PointCoord * 2. - 1.;
        vec4 color = vec4(1., 1., 1., (1. - smoothstep(0.9, 1., length(st))) * 0.3) * vColor;
        outColor = color;
    }
`;

export class InfiniteGridMenu3 {

    TARGET_FRAME_DURATION = 1000 / 60;  // 60 fps

    SPHERE_RADIUS = 1;

    #time = 0;
    #deltaTime = 0;

    // relative frames according to the target frame duration (1 = 60 fps)
    // gets smaller with higher framerates --> use to adapt animation timing
    #deltaFrames = 0;

    // total frames since the start
    #frames = 0;

    camera = {
        matrix: mat4.create(),
        near: 0.5,
        far: 10,
        fov: Math.PI / 4,
        aspect: 1,
        position: vec3.fromValues(0, 0, 7),
        up: vec3.fromValues(0, 1, 0),
        matrices: {
            view: mat4.create(),
            projection: mat4.create(),
            inversProjection: mat4.create()
        }
    };

    constructor(canvas, onInit = null) {
        this.canvas = canvas;

        this.#init(onInit);
    }

    resize() {
        this.viewportSize = vec2.set(
            this.viewportSize,
            this.canvas.clientWidth,
            this.canvas.clientHeight
        );

        const gl = this.gl;

        const needsResize = resizeCanvasToDisplaySize(gl.canvas);
        
        if (needsResize) {
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        }

        this.#updateProjectionMatrix(gl);
    }

    run(time = 0) {
        this.#deltaTime = Math.min(32, time - this.#time);
        this.#time = time;
        this.#deltaFrames = this.#deltaTime / this.TARGET_FRAME_DURATION;
        this.#frames += this.#deltaFrames

        this.#animate(this.#deltaTime);
        this.#render();

        requestAnimationFrame((t) => this.run(t));
    }

    #init(onInit) {
        this.gl = this.canvas.getContext('webgl2', { antialias: true, alpha: false });

        /** @type {WebGLRenderingContext} */
        const gl = this.gl;

        if (!gl) {
            throw new Error('No WebGL 2 context!')
        }

        // init client dimensions
        this.viewportSize = vec2.fromValues(
            this.canvas.clientWidth,
            this.canvas.clientHeight
        );
        this.drawBufferSize = vec2.clone(this.viewportSize);

        // setup programs
        this.testProgram = createProgram(gl, [testVertShaderSource, testFragShaderSource], null, { aModelPosition: 0, aModelNormal: 1 });

        // find the locations
        this.testLocations = {
            aModelPosition: gl.getAttribLocation(this.testProgram, 'aModelPosition'),
            aModelNormal: gl.getAttribLocation(this.testProgram, 'aModelNormal'),
            uWorldMatrix: gl.getUniformLocation(this.testProgram, 'uWorldMatrix'),
            uViewMatrix: gl.getUniformLocation(this.testProgram, 'uViewMatrix'),
            uProjectionMatrix: gl.getUniformLocation(this.testProgram, 'uProjectionMatrix'),
            uWorldInverseTransposeMatrix: gl.getUniformLocation(this.testProgram, 'uWorldInverseTransposeMatrix'),
            uCameraPosition: gl.getUniformLocation(this.testProgram, 'uCameraPosition'),
            uScaleFactor: gl.getUniformLocation(this.testProgram, 'uScaleFactor')
        };

        /////////////////////////////////// GEOMETRY / MESH SETUP

        // create icosahedron VAO
        this.icoGeo = new IcosahedronGeometry();
        this.icoGeo.subdivide(1).spherize(this.SPHERE_RADIUS);

        this.icoBuffers = this.icoGeo.data;
        this.icoVAO = makeVertexArray(gl, [
            [makeBuffer(gl, this.icoBuffers.vertices, gl.STATIC_DRAW), 0, 3],
            [makeBuffer(gl, this.icoBuffers.normals, gl.STATIC_DRAW), 1, 3]
        ], (this.icoBuffers.indices));
        this.icoModelMatrix = mat4.create();
    
        // init the pointer rotate control
        this.control = new ArcballControl(this.canvas, () => this.#onControlUpdate());
        
        this.#updateCameraMatrix();
        this.#updateProjectionMatrix(gl);

        this.resize();

        if (onInit) onInit(this);
    }

    #animate(deltaTime) {
        this.control.update(deltaTime);
        mat4.fromQuat(this.icoModelMatrix, this.control.orientation);
    }

    #render() {
         /** @type {WebGLRenderingContext} */
         const gl = this.gl;

        gl.useProgram(this.testProgram);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        gl.cullFace(gl.FRONT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);    // disable depth writing_ALPHA);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.uniformMatrix4fv(this.testLocations.uWorldMatrix, false, this.icoModelMatrix);
        gl.uniformMatrix4fv(this.testLocations.uViewMatrix, false, this.camera.matrices.view);
        gl.uniformMatrix4fv(this.testLocations.uProjectionMatrix, false, this.camera.matrices.projection);
        gl.uniform3f(this.testLocations.uCameraPosition, this.camera.position[0], this.camera.position[1], this.camera.position[2]);
        gl.uniform1f(this.testLocations.uFrames, this.#frames);
        gl.uniform1f(this.testLocations.uScaleFactor, this.scaleFactor);

        // update the world inverse transpose
        const worldInverseTranspose = mat4.invert(mat4.create(), this.icoModelMatrix);
        mat4.transpose(worldInverseTranspose, worldInverseTranspose);
        gl.uniformMatrix4fv(this.testLocations.uWorldInverseTransposeMatrix, false, worldInverseTranspose);

        gl.bindVertexArray(this.icoVAO);
        gl.drawElements(gl.POINTS, this.icoBuffers.indices.length, gl.UNSIGNED_SHORT, 0);
    }

    #updateCameraMatrix() {
        mat4.targetTo(this.camera.matrix, this.camera.position, [0, 0, 0], this.camera.up);
        mat4.invert(this.camera.matrices.view, this.camera.matrix);
    }

    #updateProjectionMatrix(gl) {
        this.camera.aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        mat4.perspective(this.camera.matrices.projection, this.camera.fov, this.camera.aspect, this.camera.near, this.camera.far);
        mat4.invert(this.camera.matrices.inversProjection, this.camera.matrices.projection);

        const size = this.SPHERE_RADIUS * 2;
        if (this.camera.aspect > 1) {
            this.cameraWideAngleDistance = (size / 2) / Math.tan(this.camera.fov / 2);
        } else {
            this.cameraWideAngleDistance = (size / 2) / Math.tan ((this.camera.fov * this.camera.aspect) / 2);
        }
        this.cameraWideAngleDistance += 0.5;
    }

    #onControlUpdate() {
        let damping = 6;
        let cameraTargetZ = this.cameraWideAngleDistance * 0.6;

        if (!this.control.isPointerDown) {
            this.control.snapTargetDirection = this.#findNearestSnapDirection();
        } else {
            cameraTargetZ = this.cameraWideAngleDistance;
            damping = 4;
        }

        this.camera.position[2] += (cameraTargetZ - this.camera.position[2]) / damping;
        this.#updateCameraMatrix();
    }

    #findNearestSnapDirection() {
        // map the XY-Plane normal to the model space
        const n = this.control.snapDirection;
        const inversOrientation = quat.conjugate(quat.create(), this.control.orientation);
        // transform the normal to model space
        const nt = vec3.transformQuat(vec3.create(), n, inversOrientation);
        
        // find the nearest vertex 
        const vertices = this.icoGeo.vertices;
        let maxD = -1;
        let nearestVertexPos;
        for(let i=0; i<vertices.length; ++i) {
            const d = vec3.dot(nt, vertices[i].position);
            if (d > maxD) {
                maxD = d;
                nearestVertexPos = vertices[i].position;
            }
        }

        const snapDirection = vec3.transformQuat(vec3.create(), nearestVertexPos, this.control.orientation);
        return vec3.normalize(snapDirection, snapDirection);
    }
}