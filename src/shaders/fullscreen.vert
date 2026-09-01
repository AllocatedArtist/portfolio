#version 300 es

// Fullscreen triangle from gl_VertexID alone. No VBO, no attributes:
// draw with gl.drawArrays(gl.TRIANGLES, 0, 3).
//
//   id 0 -> (-1,-1)   id 1 -> ( 3,-1)   id 2 -> (-1, 3)
//
// The triangle overshoots the viewport so its interior covers the whole
// clip volume, which avoids the diagonal seam a two-triangle quad puts
// down the middle of the screen.

void main() {
  vec2 p = vec2(
      float((gl_VertexID << 1) & 2),
      float(gl_VertexID & 2)
    );

  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
