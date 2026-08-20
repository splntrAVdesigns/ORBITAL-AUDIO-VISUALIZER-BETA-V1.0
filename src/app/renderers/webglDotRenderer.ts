/** Batched WebGL point-sprite dot renderer — Sprint 22K.1 */
export class WebGLDotRenderer {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private data = new Float32Array(240 * 9);
  private count = 0;
  private width = 1;
  private height = 1;
  readonly supported = true;

  constructor(maxDots = 240) {
    if (typeof OffscreenCanvas === 'undefined') throw new Error('OffscreenCanvas unavailable; use Canvas2D fallback');
    this.canvas = new OffscreenCanvas(1, 1);
    const gl = this.canvas.getContext('webgl', { alpha:true, premultipliedAlpha:true, antialias:false, preserveDrawingBuffer:false }) as WebGLRenderingContext | null;
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;
    const vs=`attribute vec2 a_pos;attribute float a_size;attribute vec4 a_color;attribute float a_glow;varying vec4 v_color;varying float v_glow;void main(){gl_Position=vec4(a_pos,0.0,1.0);gl_PointSize=a_size;v_color=a_color;v_glow=a_glow;}`;
    const fs=`precision mediump float;varying vec4 v_color;varying float v_glow;void main(){vec2 p=gl_PointCoord*2.0-1.0;float d=length(p);float core=1.0-smoothstep(.72,1.0,d);float glow=(1.0-smoothstep(.18,1.0,d))*v_glow;float a=max(core,glow*.7)*v_color.a;if(d>1.0||a<.002)discard;gl_FragColor=vec4(v_color.rgb*a,a);}`;
    const compile=(type:number,src:string)=>{const sh=gl.createShader(type)!;gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh)||'shader compile');return sh};
    const program=gl.createProgram()!;gl.attachShader(program,compile(gl.VERTEX_SHADER,vs));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'program link');
    this.program=program;this.buffer=gl.createBuffer()!;this.data=new Float32Array(maxDots*9);
  }
  begin(width:number,height:number){
    this.width=Math.max(1,width|0);this.height=Math.max(1,height|0);this.count=0;
    if(this.canvas.width!==this.width)this.canvas.width=this.width;if(this.canvas.height!==this.height)this.canvas.height=this.height;
  }
  add(x:number,y:number,radius:number,h:number,s:number,l:number,alpha:number,glow:number){
    if((this.count+1)*9>this.data.length)return;
    const rgb=hslToRgb(h/360,s/100,l/100);const i=this.count*9;
    this.data[i]=x/(this.width*.5);this.data[i+1]=-y/(this.height*.5);this.data[i+2]=Math.max(1,radius*2*(1+Math.min(2,glow)*.8));this.data[i+3]=rgb[0];this.data[i+4]=rgb[1];this.data[i+5]=rgb[2];this.data[i+6]=alpha;this.data[i+7]=Math.min(1,glow/2);this.data[i+8]=0;this.count++;
  }
  flush(ctx:CanvasRenderingContext2D){
    const gl=this.gl;gl.viewport(0,0,this.width,this.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);if(!this.count)return;
    gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.data.subarray(0,this.count*9),gl.DYNAMIC_DRAW);
    const stride=9*4;const bind=(name:string,size:number,offset:number)=>{const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,stride,offset*4)};
    bind('a_pos',2,0);bind('a_size',1,2);bind('a_color',4,3);bind('a_glow',1,7);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.POINTS,0,this.count);
    ctx.drawImage(this.canvas as any,-this.width/2,-this.height/2,this.width,this.height);
  }
  dispose(){
    const gl=this.gl;
    gl.deleteBuffer(this.buffer);
    gl.deleteProgram(this.program);
    this.count=0;
    this.data=new Float32Array(0);
    this.canvas.width=1;this.canvas.height=1;
  }
}
function hslToRgb(h:number,s:number,l:number):[number,number,number]{
  if(s===0)return[l,l,l];const hue2rgb=(p:number,q:number,t:number)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p};const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;return[hue2rgb(p,q,h+1/3),hue2rgb(p,q,h),hue2rgb(p,q,h-1/3)];
}
