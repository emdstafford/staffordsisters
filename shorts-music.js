// Original, generated Stafford Sisters instrumentals. No song downloads or copyrighted music.
export const SHORTS_TRACKS={
 none:{name:'Original audio / No added music',emoji:'🔇'},
 sunshine:{name:'Sunshine Pop',emoji:'☀️',mood:'Happy & bouncy',bpm:116,key:60,mode:'major',progression:[0,5,3,4],melody:[0,null,2,4,2,null,4,null,5,null,4,2,0,null,2,null],voice:'square',beat:'pop'},
 starlight:{name:'Starlight Dream',emoji:'✨',mood:'Dreamy & magical',bpm:88,key:57,mode:'major',progression:[0,5,3,4],melody:[0,null,null,2,4,null,7,null,6,null,4,null,2,null,0,null],voice:'bell',beat:'soft'},
 cozy:{name:'Cozy Lo-fi',emoji:'☕',mood:'Soft & relaxing',bpm:82,key:62,mode:'minor',progression:[0,5,3,4],melody:[0,null,2,null,3,null,2,null,4,null,3,null,2,null,0,null],voice:'sine',beat:'lofi'},
 sparkle:{name:'Bubblegum Sparkle',emoji:'💖',mood:'Sweet & bubbly',bpm:122,key:64,mode:'major',progression:[0,4,5,3],melody:[0,2,4,null,5,4,2,null,7,null,5,4,2,null,0,null],voice:'bell',beat:'pop'},
 dance:{name:'Dance Party',emoji:'🪩',mood:'Upbeat party beat',bpm:126,key:60,mode:'minor',progression:[0,5,3,4],melody:[0,null,0,2,3,null,5,3,2,null,5,7,5,null,3,2],voice:'sawtooth',beat:'dance'},
 adventure:{name:'Adventure Time',emoji:'🌈',mood:'Bright & adventurous',bpm:112,key:67,mode:'major',progression:[0,3,4,0],melody:[0,null,2,4,5,null,4,2,4,null,5,7,6,5,4,null],voice:'triangle',beat:'pop'},
 chill:{name:'Cloud Nine',emoji:'☁️',mood:'Chill & peaceful',bpm:78,key:65,mode:'major',progression:[0,5,3,4],melody:[0,null,null,null,4,null,2,null,5,null,null,4,2,null,null,null],voice:'sine',beat:'soft'},
 funky:{name:'Funky Friends',emoji:'🎸',mood:'Fun, groovy & silly',bpm:106,key:58,mode:'minor',progression:[0,3,4,3],melody:[0,null,2,0,null,4,3,null,5,null,3,2,0,null,2,null],voice:'square',beat:'funk'}
};
const MAJOR=[0,2,4,5,7,9,11],MINOR=[0,2,3,5,7,8,10];
const midiHz=m=>440*Math.pow(2,(m-69)/12);
export function createShortsMusicPlayer({onStop=()=>{},onState=()=>{}}={}){
 let ctx=null,timer=null,master=null,playing=null,nextTime=0,step=0,noiseBuffer=null;
 function osc(freq,at,length,amp,type='sine',filterHz=0){
  if(!ctx||ctx.state==='closed')return;
  const oscillator=ctx.createOscillator(),env=ctx.createGain();
  oscillator.type=type;oscillator.frequency.setValueAtTime(freq,at);
  const rise=.012,release=Math.min(length*.28,.15);
  env.gain.setValueAtTime(.0001,at);
  env.gain.exponentialRampToValueAtTime(Math.max(.00011,amp),at+rise);
  env.gain.exponentialRampToValueAtTime(.0001,at+Math.max(.03,length-release));
  let tail=env;
  if(filterHz){
   const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=filterHz;
   oscillator.connect(lp);lp.connect(env);
  }else oscillator.connect(env);
  tail.connect(master);
  oscillator.start(at);oscillator.stop(at+length);
  oscillator.onended=()=>{try{oscillator.disconnect();env.disconnect()}catch{}};
 }
 function makeNoise(){
  if(noiseBuffer)return noiseBuffer;
  const buf=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
  const a=buf.getChannelData(0);
  for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;
  return noiseBuffer=buf;
 }
 function noise(at,length,volume,cutoff){
  const source=ctx.createBufferSource(),env=ctx.createGain(),filter=ctx.createBiquadFilter();
  source.buffer=makeNoise();filter.type='highpass';filter.frequency.value=cutoff;
  env.gain.setValueAtTime(Math.max(volume,.0001),at);
  env.gain.exponentialRampToValueAtTime(.0001,at+length);
  source.connect(filter);filter.connect(env);env.connect(master);
  source.start(at);source.stop(at+length);
  source.onended=()=>{try{source.disconnect();filter.disconnect();env.disconnect()}catch{}};
 }
 function kick(at){
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type='sine';
  o.frequency.setValueAtTime(145,at);
  o.frequency.exponentialRampToValueAtTime(47,at+.15);
  g.gain.setValueAtTime(.18,at);
  g.gain.exponentialRampToValueAtTime(.0001,at+.22);
  o.connect(g);g.connect(master);o.start(at);o.stop(at+.24);
  o.onended=()=>{try{o.disconnect();g.disconnect()}catch{}};
 }
 function degreeToMidi(degree,track){
  const scale=track.mode==='minor'?MINOR:MAJOR;
  const idx=((degree%7)+7)%7;
  const oct=Math.floor(degree/7);
  return track.key+scale[idx]+oct*12;
 }
 function beat(track,barStep,at){
  if(track.beat==='soft'){
   if(barStep===0||barStep===8)kick(at);
   if(barStep===4||barStep===12)noise(at,.10,.033,1400);
   if(barStep%4===2)noise(at,.045,.017,5000);
  }else if(track.beat==='lofi'){
   if(barStep===0||barStep===10)kick(at);
   if(barStep===4||barStep===12)noise(at,.10,.06,1100);
   if(barStep%2===0)noise(at,.03,.012,4300);
  }else if(track.beat==='funk'){
   if([0,6,10].includes(barStep))kick(at);
   if(barStep===4||barStep===12)noise(at,.08,.065,2000);
   if(barStep%2===0)noise(at,.034,.025,6500);
  }else{
   if(barStep%4===0)kick(at);
   if(barStep===4||barStep===12)noise(at,.09,.065,2200);
   if(barStep%2===0)noise(at,.027,track.beat==='dance'?.035:.021,6200);
  }
 }
 function scheduleStep(track,stepNumber,at){
  const inBar=stepNumber%16,bar=Math.floor(stepNumber/16)%4;
  const base=track.progression[bar],sec=60/track.bpm/4;
  if(inBar===0){
   const chordDegrees=[base,base+2,base+4];
   chordDegrees.forEach((d,i)=>osc(midiHz(degreeToMidi(d,track)-12),at,sec*13.5,.018,
    i===0?'triangle':'sine',1600));
  }
  if(inBar%4===0){
   osc(midiHz(degreeToMidi(base,track)-24),at,sec*3.2,track.beat==='funk'?.12:.09,
    track.beat==='funk'?'square':'triangle',480);
  }
  const degree=track.melody[inBar];
  if(degree!==null&&degree!==undefined){
   const wave=track.voice==='bell'?'sine':track.voice;
   const midi=degreeToMidi(degree,track)+(track.voice==='bell'?12:0);
   osc(midiHz(midi),at,sec*(inBar%2===0?1.85:.93),
    track.voice==='bell'?.12:track.voice==='sawtooth'?.045:.075,
    wave,track.voice==='sawtooth'?1350:track.voice==='square'?1900:0);
   if(track.voice==='bell')osc(midiHz(midi+12),at,sec*.9,.03,'sine');
  }
  beat(track,inBar,at);
 }
 function tick(){
  if(!ctx||!playing||ctx.state!=='running')return;
  const config=SHORTS_TRACKS[playing],duration=60/config.bpm/4;
  while(nextTime<ctx.currentTime+.18){
   scheduleStep(config,step,nextTime);
   nextTime+=duration;
   step=(step+1)%64;
  }
 }
 function stop(){
  if(timer){clearInterval(timer);timer=null}
  if(ctx){
   try{master?.gain.setTargetAtTime(0,ctx.currentTime,.015)}catch{}
   const previous=ctx;setTimeout(()=>previous.close().catch(()=>{}),75);
  }
  const previousTrack=playing;
  playing=null;ctx=null;master=null;noiseBuffer=null;step=0;
  if(previousTrack){onStop(previousTrack);onState(null)}
 }
 async function start(track){
  if(!SHORTS_TRACKS[track]||track==='none')return false;
  stop();
  const AudioContext=window.AudioContext||window.webkitAudioContext;
  if(!AudioContext)throw Error('This device cannot play the soundtrack.');
  if(navigator.audioSession&&'type'in navigator.audioSession){
   try{navigator.audioSession.type='playback'}catch{}
  }
  const newCtx=new AudioContext();
  ctx=newCtx;
  const limiter=newCtx.createDynamicsCompressor();
  limiter.threshold.value=-12;limiter.knee.value=8;limiter.ratio.value=4;
  limiter.attack.value=.004;limiter.release.value=.15;
  master=newCtx.createGain();
  master.gain.value=.42;
  master.connect(limiter);limiter.connect(newCtx.destination);
  playing=track;step=0;
  nextTime=newCtx.currentTime+.045;
  try{
   await newCtx.resume();
   if(ctx!==newCtx)return false;
   if(newCtx.state!=='running')throw Error('Tap Play again to allow sound on this device.');
   tick();
   timer=setInterval(tick,75);
   onState(track);
   return true;
  }catch(err){
   if(ctx===newCtx)stop();
   throw err;
  }
 }
 return {start,stop,getTrack:()=>playing,isPlaying:track=>playing===track};
}
