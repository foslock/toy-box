// One exposure at a time: a flash raymarch of the real lake from wherever the craft is, on grainy film.
import { FIELD, N, SIZE } from './world.js';
export const W = 480, H = 360;

const COMMON = `#version 300 es
precision highp float; precision highp sampler2D;
uniform sampler2D uF; uniform vec3 uCam; uniform float uH,uP; uniform vec4 uM; uniform vec4 uIt; uniform float uSeed; uniform float uGhost;
out vec4 O;
float h1(vec3 p){p=fract(p*.3183+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h1(i),h1(i+vec3(1,0,0)),f.x),mix(h1(i+vec3(0,1,0)),h1(i+vec3(1,1,0)),f.x),f.y),mix(mix(h1(i+vec3(0,0,1)),h1(i+vec3(1,0,1)),f.x),mix(h1(i+vec3(0,1,1)),h1(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){return n3(p)*.55+n3(p*2.1+3.)*.28+n3(p*4.3+9.)*.17;}
mat2 R(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float box(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float cap(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
float cyl(vec3 p,float r,float h){vec2 d=abs(vec2(length(p.xz),p.y))-vec2(r,h);return min(max(d.x,d.y),0.)+length(max(d,0.));}
float tor(vec3 p,float R_,float r){return length(vec2(length(p.xy)-R_,p.z))-r;}
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float mtl;
float craft(vec3 p){ // the survey craft, about 9 m long, nose toward +z
 float d=cap(p,vec3(0,0,-3.2),vec3(0,0,3.),1.75);
 for(float i=-2.;i<3.;i++) d=min(d,tor(p-vec3(0,0,i*1.5),1.78,.1));
 d=min(d,cyl(p-vec3(0,2.2,.2),.75,.9));
 d=min(d,cap(vec3(abs(p.x),p.yz),vec3(1.3,-2.3,-3.),vec3(1.3,-2.3,3.),.16));
 d=min(d,cap(vec3(abs(p.x),p.yz),vec3(1.2,-1.2,1.8),vec3(1.3,-2.3,1.8),.1));
 d=min(d,cap(vec3(abs(p.x),p.yz),vec3(1.2,-1.2,-1.8),vec3(1.3,-2.3,-1.8),.1));
 d=min(d,max(tor(p-vec3(0,0,-5.4),1.2,.12),-9.)); d=min(d,box(p-vec3(0,0,-5.),vec3(1.2,.06,.4)));d=min(d,box(p-vec3(0,0,-5.),vec3(.06,1.2,.4)));
 return d;}
`;
const SUBJ = {
  none: 'float subj(vec3 p){return 1e3;}',
  A: `float subj(vec3 p){p.xy=R(.1)*p.xy;float d=cyl(p-vec3(0,-.6,0),.26,5.);vec3 q=p;q.y=mod(p.y+.5,1.)-.5;if(abs(p.y+.6)<4.6)d=min(d,max(cyl(q,.4,.07),-9.));
   d=min(d,box(p-vec3(0,3.2,.35),vec3(1.5,.75,.07)));d=min(d,cap(p,vec3(0,4,0),vec3(1.8,2.6,1.2),.06));
   d=min(d,cap(p,vec3(0,-4.4,0),vec3(2.2,-5.,1.),.35));d=min(d,cap(p,vec3(0,-4.4,0),vec3(-1.6,-5.,1.6),.35));
   mtl=abs(p.z-.35)<.2&&abs(p.y-3.2)<.8?.9-.6*step(.5,fract(p.x*1.2))*step(.3,abs(p.y-3.2)):(.35+.5*step(.5,fract(p.y*.5)));return d;}`,
  B: `float subj(vec3 p){mtl=.95;float z=p.z;float d=cap(p,vec3(0,-4.6,-12),vec3(0,-4.2,9),.55);
   float i=clamp(floor(z/2.+.5),-5.,4.);float rr=4.6-.07*i*i;vec3 q=vec3(p.x,p.y+4.4,z-i*2.);q.z-=.09*q.y+sin(i*3.1)*.3;
   float a=tor(q-vec3(0,rr*.92,0),rr,.24-.02*abs(q.y)*.3);a=max(a,q.y-rr*1.75+abs(sin(i*7.3))*2.4);d=min(d,a);
   vec3 s=p-vec3(0,-3.2,12.6);d=min(d,(length(s*vec3(.8,1.,.42))-1.4)*.8);d=max(d,-(length(vec3(abs(s.x)-1.,s.y-.5,s.z+.2))-.6));
   d=min(d,cap(vec3(abs(p.x),p.yz),vec3(.9,-4.6,12.),vec3(.35,-4.9,18.),.28));return d+.05*sin(p.y*1.7+p.x)*sin(p.z*1.3);}`,
  C: `float subj(vec3 p){mtl=.6;float d=1e3;float i=clamp(floor(p.z/1.1),-6.,6.);
   for(float k=-1.;k<2.;k++){float j=clamp(i+k,-6.,6.);float y=-5.+(j+6.)*.62;d=min(d,box(p-vec3(sin(j*5.)*.12,y-2.,j*1.1+.55),vec3(3.4-.04*j,2.3,.57)));}
   d=min(d,box(p-vec3(0,4.6,8.6),vec3(5.,6.,1.)));d=max(d,-box(p-vec3(0,4.4,8.),vec3(1.35,2.7,4.)));
   d=min(d,box(p-vec3(0,7.6,7.4),vec3(2.5,.4,.5)));d=min(d,box(vec3(abs(p.x)-2.,p.y-4.6,p.z-7.4),vec3(.38,3.,.45)));return d-.05;}`,
  D: `float subj(vec3 p){p*=.8;p.y+=1.9;p.xy=R(.28)*p.xy;p.yz=R(-.12)*p.yz;float d=craft(p);d=max(d,-(length(p-vec3(0,3.2,.2))-.8));
   vec3 q=p-vec3(0,3.2,-.9);q.yz=R(-1.1)*q.yz;d=min(d,cyl(q-vec3(0,0,-.2),.82,.09));
   d=min(d,cap(p,vec3(.2,3.,.4),vec3(1.9,.9,1.8),.14));d=min(d,cap(p,vec3(1.9,.9,1.8),vec3(2.2,-2.,2.6),.11));
   mtl=.6+.35*step(abs(abs(p.z)-1.9),.35);return d/.8;}`,
  E: `float subj(vec3 p){p.y+=5.;p*=.62;mtl=.5;float d=box(p-vec3(0,2.3,0),vec3(2.1,.1,1.4));
   vec3 q=vec3(abs(p.x),p.y,abs(p.z));d=min(d,box(q-vec3(1.8,1.1,1.1),vec3(.1,1.15,.1)));
   float cl=box(p-vec3(0,2.02,0),vec3(2.2,.42,1.5))-.04;cl=max(cl,-box(p-vec3(0,1.9,0),vec3(2.12,.42,1.43)));cl+=.05*sin(p.x*7.)*sin(p.z*8.)*smoothstep(2.3,1.6,p.y);if(cl<d){d=cl;mtl=1.;}
   vec3 c=vec3(abs(p.x)-3.4,p.y,p.z);c.x+=step(0.,-p.x)*.0;float ch=box(c-vec3(0,1.3,0),vec3(.7,.09,.7));ch=min(ch,box(vec3(c.x-.65,c.y-2.3,c.z),vec3(.07,1.1,.65)));ch=max(ch,-box(vec3(c.x-.65,c.y-2.1,abs(c.z)-.3),vec3(.3,.6,.14)));
   ch=min(ch,box(vec3(abs(c.x)-.6,c.y-.65,abs(c.z)-.6),vec3(.07,.66,.07)));if(ch<d){d=ch;mtl=.45;}
   float t=cyl(vec3(abs(p.x)-1.2,p.y-2.45,p.z),.45,.03);t=min(t,cyl(vec3(abs(p.x)-1.2,p.y-2.6,p.z-.75),.13,.18));t=min(t,cyl(p-vec3(0,2.8,0),.1,.4));t=min(t,length(p-vec3(0,3.4,0))-.3);if(t<d){d=t;mtl=1.1;}
   return d/.62;}`,
  F: `float subj(vec3 p){p.y+=4.9;vec2 i=clamp(floor(p.xz/2.3+.5),vec2(-6.,-6.),vec2(6.,6.));float d=1e3;
   vec3 q=p;q.xz-=i*2.3;q.xz+=.12*(vec2(h1(vec3(i,1.)),h1(vec3(i,2.)))-.5);float s=.25+(i.y+6.)*.065;float k=mod(i.x+20.,4.);
   if(k<1.)d=length(q-vec3(0,s,0))-s;else if(k<2.)d=cyl(q-vec3(0,s,0),s*.6,s);else if(k<3.){d=tor(q.xzy-vec3(0,0,s*.4),s*.8,s*.28);}else d=min(box(q-vec3(0,s*.7,0),vec3(s*.6,s*.7,s*.6)),length(q-vec3(0,s*1.7,0))-s*.45);
   mtl=k<1.?1.1:k<2.?.8:k<3.?.6:.75;d=min(d,1.1);return d;}`,
  G: `float subj(vec3 p){mtl=.95;float kn=.12*sin(p.y*5.+p.x*3.)*sin(p.z*5.+p.x);float d=cap(p,vec3(0,12,0),vec3(0,1.6,0),.12);
   d=min(d,max(tor(vec3(p.x,p.y-.9,p.z),.75,.17),-p.y-.2+step(0.,p.x)*3.));
   float r=length(p.xz);float sh=max(abs(r-6.)-.6,7.4-p.y);sh+=.5*sin(atan(p.z,p.x)*11.)*.6+.3*sin(p.y*2.4);d=min(d,sh*.6);
   vec3 l=p-vec3(1.9,3.,0);d=min(d,cap(vec3(abs(l.x)-.45,l.yz),vec3(0,-8,0),vec3(0,9,0),.11));l.y=mod(l.y,.9)-.45;if(p.y>-4.&&p.y<12.)d=min(d,cap(l,vec3(-.45,0,0),vec3(.45,.12,0),.09));
   float a=length(p-vec3(-1.4,3.4,0))-.45;d=min(d,a);d=min(d,cap(p,vec3(-1.4,3.6,0),vec3(-1.4,12.,0),.07));if(a<.05)mtl=6.;
   d=min(d,cap(p,vec3(-4,-5,2),vec3(-1.,-4.6,3.4),.35));d=min(d,cap(p,vec3(-4,-5,-1),vec3(3.,-4.8,-3.4),.3));d=min(d,cap(p,vec3(4,-5,1),vec3(1.,-4.7,4.4),.3));return d+kn;}`,
  W: `float subj(vec3 p){p*=.8;p.y+=2.4;p.xy=R(.7)*p.xy;p.x*=1.+.5*smoothstep(2.5,-.5,abs(p.z-.6));p.y+=.5*sin(p.z*1.3);float d=craft(p);d=max(d,-(length(p-vec3(1.4,.8,.8))-1.3));mtl=.6;return d*.7;}`,
  S: `float subj(vec3 p){float d=craft(p);mtl=.7;vec3 q=vec3(abs(p.x)-.9,p.y-.3,p.z-4.4);float l=length(q)-.28;if(l<d){d=l;mtl=5.;}return d;}`,
};
const MAIN = `
float thing(vec3 p){
 p.xz=R(-uIt.z)*p.xz; // local: +z is its front
 float z=p.z;p.x+=sin(z*.22+uSeed)*1.2*smoothstep(0.,-10.,z);p.y+=sin(z*.3)*.6*smoothstep(0.,-10.,z);
 float r=length(p.xy);float rad=1.9*smoothstep(-24.,-4.,z)+.1;float b=max(abs(r)-rad-.13*sin(z*5.),max(z-1.,-24.-z));b=max(b,-(max(r-1.35,-z-3.)));
 float a=atan(p.y,p.x);float k=6.2832/11.;float id=floor(a/k+.5);a-=id*k;vec3 q=vec3(cos(a)*r,sin(a)*r,z);
 float w=.4*sin(id*2.3+uSeed*3.);float f=cap(q,vec3(1.7,0,.6),vec3(2.5+w,0,2.4),.3);f=min(f,cap(q,vec3(2.5+w,0,2.4),vec3(1.2+w,0,4.4),.22));f=min(f,cap(q,vec3(1.2+w,0,4.4),vec3(.5+w*.5,0,4.9),.13));
 return smin(b,f,.5);}
int which;
float map(vec3 p){
 vec2 uv=p.xz/${SIZE}.;float w=texture(uF,uv).r;
 float n=fbm(p*.22);
 float wall=(w*.8+abs(p.y-2.)*-.12)+(n-.5)*5.;
 float fk=uM.w>.5?smoothstep(5.,17.,length(p.xz-uM.xy)):1.;float fl=p.y+5.-(n-.45)*mix(.5,2.2,fk)+.15*fk*sin(p.x*1.1+p.z*.4);
 float ce=12.5-p.y-n*4.;
 float d=smin(smin(wall*.75,fl*.8,3.),ce*.7,3.);which=0;
 vec3 q=p-vec3(uM.x,0,uM.y);q.xz=R(-uM.z)*q.xz;
 if(uM.w>.5){float b=length(q)-22.;if(b>2.){d=min(d,b);}else{float s=subj(q);if(s<d){d=s;which=1;}}}
 if(uIt.w>.5){vec3 c=p-vec3(uIt.x,-.3,uIt.y);float b=length(c)-27.;if(b>2.)d=min(d,b);else{float s=thing(c)*.7;if(s<d){d=s;which=2;}}}
 return d;}
void main(){
 vec2 uv=(gl_FragCoord.xy-.5*vec2(${W}.,${H}.))/${H}.;
 vec3 rd=normalize(vec3(uv*.92,1.));rd.yz=R(uP)*rd.yz;
 float c=cos(uH),s=sin(uH);rd=vec3(rd.x*c+rd.z*s,rd.y,-rd.x*s+rd.z*c);
 vec3 ro=uCam;vec3 right=vec3(c,0,-s);vec3 lp=ro+right*1.3+vec3(0,.9,0);
 float t=.4,d=0.;for(int i=0;i<130;i++){d=map(ro+rd*t);if(d<.004*t+.004||t>64.)break;t+=d*.82;}
 float col=0.;
 if(t<64.){vec3 p=ro+rd*t;map(p);int wh=which;float m=wh==1?mtl:wh==2?.5:.42;
  vec2 e=vec2(.03,0);float dd=map(p);vec3 n=normalize(vec3(map(p+e.xyy)-dd,map(p+e.yxy)-dd,map(p+e.yyx)-dd)+1e-6);
  vec3 L=lp-p;float ld=length(L);L/=ld;float df=max(dot(n,L),0.);
  float sh=1.,q=.25;for(int i=0;i<26;i++){float h=map(p+L*q+n*.05);sh=min(sh,7.*h/q);q+=clamp(h,.12,1.6);if(sh<.02||q>ld)break;}
  sh=clamp(sh,0.,1.);float ao=clamp(map(p+n*.6)/.6,0.,1.);
  float tx=wh==0?.65+.7*fbm(p*1.7):.8+.4*fbm(p*3.);
  float fall=1./(1.+ld*ld*.0042);
  col=m*tx*(df*sh*1.5+.10*ao)*fall;col+=pow(max(dot(reflect(-L,n),-rd),0.),18.)*sh*(wh==2?.3:wh==1?.22:.06)*fall;
  if(m>3.)col=m*.4;
  col*=exp(-t*(wh==2?.05:.033));
 }
 float murk=1.-exp(-min(t,64.)*.04);col+=murk*(.055-.05*length(uv))*1.2;
 // specks of silt caught in the flash
 for(float i=0.;i<46.;i++){vec2 q=vec2(h1(vec3(i,uSeed,1.)),h1(vec3(i,uSeed,2.)))-.5;q.x*=1.4;float z=h1(vec3(i,uSeed,3.));float r=mix(.0014,.011,z*z*z);col+=smoothstep(r,r*.35,length(uv-q))*mix(.34,.07,z)*step(z*9.,t+3.);}
 col*=1.35;col=col/(col+.36)*1.28;col=smoothstep(.0,1.,col*1.02);
 col*=1.-.75*dot(uv,uv)*1.2;
 float g=h1(vec3(gl_FragCoord.xy,uSeed))-.5,g2=n3(vec3(gl_FragCoord.xy*.55,uSeed*7.))-.5;col+=(g*.14+g2*.15)*(.35+col*(1.-col)*2.2);
 float sc=step(.9985,h1(vec3(floor(gl_FragCoord.x+sin(gl_FragCoord.y*.02+uSeed)*2.),uSeed,4.)));col+=sc*.16;
 if(uGhost>.5)col=col*.8+.06;
 O=vec4(vec3(clamp(col,0.,1.)),1.);}
`;
export class Camera {
  constructor() {
    this.cv = document.createElement('canvas'); this.cv.width = W; this.cv.height = H; this.progs = {};
    const gl = this.gl = this.cv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
    if (!gl) return;
    this.cv.addEventListener('webglcontextlost', e => { e.preventDefault(); this.dead = true; });
    this.cv.addEventListener('webglcontextrestored', () => { this.dead = false; this.progs = {}; this.setup(); });
    this.setup();
  }
  setup() {
    const gl = this.gl; this.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, N, N, 0, gl.RED, gl.FLOAT, FIELD);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }
  prog(k) {
    if (this.progs[k]) return this.progs[k];
    const gl = this.gl, p = gl.createProgram();
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); gl.attachShader(p, o); };
    sh(gl.VERTEX_SHADER, '#version 300 es\nlayout(location=0) in vec2 a;void main(){gl_Position=vec4(a,0,1);}'); sh(gl.FRAGMENT_SHADER, COMMON + SUBJ[k] + MAIN);
    gl.linkProgram(p); return this.progs[k] = p;
  }
  warm(k) { if (this.gl && !this.dead) this.prog(k); } // start compiling before the shutter is pressed
  // o: {x,y,h, kind, m:{x,y,rot}, it:{x,y,h}|null, seed, cy, pitch, ghost}
  expose(o) {
    const out = document.createElement('canvas'); out.width = W; out.height = H; const g = out.getContext('2d');
    const gl = this.gl;
    if (!gl || this.dead) { g.fillStyle = '#222'; g.fillRect(0, 0, W, H); g.fillStyle = '#999'; g.font = '20px monospace'; g.fillText('FILM FOGGED', 170, 180); return out; }
    const kind = o.kind && SUBJ[o.kind] ? o.kind : 'none', p = this.prog(kind);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error(kind, gl.getAttachedShaders(p).map(s => gl.getShaderInfoLog(s)).join('\n')); }
    gl.viewport(0, 0, W, H); gl.useProgram(p); const u = n => gl.getUniformLocation(p, n);
    gl.uniform3f(u('uCam'), o.x, o.cy || 0, o.y); gl.uniform1f(u('uH'), o.h); gl.uniform1f(u('uP'), o.pitch || 0);
    gl.uniform4f(u('uM'), o.m ? o.m.x : 0, o.m ? o.m.y : 0, o.m ? o.m.rot || 0 : 0, o.m ? 1 : 0);
    gl.uniform4f(u('uIt'), o.it ? o.it.x : 0, o.it ? o.it.y : 0, o.it ? o.it.h : 0, o.it ? 1 : 0);
    gl.uniform1f(u('uSeed'), o.seed ?? Math.random() * 50); gl.uniform1f(u('uGhost'), o.ghost ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3); g.drawImage(this.cv, 0, 0);
    return out;
  }
}
