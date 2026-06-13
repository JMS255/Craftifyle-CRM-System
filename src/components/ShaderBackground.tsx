'use client'

import { useEffect, useRef } from 'react'

const VERT = `
  attribute vec2 a_pos;
  void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

const FRAG = `
  precision highp float;
  uniform vec2  u_res;
  uniform float u_time;
  uniform vec2  u_mouse;
  uniform vec4  u_click;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(
      mix(dot(hash2(i),            f),             dot(hash2(i+vec2(1,0)), f-vec2(1,0)), u.x),
      mix(dot(hash2(i+vec2(0,1)),  f-vec2(0,1)),   dot(hash2(i+vec2(1,1)), f-vec2(1,1)), u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float v=0.0, a=0.52;
    mat2 rot = mat2(1.6,1.2,-1.2,1.6);
    for(int i=0;i<6;i++){ v+=a*noise(p); p=rot*p*2.02; a*=0.48; }
    return v;
  }
  void main() {
    vec2 uv = gl_FragCoord.xy / u_res;
    float asp = u_res.x / u_res.y;
    vec2 p = uv * vec2(asp, 1.0);
    vec2 m = u_mouse * vec2(asp, 1.0);
    float t = u_time * 0.12;
    float md = length(p - m);
    vec2 mpush = (m - p) * exp(-md*2.2)*1.4*0.5;
    vec2 q = vec2(fbm(p+t*0.40+mpush), fbm(p+vec2(5.2,1.3)+t*0.28+mpush));
    vec2 r = vec2(fbm(p+3.8*q+vec2(1.7,9.2)+t*0.18), fbm(p+3.8*q+vec2(8.3,2.8)+t*0.14));
    float f = fbm(p+3.5*r+t*0.08);
    float ca = u_time - u_click.z;
    if(u_click.w > 0.5 && ca < 2.5) {
      vec2 cUV = u_click.xy / u_res;
      float cd = length(uv - cUV);
      f += sin(cd*28.0 - ca*7.0) * exp(-cd*5.0) * exp(-ca*1.2) * 0.35;
    }
    f = clamp(f*0.5+0.5, 0.0, 1.0);
    vec3 c0=vec3(0.02,0.04,0.14), c1=vec3(0.03,0.10,0.32), c2=vec3(0.04,0.18,0.38),
         c3=vec3(0.16,0.05,0.38), c4=vec3(0.46,0.06,0.36), c5=vec3(0.62,0.10,0.30);
    float s = f*5.0;
    vec3 col;
    if     (s<1.0) col=mix(c0,c1,s);
    else if(s<2.0) col=mix(c1,c2,s-1.0);
    else if(s<3.0) col=mix(c2,c3,s-2.0);
    else if(s<4.0) col=mix(c3,c4,s-3.0);
    else            col=mix(c4,c5,s-4.0);
    col += vec3(0.12,0.04,0.30) * exp(-md*3.5) * 0.75;
    float vg = 1.0 - smoothstep(0.5, 1.3, length(uv-0.5)*1.6);
    col *= 0.55 + 0.45*vg;
    gl_FragColor = vec4(col, 1.0);
  }
`

export default function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return

    function makeShader(type: number, src: string) {
      const s = gl!.createShader(type)!
      gl!.shaderSource(s, src)
      gl!.compileShader(s)
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, makeShader(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, makeShader(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uRes   = gl.getUniformLocation(prog, 'u_res')
    const uTime  = gl.getUniformLocation(prog, 'u_time')
    const uMouse = gl.getUniformLocation(prog, 'u_mouse')
    const uClick = gl.getUniformLocation(prog, 'u_click')

    let W = 0, H = 0
    let mouseX = 0.5, mouseY = 0.5
    let clickX = 0, clickY = 0, clickT = -99
    const start = performance.now()
    let rafId = 0

    function resize() {
      W = canvas!.width  = window.innerWidth
      H = canvas!.height = window.innerHeight
      gl!.viewport(0, 0, W, H)
    }
    function onMove(e: MouseEvent) {
      mouseX = e.clientX / window.innerWidth
      mouseY = 1 - e.clientY / window.innerHeight
    }
    function onClick(e: MouseEvent) {
      clickX = e.clientX
      clickY = e.clientY
      clickT = (performance.now() - start) / 1000
    }

    function render() {
      const t = (performance.now() - start) / 1000
      gl!.uniform2f(uRes,   W, H)
      gl!.uniform1f(uTime,  t)
      gl!.uniform2f(uMouse, mouseX, mouseY)
      gl!.uniform4f(uClick, clickX, clickY, clickT, 1)
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)
      rafId = requestAnimationFrame(render)
    }

    resize()
    render()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('click', onClick)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('click', onClick)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, display: 'block' }}
    />
  )
}
