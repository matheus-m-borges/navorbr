// A true spherical surface in WebGL: ray/sphere intersection, equirectangular
// Earth texture, axial rotation and projected 3D arcs. No flat-photo rotation.
export const ROTATION_MS = 105000;
const TAU = Math.PI * 2;
const LIMIT = Math.PI / 60; // 3 degrees
const vertex = `
attribute vec2 position;
varying vec2 uv;
void main() { uv = position; gl_Position = vec4(position, 0.0, 1.0); }
`;
const fragment = `
precision highp float;
varying vec2 uv;
uniform sampler2D earth;
uniform float yaw;
uniform float pitch;
uniform float roll;
const float PI = 3.14159265359;
vec3 inverseView(vec3 p) {
  float c=cos(roll), s=sin(roll);
  p.xy=mat2(c,-s,s,c)*p.xy;
  c=cos(pitch); s=sin(pitch);
  p.yz=mat2(c,-s,s,c)*p.yz;
  c=cos(yaw); s=sin(yaw);
  p.xz=mat2(c,s,-s,c)*p.xz;
  return p;
}
void main() {
  vec2 p=uv/0.86;
  float r=length(p);
  vec3 air=vec3(0.25,0.52,0.76);
  float upper=0.45+0.55*clamp(p.y+0.5,0.0,1.0);
  if(r>1.0) {
    float halo=exp(-(r-1.0)*52.0)*0.5*upper;
    gl_FragColor=vec4(air,halo);
    return;
  }
  vec3 n=vec3(p,sqrt(max(0.0,1.0-dot(p,p))));
  vec3 world=inverseView(n);
  vec2 mapUV=vec2(0.5+atan(world.x,world.z)/(2.0*PI),0.5-asin(clamp(world.y,-1.0,1.0))/PI);
  vec3 tex=texture2D(earth,mapUV).rgb;
  float cities=smoothstep(0.15,0.8,max(tex.r,tex.g));
  float terrain=dot(tex,vec3(0.25,0.38,0.37));
  float light=0.35+0.65*max(0.0,dot(n,normalize(vec3(-0.6,0.8,1.0))));
  vec3 surface=vec3(0.017,0.025,0.04)+vec3(0.23,0.30,0.36)*terrain*2.0;
  surface*=light;
  surface+=vec3(1.0,0.64,0.22)*cities*1.65;
  float rim=pow(1.0-n.z,5.0)*upper;
  surface+=air*rim*0.6;
  float edge=1.0-smoothstep(0.998,1.0,r);
  gl_FragColor=vec4(surface,edge);
}
`;
const routeVertex = `
attribute vec3 position;
uniform float yaw;
uniform float pitch;
uniform float roll;
uniform float pointSize;
varying vec3 viewPoint;
void main() {
  vec3 p=position;
  float c=cos(yaw), s=sin(yaw);
  p.xz=mat2(c,-s,s,c)*p.xz;
  c=cos(pitch); s=sin(pitch);
  p.yz=mat2(c,s,-s,c)*p.yz;
  c=cos(roll); s=sin(roll);
  p.xy=mat2(c,s,-s,c)*p.xy;
  viewPoint=p;
  gl_Position=vec4(p.xy*0.86,0.0,1.0);
  gl_PointSize=pointSize;
}
`;
const routeFragment = `
precision mediump float;
varying vec3 viewPoint;
uniform float pointMode;
void main() {
  float front=sqrt(max(0.0,1.0-dot(viewPoint.xy,viewPoint.xy)));
  if(viewPoint.z<front-0.012) discard;
  float alpha=0.36;
  if(pointMode>0.5) {
    float d=length(gl_PointCoord-0.5)*2.0;
    alpha=exp(-d*d*4.5);
  }
  gl_FragColor=vec4(1.0,0.67,0.26,alpha);
}
`;

function worldPoint(lat, lon, radius = 1.009) {
  lat *= Math.PI / 180;
  lon *= Math.PI / 180;
  return [radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon)];
}
// Decorative connections only: these are not locations of NAVOR customers.
const cities = [[-23.55,-46.63],[40.71,-74],[51.5,-.12],[48.85,2.35],[38.72,-9.14],[30.04,31.24],[-1.29,36.82],[-33.92,18.42],[25.2,55.27],[19.08,72.88],[1.35,103.82],[35.68,139.69],[31.23,121.47],[-33.87,151.21],[34.05,-118.24],[-34.6,-58.38],[6.52,3.38],[41,28.97],[52.52,13.41],[37.56,126.97]].map(([lat,lon]) => worldPoint(lat,lon));
const connections = [[0,1],[0,4],[0,7],[0,15],[1,2],[1,14],[2,3],[2,4],[2,5],[2,8],[2,18],[3,17],[4,16],[5,6],[5,8],[6,7],[6,9],[7,8],[8,9],[8,10],[9,10],[10,11],[10,13],[11,12],[11,19],[12,19],[14,11],[16,5],[17,8],[18,17]];
function routes() {
  const data = [];
  for (const [a,b] of connections) {
    const start = cities[a], end = cities[b];
    const dot = start.reduce((sum,x,i) => sum + x * end[i],0) / 1.009 ** 2;
    const angle = Math.acos(Math.max(-1,Math.min(1,dot)));
    const at = t => {
      const radius = 1.01 + Math.sin(t * Math.PI) * Math.min(.16,angle * .07);
      return start.map((x,i) => radius * (Math.sin((1-t)*angle)*x + Math.sin(t*angle)*end[i]) / (Math.sin(angle)*1.009));
    };
    for (let step=0;step<40;step++) data.push(...at(step/40),...at((step+1)/40));
  }
  return new Float32Array(data);
}

export async function createGlobe(canvas, { signal, onFailure = () => {} } = {}) {
  const gl = canvas.getContext('webgl', { alpha:true, antialias:false, depth:false, stencil:false, powerPreference:'low-power', preserveDrawingBuffer:false });
  if (!gl) throw new Error('WebGL unavailable');
  const programs=[], buffers=[], shaders=[], textures=[];
  let disposed=false, ready=false, visible=false, paused=false, frame=0, last=0, angle=-.32;
  let tiltX=0, tiltY=0, targetX=0, targetY=0, lastPaint=0, slowFrames=0;
  let resizeObserver;
  let image;
  const state = (value) => { canvas.dataset.state=value; };
  const stop = () => { cancelAnimationFrame(frame); frame=0; last=0; };
  function dispose() {
    if (disposed) return;
    disposed=true; stop(); resizeObserver?.disconnect();
    buffers.forEach(value => gl.deleteBuffer(value));
    textures.forEach(value => gl.deleteTexture(value));
    programs.forEach(value => gl.deleteProgram(value));
    shaders.forEach(value => gl.deleteShader(value));
    image=null;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    state('disposed');
  }
  function program(vs,fs) {
    const p=gl.createProgram(); programs.push(p);
    for (const [type,source] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]) {
      const shader=gl.createShader(type); shaders.push(shader);
      gl.shaderSource(shader,source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error('Globe shader compilation failed');
      gl.attachShader(p,shader);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error('Globe program linking failed');
    return { program:p, position:gl.getAttribLocation(p,'position'), uniforms:Object.fromEntries(['earth','yaw','pitch','roll','pointMode','pointSize'].map(name => [name,gl.getUniformLocation(p,name)])) };
  }
  function buffer(data) {
    const b=gl.createBuffer(); buffers.push(b); gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW); return b;
  }
  const updateSize = () => {
    const size=Math.max(1,Math.round(Math.min(canvas.clientWidth * Math.min(devicePixelRatio,1.25),1000)));
    if (canvas.width!==size) { canvas.width=size;canvas.height=size;gl.viewport(0,0,size,size); }
  };
  function fail() { if (!disposed) { dispose(); onFailure(); } }
  function sync() {
    if (!ready || disposed) return;
    if (!visible || paused || document.hidden) { stop();state('paused');return; }
    if (!frame) { last=0;lastPaint=0;state('running');frame=requestAnimationFrame(tick); }
  }
  const events={signal};
  document.addEventListener('visibilitychange',sync,events);
  canvas.addEventListener('webglcontextlost',event => { event.preventDefault();fail(); },events);
  signal?.addEventListener('abort',dispose,{once:true});
  let sphere, network, quad, arcs, points, arcCount;
  function draw(t) {
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (const p of [sphere,network]) {
      gl.useProgram(p.program);
      gl.uniform1f(p.uniforms.yaw,angle+tiltX);
      gl.uniform1f(p.uniforms.pitch,.26+tiltY);
      gl.uniform1f(p.uniforms.roll,-.1);
    }
    gl.useProgram(sphere.program);
    gl.bindBuffer(gl.ARRAY_BUFFER,quad);
    gl.enableVertexAttribArray(sphere.position);gl.vertexAttribPointer(sphere.position,2,gl.FLOAT,false,0,0);
    gl.uniform1i(sphere.uniforms.earth,0);gl.drawArrays(gl.TRIANGLES,0,6);
    gl.useProgram(network.program);
    gl.bindBuffer(gl.ARRAY_BUFFER,arcs);
    gl.enableVertexAttribArray(network.position);gl.vertexAttribPointer(network.position,3,gl.FLOAT,false,0,0);
    gl.uniform1f(network.uniforms.pointMode,0);gl.uniform1f(network.uniforms.pointSize,1);
    gl.drawArrays(gl.LINES,0,arcCount);
    gl.bindBuffer(gl.ARRAY_BUFFER,points);gl.vertexAttribPointer(network.position,3,gl.FLOAT,false,0,0);
    gl.uniform1f(network.uniforms.pointMode,1);gl.uniform1f(network.uniforms.pointSize,10*Math.min(devicePixelRatio,1.25));
    gl.drawArrays(gl.POINTS,0,cities.length);
    // Diagnostic state records the actual values supplied to the shaders.
    canvas.dataset.angle=angle.toFixed(6);
    canvas.dataset.tilt=`${tiltX.toFixed(5)},${tiltY.toFixed(5)}`;
    canvas.dataset.frames=String(Number(canvas.dataset.frames || 0)+1);
    lastPaint=t;
  }
  function tick(t) {
    frame=0;
    if (disposed || !visible || paused || document.hidden) { last=0;return; }
    if (last && t-lastPaint<32) { frame=requestAnimationFrame(tick);return; }
    const delta=last ? Math.min(t-last,250) : 0;
    angle=(angle+delta*TAU/ROTATION_MS)%TAU;
    const ease=1-Math.exp(-delta/180);
    tiltX+=(targetX-tiltX)*ease;tiltY+=(targetY-tiltY)*ease;
    // Persistently < 10 fps is not worth the decorative work; return to image.
    slowFrames=delta>100 ? slowFrames+1 : Math.max(0,slowFrames-1);
    if (slowFrames>60) { fail();return; }
    last=t;draw(t);frame=requestAnimationFrame(tick);
  }
  try {
    sphere=program(vertex,fragment); network=program(routeVertex,routeFragment);
    quad=buffer(new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]));
    const routeData=routes();arcs=buffer(routeData);arcCount=routeData.length/3;
    points=buffer(new Float32Array(cities.flat()));
    image=new Image();image.decoding='async';image.src='/assets/earth-night.webp';
    await image.decode();
    if (disposed || signal?.aborted) { dispose();throw new Error('Globe initialization cancelled'); }
    const texture=gl.createTexture();textures.push(texture);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    image=null;
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0,0,0,0);updateSize();
    resizeObserver=new ResizeObserver(updateSize);resizeObserver.observe(canvas);
    ready=true;draw(performance.now());state('paused');
    return {
      setVisible(value) { visible=value;sync(); },
      setPaused(value) { paused=value;sync(); },
      setPointer(x,y) { targetX=Math.max(-LIMIT,Math.min(LIMIT,x*LIMIT));targetY=Math.max(-LIMIT,Math.min(LIMIT,y*LIMIT)); },
      dispose
    };
  } catch(error) { dispose();throw error; }
}
