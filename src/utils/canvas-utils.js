export function resizeCanvasToDisplaySize(canvas) {
    const dpr = Math.min(2, window.devicePixelRatio);

    // Lookup the size the browser is displaying the canvas in CSS pixels.
    const displayWidth  = Math.round(canvas.clientWidth * dpr);
    const displayHeight = Math.round(canvas.clientHeight * dpr);
   
    // Check if the canvas is not the same size.
    const needResize = canvas.width  !== displayWidth ||
                       canvas.height !== displayHeight;
   
    if (needResize) {
      // Make the canvas the same size
      canvas.width  = displayWidth;
      canvas.height = displayHeight;
    }
   
    return needResize;
}