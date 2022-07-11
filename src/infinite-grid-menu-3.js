import { mat3, mat4, quat, vec2, vec3 } from "gl-matrix";
import { DiscGeometry } from "./geometry/disc-geometry";
import { IcosahedronGeometry } from "./geometry/icosahedron-geometry";
import { ArcballControl } from './utils/arcball-control';
import { createAndSetupTexture, createFramebuffer, createProgram, makeBuffer, makeVertexArray, resizeCanvasToDisplaySize, setFramebuffer } from './utils/webgl-utils';


const testVertShaderSource = `#version 300 es

    uniform mat4 uWorldMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform vec3 uCameraPosition;
    uniform vec4 uRotationAxisVelocity;

    in vec3 aModelPosition;
    in vec3 aModelNormal;
    in vec2 aModelUvs;
    in mat4 aInstanceMatrix;

    out vec2 vUvs;
    out float vAlpha;

    void main() {
        vec4 worldPosition = aInstanceMatrix * uWorldMatrix * vec4(aModelPosition, 1.);


        vec4 discOriginPos = aInstanceMatrix * uWorldMatrix * vec4(0., 0., 0., 1.);
        float radius = length(discOriginPos.xyz);
        vec3 velocityDirection = cross(discOriginPos.xyz, uRotationAxisVelocity.xyz);
        vec3 relativeVertexPos = worldPosition.xyz - discOriginPos.xyz;
        float offsetStrength = dot(velocityDirection, relativeVertexPos);
        offsetStrength = uRotationAxisVelocity.w * offsetStrength * 2.;
        worldPosition.xyz += velocityDirection * offsetStrength;
        worldPosition.xyz = radius * normalize(worldPosition.xyz);


        gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;

        vAlpha = pow(normalize(worldPosition.xyz).z, 1.);
        vUvs = aModelUvs;
    }
`;
const testFragShaderSource = `#version 300 es

    precision highp float;

    uniform float uFrames;
    uniform float uScaleFactor;
    uniform vec3 uCameraPosition;

    out vec4 outColor;

    in vec2 vUvs;
    in float vAlpha;

    void main() {
        outColor = vec4(vUvs, 1., 1.);

        outColor *= vAlpha;
    }
`;

export class InfiniteGridMenu3 {

    TARGET_FRAME_DURATION = 1000 / 60;  // 60 fps

    SPHERE_RADIUS = 2;

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
        this.testProgram = createProgram(gl, [testVertShaderSource, testFragShaderSource], null, { aModelPosition: 0, aModelNormal: 1, aModelUvs: 2, aInstanceMatrix: 3 });

        // find the locations
        this.testLocations = {
            aModelPosition: gl.getAttribLocation(this.testProgram, 'aModelPosition'),
            aModelUvs: gl.getAttribLocation(this.testProgram, 'aModelUvs'),
            aInstanceMatrix: gl.getAttribLocation(this.testProgram, 'aInstanceMatrix'),
            uWorldMatrix: gl.getUniformLocation(this.testProgram, 'uWorldMatrix'),
            uViewMatrix: gl.getUniformLocation(this.testProgram, 'uViewMatrix'),
            uProjectionMatrix: gl.getUniformLocation(this.testProgram, 'uProjectionMatrix'),
            uCameraPosition: gl.getUniformLocation(this.testProgram, 'uCameraPosition'),
            uScaleFactor: gl.getUniformLocation(this.testProgram, 'uScaleFactor'),
            uRotationAxisVelocity: gl.getUniformLocation(this.testProgram, 'uRotationAxisVelocity')
        };

        /////////////////////////////////// GEOMETRY / MESH SETUP

        // create disc VAO
        this.discGeo = new DiscGeometry(36, 1);
        this.discBuffers = this.discGeo.data;
        this.discVAO = makeVertexArray(gl, [
            [makeBuffer(gl, this.discBuffers.vertices, gl.STATIC_DRAW), this.testLocations.aModelPosition, 3],
            [makeBuffer(gl, this.discBuffers.uvs, gl.STATIC_DRAW), this.testLocations.aModelUvs, 2]
        ], (this.discBuffers.indices));

        this.icoGeo = new IcosahedronGeometry();
        this.icoGeo.subdivide(1).spherize(this.SPHERE_RADIUS);
        this.instancePositions = this.icoGeo.vertices.map(v => v.position);
        this.DISC_INSTANCE_COUNT = this.icoGeo.vertices.length;
        this.#initDiscInstances(this.DISC_INSTANCE_COUNT);

        this.worldMatrix = mat4.create();
    
        // init the pointer rotate control
        this.control = new ArcballControl(this.canvas, () => this.#onControlUpdate());
        
        this.#updateCameraMatrix();
        this.#updateProjectionMatrix(gl);

        this.resize();

        if (onInit) onInit(this);
    }

    #initDiscInstances(count) {
        /** @type {WebGLRenderingContext} */
        const gl = this.gl;

        this.discInstances = {
            matricesArray: new Float32Array(count * 16),
            matrices: [],
            buffer: gl.createBuffer()
        }
        for(let i = 0; i < count; ++i) {
            const instanceMatrixArray = new Float32Array(this.discInstances.matricesArray.buffer, i * 16 * 4, 16);
            instanceMatrixArray.set(mat4.create());
            this.discInstances.matrices.push(instanceMatrixArray);
        }

        gl.bindVertexArray(this.discVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.discInstances.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.discInstances.matricesArray.byteLength, gl.DYNAMIC_DRAW);
        const mat4AttribSlotCount = 4;
        const bytesPerMatrix = 16 * 4;
        for(let j = 0; j < mat4AttribSlotCount; ++j) {
            const loc = this.testLocations.aInstanceMatrix + j;
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(
                loc,
                4,
                gl.FLOAT,
                false,
                bytesPerMatrix, // stride, num bytes to advance to get to next set of values
                j * 4 * 4 // one row = 4 values each 4 bytes
            );
            gl.vertexAttribDivisor(loc, 1); // it sets this attribute to only advance to the next value once per instance
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }

    #animate(deltaTime) {
        /** @type {WebGLRenderingContext} */
        const gl = this.gl;

        this.control.update(deltaTime);

        // update the instance matrices from the current orientation
        let positions = this.instancePositions.map(p => vec3.transformQuat(vec3.create(), p, this.control.orientation));
        positions.forEach((p, ndx) => {
            const scale = (Math.abs(p[2]) * 0.6 + 0.4) * 0.15;
            const matrix = mat4.create();
            mat4.translate(matrix, matrix, vec3.negate(vec3.create(), p));
            mat4.scale(matrix, matrix, [scale, scale, scale]);
            mat4.multiply(matrix, matrix, mat4.targetTo(mat4.create(), [0, 0, 0], p, [0, 1, 0]));

            mat4.copy(this.discInstances.matrices[ndx], matrix);
        });

        // upload the instance matrix buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.discInstances.buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.discInstances.matricesArray);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    #render() {
         /** @type {WebGLRenderingContext} */
         const gl = this.gl;

        gl.useProgram(this.testProgram);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.uniformMatrix4fv(this.testLocations.uWorldMatrix, false, this.worldMatrix);
        gl.uniformMatrix4fv(this.testLocations.uViewMatrix, false, this.camera.matrices.view);
        gl.uniformMatrix4fv(this.testLocations.uProjectionMatrix, false, this.camera.matrices.projection);
        gl.uniform3f(this.testLocations.uCameraPosition, this.camera.position[0], this.camera.position[1], this.camera.position[2]);
        gl.uniform4f(this.testLocations.uRotationAxisVelocity, this.control.rotationAxis[0], this.control.rotationAxis[1], this.control.rotationAxis[2], this.control.rotationVelocity);
        gl.uniform1f(this.testLocations.uFrames, this.#frames);
        gl.uniform1f(this.testLocations.uScaleFactor, this.scaleFactor);

        gl.bindVertexArray(this.discVAO);

        gl.drawElementsInstanced(
            gl.TRIANGLES,
            this.discBuffers.indices.length,
            gl.UNSIGNED_SHORT,
            0,
            this.DISC_INSTANCE_COUNT
        );
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
        this.cameraWideAngleDistance -= 0.5;
    }

    #onControlUpdate() {
        let damping = 6;
        let cameraTargetZ = this.cameraWideAngleDistance * 0.6;

        if (!this.control.isPointerDown) {
            cameraTargetZ *= 0.9;
            this.control.snapTargetDirection = this.#findNearestSnapDirection();
        } else {
            cameraTargetZ = this.control.rotationVelocity * 9 + this.cameraWideAngleDistance * 0.7;
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
        const vertices = this.instancePositions;
        let maxD = -1;
        let nearestVertexPos;
        for(let i=0; i<vertices.length; ++i) {
            const d = vec3.dot(nt, vertices[i]);
            if (d > maxD) {
                maxD = d;
                nearestVertexPos = vertices[i];
            }
        }

        const snapDirection = vec3.transformQuat(vec3.create(), nearestVertexPos, this.control.orientation);
        return vec3.normalize(snapDirection, snapDirection);
    }
}