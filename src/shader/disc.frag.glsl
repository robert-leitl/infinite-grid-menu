#version 300 es

precision highp float;

uniform float uFrames;
uniform float uScaleFactor;
uniform vec3 uCameraPosition;

out vec4 outColor;

in vec2 vUvs;
in float vAlpha;
flat in int vInstanceId;

void main() {
    outColor = vec4(0., 1., float(vInstanceId) / 42., 1.);

    //outColor *= vAlpha;
}