(()=>{
    let openingActive=true;
    const opening=document.getElementById('opening'), stage=document.getElementById('app');
    stage.inert=true;
    const openingCanvas=document.getElementById('opening-space');
    const openingCtx=openingCanvas.getContext('2d');
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let openingFrame=0, openingDone=false, openingStart=performance.now();
    let ow=innerWidth,oh=innerHeight;
    function sizeOpening(){ow=innerWidth;oh=innerHeight;const d=Math.min(devicePixelRatio||1,2);openingCanvas.width=ow*d;openingCanvas.height=oh*d;openingCtx?.setTransform(d,0,0,d,0,0);}
    function finishOpening(){
      if(openingDone)return;openingDone=true;opening.classList.add('leaving');
      setTimeout(()=>{cancelAnimationFrame(openingFrame);window.removeEventListener('resize',sizeOpening);opening.remove();stage.inert=false;openingActive=false;window.dispatchEvent(new Event('blur'));stage.focus({preventScroll:true});},reducedMotion?200:850);
    }
    document.getElementById('opening-skip').addEventListener('click',()=>{window.GameAudio?.unlock();finishOpening();});
    document.addEventListener('keydown',e=>{if(!openingActive)return;if(e.key==='Tab')return;e.preventDefault();e.stopImmediatePropagation();if(['Escape','Enter',' '].includes(e.key)){window.GameAudio?.unlock();finishOpening();}},true);
    window.addEventListener('resize',sizeOpening);sizeOpening();
    const openingStars=Array.from({length:180},()=>({x:(Math.random()-.5)*3,y:(Math.random()-.5)*2,z:Math.random()*2+.1}));
    function openingPolygon(points,fill){const c=openingCtx;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();}
    function drawOpening(now){
      if(openingDone)return;
      const t=(now-openingStart)/1000, duration=reducedMotion?1.4:7.2;
      const c=openingCtx, cx=ow*.5,cy=oh*.43,unit=Math.min(ow,oh);
      const warp=reducedMotion?0:Math.max(0,Math.min(1,(t-2.2)/2));
      c.clearRect(0,0,ow,oh);c.fillStyle='#040c17';c.fillRect(0,0,ow,oh);
      const haze=c.createRadialGradient(cx,cy,0,cx,cy,unit*.7);haze.addColorStop(0,'#15454e');haze.addColorStop(.45,'#091a2b');haze.addColorStop(1,'#040c17');c.fillStyle=haze;c.fillRect(0,0,ow,oh);
      for(const star of openingStars){const z=((star.z-(reducedMotion?0:t)*(.12+warp*.28))%2+2)%2+.12;const x=cx+star.x*unit/z,y=cy+star.y*unit/z;c.strokeStyle='rgba(184,222,241,'+Math.min(.85,1/z*.5)+')';c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x+1+(x-cx)*warp*.13,y+1+(y-cy)*warp*.13);c.stroke();}
      c.save();c.translate(cx,cy);
      const portalScale=reducedMotion?1:1+Math.pow(Math.max(0,t-3.7),3)*.65;
      c.scale(portalScale,portalScale);
      for(let i=0;i<5;i++){c.save();c.rotate((reducedMotion?0:t*.12)+i*.24);c.strokeStyle=i%2?'#a6edce80':'#47cec080';c.lineWidth=i===0?2:1;c.beginPath();c.ellipse(0,0,unit*(.105+i*.014),unit*(.13+i*.012),0,.1+i*.2,Math.PI*1.9+i*.2);c.stroke();c.restore();}
      c.restore();
      // Original faceted mineral fragments orbit the flight corridor.
      for(let i=0;i<10;i++){const a=i*2.399+(reducedMotion?0:t*.08),r=unit*(.27+(i%3)*.14)*(1+warp*.6);const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*.73;c.save();c.translate(x,y);c.rotate(a+t*(reducedMotion?0:.16));const q=10+i%4*9;openingPolygon([[-q,-q*.4],[q,-q*.8],[q*.5,q],[-q*.4,q*.6]],i%2?'#c8773b':'#d9b566');openingPolygon([[-q,-q*.4],[q,-q*.8],[-q*.1,q*.1]],i%2?'#ffb76a':'#ffe6a0');c.restore();}
      // Rear-view expedition craft: split wings, cyan cockpit, twin engines.
      const depart=reducedMotion?0:Math.max(0,Math.min(1,(t-4.6)/1.3));
      c.save();c.translate(cx+Math.sin(t*1.5)*(reducedMotion?0:7)*(1-depart),cy+unit*.23*(1-depart));c.scale((1-depart*.9)*unit/600,(1-depart*.9)*unit/600);
      c.globalAlpha=1-depart;
      c.shadowColor='#71edff';c.shadowBlur=20;
      openingPolygon([[-25,15],[-18,15],[-21,48+warp*60]],'#92f5ff');openingPolygon([[18,15],[25,15],[21,48+warp*60]],'#92f5ff');c.shadowBlur=0;
      openingPolygon([[0,-38],[-17,2],[-63,26],[-39,35],[-9,22],[0,31],[9,22],[39,35],[63,26],[17,2]],'#386a99');
      openingPolygon([[0,-38],[-9,22],[0,31],[9,22]],'#c3f6e4');openingPolygon([[-17,2],[-63,26],[-31,22]],'#80bccc');openingPolygon([[17,2],[63,26],[31,22]],'#6195b1');openingPolygon([[0,-23],[-6,4],[0,11],[6,4]],'#122e4e');c.restore();
      document.getElementById('opening-progress').style.width=Math.min(100,t/duration*100)+'%';
      document.getElementById('opening-title').textContent=t<2.3?'Earth Builder Mission.':t<5?'Beyond the familiar.':'Your mission starts here.';
      document.getElementById('opening-status').textContent=t<2.3?'Three signals. One expedition.':t<5?'Jump corridor aligned · entering warp':'Signal acquired · Earth Builder Mission';
      if(t>=duration){finishOpening();return;}openingFrame=requestAnimationFrame(drawOpening);
    }
    if(openingCtx){openingFrame=requestAnimationFrame(drawOpening);}else{finishOpening();}
    // Fail open if rendering is suspended or unavailable.
    setTimeout(finishOpening,reducedMotion?1600:8500);


function introPad(){if(openingDone)return;const pad=Array.from(navigator.getGamepads?.()||[]).find(Boolean);if(pad?.buttons[0]?.pressed){window.GameAudio?.unlock();finishOpening();}requestAnimationFrame(introPad);}requestAnimationFrame(introPad);
})();
