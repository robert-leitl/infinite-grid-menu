#version 300 es

precision highp float;

uniform float uFrames;
uniform float uScaleFactor;
uniform vec3 uCameraPosition;
uniform sampler2D uTex;

out vec4 outColor;

in vec2 vUvs;
in float vAlpha;
flat in int vInstanceId;

void main() {
    int SIZE = 5;
    int i = vInstanceId % (SIZE * SIZE);
    int iX = i % SIZE;
    int iY =(i - iX) / SIZE;
    vec2 s = vUvs / float(SIZE);
    vec2 st = s + vec2(float(iX) / float(SIZE), float(iY) / float(SIZE));
    st *= 0.9;

    outColor = texture(uTex, st);
    outColor *= vAlpha;
}