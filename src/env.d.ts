/// <reference types="astro/client" />

// vite-plugin-glsl returns shader sources as strings. Without these,
// importing a .frag from TypeScript is an error under strict mode.
declare module "*.glsl" {
  const source: string;
  export default source;
}

declare module "*.vert" {
  const source: string;
  export default source;
}

declare module "*.frag" {
  const source: string;
  export default source;
}
