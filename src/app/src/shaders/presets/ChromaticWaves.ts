/**
 * Chromatic Waves — native ORBITAL WebGL dot-matrix field.
 * Adapted from the imported OGL reference into one Core Textures-owned pass:
 * no React, no OGL dependency, and no private animation loop.
 */
import type { AudioData, ShaderParams, ShaderPreset } from '../ShaderRegistry';

let gl: WebGLRenderingContext | null = null;
let program: WebGLProgram | null = null;
let buffer: WebGLBuffer | null = null;
let positionLocation = -1;
const uniforms: Record<string, WebGLUniformLocation | null> = {};
let smoothAudio = 0;

const vertex = `attribute vec2 a_position; varying vec2 v_uv; void main(){v_uv=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}`;
const fragment = `
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform vec3 u_a; uniform vec3 u_b; uniform vec3 u_c; uniform vec3 u_d;
uniform float u_time; uniform float u_audio; uniform float u_frequency; uniform float u_speed;
uniform float u_contrast; uniform float u_cell; uniform float u_gamma; uniform float u_bias; uniform float u_dotDensity;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.02+17.3;a*=.5;}return v;}
vec3 palette(float t){
  vec3 ab=mix(u_a,u_b,smoothstep(0.,.36,t));
  vec3 cd=mix(u_c,u_d,smoothstep(.55,1.,t));
  return mix(ab,cd,smoothstep(.34,.78,t));
}
void main(){
  vec2 p=(v_uv-.5)*2.;p.x*=u_resolution.x/max(1.,u_resolution.y);
  float time=u_time*(.18+u_speed*.82);
  float field=fbm(p*u_frequency+vec2(time*.16,-time*.11));
  field+=.28*sin((p.x+p.y)*u_frequency*2.2-time*.65);
  field+=u_audio*.18*sin(length(p)*10.-time*2.2);
  field=clamp(field*.72+.18+u_bias,0.,1.);
  field=pow(field,max(.2,u_gamma*.22));
  field=clamp((field-.5)*u_contrast+.5,0.,1.);
  float cell=u_cell/max(120.,min(u_resolution.x,u_resolution.y));
  vec2 grid=p/cell; vec2 local=fract(grid)-.5;
  float dotRadius=(.13+.31*field)*u_dotDensity;
  float dot=1.-smoothstep(dotRadius,dotRadius+.035,length(local));
  vec3 color=palette(clamp(field+.16*sin(time*.42+p.x*1.6),0.,1.));
  float vignette=smoothstep(1.34,.2,length(p));
  gl_FragColor=vec4(color*dot*vignette,dot*vignette);
}`;

function compile(type: number, source: string): WebGLShader | null { if (!gl) return null; const shader=gl.createShader(type); if(!shader)return null; gl.shaderSource(shader,source); gl.compileShader(shader); if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null;} return shader; }
function hsl(hue: number, saturation: number, lightness: number): [number,number,number] { const h=(((hue%360)+360)%360)/360; const q=lightness<.5?lightness*(1+saturation):lightness+saturation-lightness*saturation; const p=2*lightness-q; const f=(t:number)=>{let x=t;if(x<0)x+=1;if(x>1)x-=1;if(x<1/6)return p+(q-p)*6*x;if(x<.5)return q;if(x<2/3)return p+(q-p)*(2/3-x)*6;return p;};return [f(h+1/3),f(h),f(h-1/3)]; }
function u1(name:string,value:number){if(gl&&uniforms[name])gl.uniform1f(uniforms[name],value);}
function u3(name:string,value:[number,number,number]){if(gl&&uniforms[name])gl.uniform3f(uniforms[name],value[0],value[1],value[2]);}

export const ChromaticWavesShader: ShaderPreset = {
  id:'chromatic-waves', name:'Chromatic Waves', description:'Living chromatic noise resolved through a halftone dot-matrix field',
  thumbnail:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%230a0b18" width="100" height="100"/%3E%3Cg fill="%235bf4ff"%3E%3Ccircle cx="16" cy="22" r="5"/%3E%3Ccircle cx="44" cy="18" r="8"/%3E%3Ccircle cx="76" cy="26" r="6"/%3E%3Ccircle cx="24" cy="60" r="9"/%3E%3Ccircle cx="55" cy="56" r="5"/%3E%3Ccircle cx="80" cy="72" r="10"/%3E%3C/g%3E%3C/svg%3E',
  type:'webgl', category:'experimental',
  defaults:{audioIntensity:.56,frequencyRange:'full',beatSync:true,scale:1,speed:.8,opacity:1,blendMode:'screen',chromaticFrequency:1,chromaticSpeed:.8,chromaticContrast:1.12,chromaticCellSize:22,chromaticGamma:3,chromaticPaletteBias:-.12,chromaticDotDensity:.82,chromaticAudioWave:.72},
  controls:{
    chromaticFrequency:{type:'slider',label:'Field Frequency',min:.3,max:3,step:.05,default:1},
    chromaticSpeed:{type:'slider',label:'Wave Speed',min:0,max:2,step:.05,default:.8},
    chromaticContrast:{type:'slider',label:'Contrast',min:.45,max:2.2,step:.05,default:1.12},
    chromaticCellSize:{type:'slider',label:'Cell Size',min:8,max:56,step:1,default:22},
    chromaticGamma:{type:'slider',label:'Density Gamma',min:.5,max:8,step:.1,default:3},
    chromaticPaletteBias:{type:'slider',label:'Palette Shift',min:-1,max:1,step:.05,default:-.12},
    chromaticDotDensity:{type:'slider',label:'Dot Density',min:.25,max:1,step:.05,default:.82},
    chromaticAudioWave:{type:'slider',label:'Audio Wave',min:0,max:2,step:.05,default:.72},
  },
  init(canvas){gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false}) as WebGLRenderingContext|null;if(!gl)return;const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);if(!vs||!fs)return;program=gl.createProgram();if(!program)return;gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);program=null;return;}buffer=gl.createBuffer();if(!buffer)return;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);positionLocation=gl.getAttribLocation(program,'a_position');for(const name of ['u_resolution','u_a','u_b','u_c','u_d','u_time','u_audio','u_frequency','u_speed','u_contrast','u_cell','u_gamma','u_bias','u_dotDensity'])uniforms[name]=gl.getUniformLocation(program,name);smoothAudio=0;},
  render(audio,params,time){if(!gl||!program||!buffer)return;const source=params.frequencyRange==='low'?audio.bass:params.frequencyRange==='mid'?audio.mid:params.frequencyRange==='high'?audio.treble:audio.energy;const target=Math.max(0,Math.min(1,source*(params.audioIntensity??.56)));smoothAudio+=(target-smoothAudio)*.11;const hue=Number(params.hue??210),bias=Number(params.chromaticPaletteBias??-.12);const a=hsl(hue+8,.86,.60),b=hsl(hue+72,.84,.60),c=hsl(hue+154,.82,.59),d=hsl(hue+238,.80,.62);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(positionLocation);gl.vertexAttribPointer(positionLocation,2,gl.FLOAT,false,0,0);u1('u_time',time/1000);u1('u_audio',Math.pow(smoothAudio,.6)*Number(params.chromaticAudioWave??.72));u1('u_frequency',Number(params.chromaticFrequency??1));u1('u_speed',Number(params.chromaticSpeed??params.speed??.8));u1('u_contrast',Number(params.chromaticContrast??1.12));u1('u_cell',Number(params.chromaticCellSize??22));u1('u_gamma',Number(params.chromaticGamma??3));u1('u_bias',bias);u1('u_dotDensity',Number(params.chromaticDotDensity??.82));if(uniforms.u_resolution)gl.uniform2f(uniforms.u_resolution,gl.canvas.width,gl.canvas.height);u3('u_a',a);u3('u_b',b);u3('u_c',c);u3('u_d',d);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);},
  resize(width,height){gl?.viewport(0,0,width,height);},
  cleanup(){if(gl&&program)gl.deleteProgram(program);if(gl&&buffer)gl.deleteBuffer(buffer);gl=null;program=null;buffer=null;positionLocation=-1;smoothAudio=0;Object.keys(uniforms).forEach(key=>{uniforms[key]=null;});},
};
