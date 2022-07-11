import { InfiniteGridMenu } from "./infinite-grid-menu.js";

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const debugParam = urlParams.get('debug');

if (debugParam) {
    DEBUG = true;
}

let sketch;
let resizeTimeoutId;

window.addEventListener('load', () => {
    const canvas = document.getElementById('infinite-grid-menu-canvas');
    sketch = new InfiniteGridMenu(canvas, (sketch) => sketch.run());
});

window.addEventListener('resize', () => {
    if (sketch) {
        if (resizeTimeoutId)
            clearTimeout(resizeTimeoutId);

        resizeTimeoutId = setTimeout(() => {
            resizeTimeoutId = null;
            sketch.resize();
        }, 300);
    }
});