// Landmark detailing stays in the same InstancedMesh pipeline as the town.
export function decorateReferenceLandmarks({block,world,rng}){
  const put=(kind,x,y,z,w,h,d)=>block(kind,x,y,z,w,h,d);
  const pennant=(x,y,z)=>{
    put('timber',x,y+4.8,z,.5,9.6,.5);
    put('gold',x,y+10,z,1,1,1);
    for(let i=0;i<6;i++)put('banner',x+2.9-i*.33,y+8.1-i*.61,z,5.5-i*.67,.57,.45);
  };
  const arch=(x,z,width,height,y=0)=>{
    for(const side of [-1,1])put('limestone',x+side*(width/2-1.3),y+height/2,z,2.6,height,3.6);
    put('limestone',x,y+height-1,z,width,2,3.8);
    for(const side of [-1,1])put('trim',x+side*(width/2-1.4),y+height*.82,z,2.9,.9,4);
  };
  const fir=(x,z,h)=>{
    put('timber',x,h*.3,z,1.2,h*.6,1.2);
    for(let i=0;i<5;i++){const w=9.8-i*1.6;put(i%3===0?'leavesLight':'leaves',x,h*.35+i*h*.14,z,w,3.1,w);}
    put('leaves',x,h+.3,z,2.4,2.7,2.4);
  };
  // Varuna-like dramatic blocky peaks beyond the playable west and north
  // ramparts. No physics colliders: distant scenery stays inexpensive.
  let peaks=0;
  const cliff=(x,z,base)=>{
    const h=Math.max(18,base+21*Math.sin(x*.039+z*.013)+16*Math.cos(z*.061-x*.014)+rng()*19);
    const w=10+rng()*5;
    put(rng()<.34?'rockDeep':'rock',x,h/2-2,z,w,h+4,w);
    if(rng()<.58)put('rockDeep',x-w*.22,h*.24,z+w*.15,w*.35,h*.3,w*.7);
    if(h>117)put('limestone',x,h-.4,z,w*.75,3,w*.75);
    else if(rng()<.33)put('moss',x,h+.2,z,w*.9,1.3,w*.9);
    peaks++;
  };
  for(let x=-450;x<=-209;x+=16)for(let z=-355;z<=300;z+=16){
    const west=(x+450)/241;
    cliff(x,z,28+Math.pow(1-west,1.25)*97+22*Math.max(0,1-Math.abs(z+20)/440));
  }
  for(let z=-425;z<=-207;z+=16)for(let x=-204;x<=355;x+=16){
    const north=(z+425)/218;
    cliff(x,z,25+Math.pow(1-north,1.3)*95+23*Math.max(0,1-Math.abs(x)/400));
  }
  for(let i=0;i<110;i++){
    const west=i%3!==0;
    fir(west?-213-rng()*45:-200+rng()*410,west?-175+rng()*345:-209-rng()*40,10+rng()*18);
  }
  // Majestic white citadel: buttressed balconies, lancet windows, arched
  // skybridge, banners, crown cornice and darker shadow relief.
  const cx=-98,cz=-90;
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const x=cx+sx*24,z=cz+sz*22;
    for(let level=0;level<3;level++){
      const y=23+level*8.4,w=13-level;
      put('trim',x,y,z,w,.9,w);
      for(const side of [-1,1]){
        put('stoneDark',x+side*w*.44,y+3,z,1.1,5.5,1.4);
        put('stoneDark',x,y+3,z+side*w*.44,1.4,5.5,1.1);
      }
    }
    put('glass',x+sx*5.8,31,z,.25,5.8,2.1);
    pennant(x,55,z);
  }
  for(let z=-111;z<=-69;z+=5.5){
    put('stone',-122,7,z,3,14,2.2);
    put('limestone',-74,7,z,3,14,2.2);
  }
  for(let z=-103;z<=-73;z+=15)arch(cx,z,18,13,31);
  put('roofOrange',cx,50,cz,27,1.5,26);
  put('gold',cx,51,cz,6,1.8,27);
  for(let x=-71;x<=-35;x+=9)arch(x,-90,8,27,0);
  put('limestone',-53,40,-90,42,3.5,8);
  for(let x=-72;x<=-33;x+=5.5)for(const z of [-94,-86])put('stoneDark',x,43,z,3,2.1,1.6);
  // Cathedral: lancet windows, buttresses, pinnacles, stained-glass rose
  // window and decorative vertical ribs.
  for(const z of [-48,-41,-34,-27,-20,-13,-6])for(const side of [-1,1]){
    const x=side*15.7;
    put('limestone',x,12.5,z,2.4,25,3.2);
    put('trim',x,25.5,z,3.1,1,3.6);
    put('stoneDark',x,27,z,.9,2.1,.9);
    put('gold',x,28.8,z,1.4,1.4,1.4);
  }
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;
    put('trim',Math.cos(a)*4.3,23+Math.sin(a)*4.3,2.15,1.65,1.65,.6);
  }
  put('glass',0,23,2.05,6.6,6.6,.5);
  put('gold',0,23,2.45,.65,7,.25);
  put('gold',0,23,2.45,7,.65,.25);
  // A stepped stone fountain creates a distinct central plaza landmark.
  for(let i=0;i<4;i++)put(i%2?'stone':'limestone',42,.3+i*.75,30,12-i*2.1,.7,12-i*2.1);
  put('glass',42,6.2,30,1.8,7.5,1.8);put('gold',42,10.4,30,2.5,.8,2.5);
  // Awnings, hanging shop signs, flower pots and market frontages.
  for(let i=0;i<85;i++){
    const j=Math.floor(i/4),side=i%4,along=(i*37%282)-141,ave=[-132,-66,0,66,132][j%5];
    const x=side<2?ave+(side===0?7.3:-7.3):along;
    const z=side<2?along:ave+(side===2?7.3:-7.3);
    if(Math.abs(x)<34&&Math.abs(z+28)<46)continue;
    if(Math.abs(x-42)<31&&Math.abs(z-30)<27)continue;
    if(Math.abs(x)>148||Math.abs(z)>148)continue;
    put('woodDark',x,3.6,z,3,.5,2.5);
    put(i%3===0?'banner':i%3===1?'trim':'roofOrange',x,5.2,z,4,1,3.3);
    put('timber',x,4,z,.3,2,.3);
  }
  // Quays, wooden piers and original stylized ships recall the island render.
  for(const x of [-123,-77,-31,24,79,126]){
    put('wood',x,1.1,152,6,2,24);
    for(const z of [143,154,164])for(const side of [-1,1]){
      put('woodDark',x+side*3,.45,z,.7,5,.7);
      put('trim',x+side*3,3.2,z,.8,.4,.8);
    }
  }
  for(const [sx,sz,sc] of [[-95,163,.85],[52,161,1.05]]){
    put('woodDark',sx,.7,sz,9*sc,2.3*sc,24*sc);
    put('wood',sx,2.3,sz,8*sc,2*sc,20*sc);
    put('trim',sx,3.3,sz,7.4*sc,.5*sc,18*sc);
    put('timber',sx,11,sz,.8*sc,16*sc,.8*sc);
    put('plasterCream',sx-2*sc,12,sz,4*sc,8*sc,.3*sc);
    put('plasterCream',sx+2*sc,12,sz,4*sc,8*sc,.3*sc);
    put('banner',sx,19,sz,1,1,1);
  }
  // Bright island-like turquoise sea beyond the city limits.
  put('water',0,-.25,305,790,.16,260);
  put('water',288,-.25,0,220,.16,790);
  for(let i=0;i<76;i++){
    const x=-350+rng()*700,z=194+rng()*240;
    put('foam',x,-.11,z,2+rng()*9,.08,.4+rng()*1.5);
  }
  world.referenceStats={mountainColumns:peaks,landmarks:'castle, cathedral, town, harbour'};
}
