import { InfiniteGridMenu } from "./infinite-grid-menu.js";

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const debugParam = urlParams.get('debug');

if (debugParam) {
    DEBUG = true;
}

let canvas;
let sketch;
let resizeTimeoutId;

window.addEventListener('load', () => {
    canvas = document.getElementById('infinite-grid-menu-canvas');
    sketch = new InfiniteGridMenu(canvas, (sketch) => sketch.run());
});

const resize = () => {
    console.log(window.innerHeight);
    // explicitly set the width and height to compensate for missing dvh and dvw support
    document.body.style.width = `${window.innerWidth}px`;
    document.body.style.height = `${window.innerHeight}px`;
}

window.addEventListener('resize', () => {
    if (sketch) {
        if (resizeTimeoutId)
            clearTimeout(resizeTimeoutId);

        resizeTimeoutId = setTimeout(() => {
            resizeTimeoutId = null;
            resize();
            sketch.resize();
        }, 300);
    }
});

resize();