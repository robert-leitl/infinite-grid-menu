#version 300 es

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