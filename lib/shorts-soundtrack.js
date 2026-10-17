// Render the eight original Stafford Sisters melodies as ordinary WAV audio.
// This is used only for baking music into a video; no third-party songs are copied.
import {SHORTS_TRACKS} from '../shorts-music.js';

const RATE=22050;
const MAJOR=[0,2,4,5,7,9,11];
const MINOR=[0,2,3,5,7,8,10];
function noteNumber(degree,song){
 const scale=song.mode==='minor'?MINOR:MAJOR;
 const idx=((degree%7)+7)%7;
 return song.key+scale[idx]+Math.floor(degree/7)*12;
}
function hz(midi){return 440*Math.pow(2,(midi-69)/12)}
function wav(samples){
 const out=Buffer.allocUnsafe(44+samples.length*2);
 out.write('RIFF',0);
 out.writeUInt32LE(out.length-8,4);
 out.write('WAVE',8);
 out.write('fmt ',12);
 out.writeUInt32LE(16,16);
 out.writeUInt16LE(1,20);
 out.writeUInt16LE(1,22);
 out.writeUInt32LE(RATE,24);
 out.writeUInt32LE(RATE*2,28);
 out.writeUInt16LE(2,32);
 out.writeUInt16LE(16,34);
 out.write('data',36);
 out.writeUInt32LE(samples.length*2,40);
 for(let i=0;i<samples.length;i++){
  const s=samples[i];
  const softened=Math.tanh(s*1.3)*.85;
  out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,softened))*32767),44+i*2);
 }
 return out;
}
export function makeOriginalSoundtrack(trackId,seconds=60){
 const track=SHORTS_TRACKS[trackId];
 if(!track||trackId==='none')throw Error('Not an original Stafford Sisters music track.');
 if(!Number.isFinite(seconds)||seconds<=0||seconds>60)throw Error('Invalid audio duration.');
 const count=Math.ceil(RATE*seconds),samples=new Float32Array(count);
 const quarter=60/track.bpm;
 const stepSeconds=quarter/4;
 let seed=61523;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 function tone(at,seconds,freq,amp,voice='sine'){
  const start=Math.floor(at*RATE);
  const length=Math.min(Math.floor(seconds*RATE),count-start);
  if(start>=count||length<=0)return;
  const attack=Math.max(1,Math.floor(.01*RATE)),release=Math.max(1,Math.floor(.09*RATE));
  for(let j=0;j<length;j++){
   const t=j/RATE,p=2*Math.PI*freq*t;
   const env=Math.min(1,j/attack,Math.max(0,(length-j)/release));
   let wave=Math.sin(p);
   if(voice==='triangle')wave=2/Math.PI*Math.asin(wave);
   else if(voice==='square')wave=.72*(Math.sin(p)+Math.sin(3*p)/3+Math.sin(5*p)/5);
   else if(voice==='sawtooth')wave=.64*(Math.sin(p)+Math.sin(2*p)/2+Math.sin(3*p)/3);
   else if(voice==='bell')wave=.74*Math.sin(p)+.26*Math.sin(2.01*p);
   samples[start+j]+=amp*wave*env;
  }
 }
 function kick(at){
  const start=Math.floor(at*RATE),length=Math.min(Math.floor(.22*RATE),count-start);
  for(let j=0;j<length;j++){
   const t=j/RATE,env=Math.exp(-t*22);
   samples[start+j]+=.33*Math.sin(2*Math.PI*(56*t+25*(1-Math.exp(-t*28))/28))*env;
  }
 }
 function percussion(at,kind){
  const start=Math.floor(at*RATE);
  const snare=kind==='snare',dur=snare?.12:.048;
  const length=Math.min(Math.floor(dur*RATE),count-start);
  for(let j=0;j<length;j++){
   const env=Math.exp(-j/Math.max(1,length/4));
   const n=rand()*2-1;
   samples[start+j]+=(snare?.11:.052)*n*env;
  }
 }
 const steps=Math.ceil(seconds/stepSeconds);
 for(let step=0;step<steps;step++){
  const at=step*stepSeconds,inBar=step%16,bar=Math.floor(step/16)%4;
  const root=track.progression[bar],melodyDegree=track.melody[inBar];
  if(inBar===0){
   for(const [idx,degree] of [root,root+2,root+4].entries()){
    tone(at,stepSeconds*13,hz(noteNumber(degree,track)-12),idx===0?.068:.035,'sine');
   }
  }
  if(inBar%4===0)tone(at,stepSeconds*3.1,hz(noteNumber(root,track)-24),.22,'triangle');
  if(melodyDegree!==null&&melodyDegree!==undefined){
   const octave=track.voice==='bell'?12:0;
   const wave=track.voice==='bell'?'bell':track.voice;
   tone(at,stepSeconds*(inBar%2===0?1.75:.9),
    hz(noteNumber(melodyDegree,track)+octave),track.voice==='sawtooth'?.10:.16,wave);
  }
  const soft=track.beat==='soft'||track.beat==='lofi';
  if(soft){
   if(inBar===0||(track.beat==='soft'&&inBar===8)||inBar===10&&track.beat==='lofi')kick(at);
   if(inBar===4||inBar===12)percussion(at,'snare');
   if(inBar%4===2)percussion(at,'hat');
  }else{
   if(inBar%4===0||track.beat==='funk'&&inBar===6)kick(at);
   if(inBar===4||inBar===12)percussion(at,'snare');
   if(inBar%2===0)percussion(at,'hat');
  }
 }
 const fade=Math.min(count,Math.floor(.25*RATE));
 for(let i=0;i<fade;i++)samples[count-fade+i]*=(fade-i)/fade;
 return wav(samples);
}
