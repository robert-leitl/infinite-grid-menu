import { mat3, mat4, quat, vec2, vec3 } from "gl-matrix";
import { DiscGeometry } from "./geometry/disc-geometry";
import { IcosahedronGeometry } from "./geometry/icosahedron-geometry";
import { ArcballControl } from './arcball-control';
import { createAndSetupTexture, createFramebuffer, createProgram, makeBuffer, makeVertexArray, resizeCanvasToDisplaySize, setFramebuffer } from './utils/webgl-utils';

import discVertShaderSource from './shader/disc.vert.glsl';
import discFragShaderSource from './shader/disc.frag.glsl';

export class InfiniteGridMenu {

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
        near: 0.1,
        far: 40,
        fov: Math.PI / 4,
        aspect: 1,
        position: vec3.fromValues(0, 0, 3),
        up: vec3.fromValues(0, 1, 0),
        matrices: {
            view: mat4.create(),
            projection: mat4.create(),
            inversProjection: mat4.create()
        }
    };

    // the index of the vertex currently nearste to the center positio
    nearestVertexIndex = null;

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
        this.discProgram = createProgram(gl, [discVertShaderSource, discFragShaderSource], null, { aModelPosition: 0, aModelNormal: 1, aModelUvs: 2, aInstanceMatrix: 3 });

        // find the locations
        this.discLocations = {
            aModelPosition: gl.getAttribLocation(this.discProgram, 'aModelPosition'),
            aModelUvs: gl.getAttribLocation(this.discProgram, 'aModelUvs'),
            aInstanceMatrix: gl.getAttribLocation(this.discProgram, 'aInstanceMatrix'),
            uWorldMatrix: gl.getUniformLocation(this.discProgram, 'uWorldMatrix'),
            uViewMatrix: gl.getUniformLocation(this.discProgram, 'uViewMatrix'),
            uProjectionMatrix: gl.getUniformLocation(this.discProgram, 'uProjectionMatrix'),
            uCameraPosition: gl.getUniformLocation(this.discProgram, 'uCameraPosition'),
            uScaleFactor: gl.getUniformLocation(this.discProgram, 'uScaleFactor'),
            uRotationAxisVelocity: gl.getUniformLocation(this.discProgram, 'uRotationAxisVelocity'),
            uTex: gl.getUniformLocation(this.discProgram, 'uTex')
        };

        /////////////////////////////////// GEOMETRY / MESH SETUP

        // create disc VAO
        this.discGeo = new DiscGeometry(56, 1);
        this.discBuffers = this.discGeo.data;
        this.discVAO = makeVertexArray(gl, [
            [makeBuffer(gl, this.discBuffers.vertices, gl.STATIC_DRAW), this.discLocations.aModelPosition, 3],
            [makeBuffer(gl, this.discBuffers.uvs, gl.STATIC_DRAW), this.discLocations.aModelUvs, 2]
        ], (this.discBuffers.indices));

        this.icoGeo = new IcosahedronGeometry();
        this.icoGeo.subdivide(1).spherize(this.SPHERE_RADIUS);
        this.instancePositions = this.icoGeo.vertices.map(v => v.position);
        this.DISC_INSTANCE_COUNT = this.icoGeo.vertices.length;
        this.#initDiscInstances(this.DISC_INSTANCE_COUNT);

        this.worldMatrix = mat4.create();

        this.#initTexture();
    
        // init the pointer rotate control
        this.control = new ArcballControl(this.canvas, () => this.#onControlUpdate());
        
        this.#updateCameraMatrix();
        this.#updateProjectionMatrix(gl);

        this.resize();

        if (onInit) onInit(this);
    }

    #initTexture() {
        /** @type {WebGLRenderingContext} */
        const gl = this.gl;

        this.tex = createAndSetupTexture(gl, gl.LINEAR, gl.LINEAR, gl.REPEAT, gl.REPEAT);
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 480, 480, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        this.image = new Image();
        this.image.src = new URL('../assets/tex.jpg', import.meta.url);
        this.image.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, this.tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 480, 480, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
        }
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
            const loc = this.discLocations.aInstanceMatrix + j;
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
        const scale = 0.25 + (Math.abs(this.camera.position[2]) / this.cameraWideAngleDistance) * 0.0;
        const SCALE_INTENSITY = 1;
        positions.forEach((p, ndx) => {
            const s = ((Math.abs(p[2]) / this.SPHERE_RADIUS) * SCALE_INTENSITY + (1 - SCALE_INTENSITY)) * scale;
            const matrix = mat4.create();
            mat4.multiply(matrix, matrix, mat4.fromTranslation(mat4.create(), vec3.negate(vec3.create(), p)));
            mat4.multiply(matrix, matrix, mat4.targetTo(mat4.create(), [0, 0, 0], p, [0, 1, 0]));
            mat4.multiply(matrix, matrix, mat4.fromScaling(mat4.create(), [s, s, s]));
            mat4.multiply(matrix, matrix, mat4.fromTranslation(mat4.create(), [0, 0, -this.SPHERE_RADIUS]));

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

        gl.useProgram(this.discProgram);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.uniformMatrix4fv(this.discLocations.uWorldMatrix, false, this.worldMatrix);
        gl.uniformMatrix4fv(this.discLocations.uViewMatrix, false, this.camera.matrices.view);
        gl.uniformMatrix4fv(this.discLocations.uProjectionMatrix, false, this.camera.matrices.projection);
        gl.uniform3f(this.discLocations.uCameraPosition, this.camera.position[0], this.camera.position[1], this.camera.position[2]);
        gl.uniform4f(this.discLocations.uRotationAxisVelocity, this.control.rotationAxis[0], this.control.rotationAxis[1], this.control.rotationAxis[2], this.control.rotationVelocity);
        gl.uniform1f(this.discLocations.uFrames, this.#frames);
        gl.uniform1f(this.discLocations.uScaleFactor, this.scaleFactor);
        gl.uniform1i(this.discLocations.uTex, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.tex);

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

        const height = this.SPHERE_RADIUS * .35;
        const distance = this.camera.position[2];
        if (this.camera.aspect > 1) {
            this.camera.fov = 2 * Math.atan( height / distance );
        } else {
            this.camera.fov = 2 * Math.atan( (height / this.camera.aspect) / distance );
        }

        mat4.perspective(this.camera.matrices.projection, this.camera.fov, this.camera.aspect, this.camera.near, this.camera.far);
        mat4.invert(this.camera.matrices.inversProjection, this.camera.matrices.projection);

        const size = this.SPHERE_RADIUS * 2;
        if (this.camera.aspect > 1) {
            this.cameraWideAngleDistance = (size / 2) / Math.tan(this.camera.fov / 2);
            this.cameraFocusAngleDistance = 1.5 / Math.tan(this.camera.fov / 2);
        } else {
            this.cameraWideAngleDistance = (size / 2) / Math.tan ((this.camera.fov * this.camera.aspect) / 2);
            this.cameraFocusAngleDistance = 1.5 / Math.tan ((this.camera.fov * this.camera.aspect) / 2);
        }
        //console.log(this.cameraFocusAngleDistance, this.cameraWideAngleDistance);
        //this.cameraWideAngleDistance += 0.8;
    }

    #onControlUpdate() {
        let damping = 5;
        let cameraTargetZ = 3;

        if (!this.control.isPointerDown) {
            const nearestVertexIndex = this.#findNearestVertexIndex();
            const snapDirection = vec3.normalize(vec3.create(), this.#getVertexWorldPosition(nearestVertexIndex));
            // focus on the selected item
            this.control.snapTargetDirection = snapDirection;
        } else {
            cameraTargetZ += (this.control.rotationVelocity * 80) + 2.25;
            damping = 7;
        }

        this.camera.position[2] += (cameraTargetZ - this.camera.position[2]) / damping;
        this.#updateCameraMatrix();
    }

    #findNearestVertexIndex() {
        // map the XY-Plane normal to the model space
        const n = this.control.snapDirection;
        const inversOrientation = quat.conjugate(quat.create(), this.control.orientation);
        // transform the normal to model space
        const nt = vec3.transformQuat(vec3.create(), n, inversOrientation);
        
        // find the nearest vertex 
        const vertices = this.instancePositions;
        let maxD = -1;
        let nearestVertexIndex;
        for(let i=0; i<vertices.length; ++i) {
            const d = vec3.dot(nt, vertices[i]);
            if (d > maxD) {
                maxD = d;
                nearestVertexIndex = i;
            }
        }

        return nearestVertexIndex;
    }

    #getVertexWorldPosition(index) {
        const nearestVertexPos = this.instancePositions[index];
        return vec3.transformQuat(vec3.create(), nearestVertexPos, this.control.orientation);
    }
}