// Private media processing: bake one of our original soundtrack melodies
// into the actual posted video. Does not need new Supabase tables or policies.
import {randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import {adminClient} from '../lib/push-core.js';
import {verifyFamilyMember,membershipError} from '../lib/family-auth.js';
import {makeOriginalSoundtrack} from '../lib/shorts-soundtrack.js';
import {SHORTS_TRACKS} from '../shorts-music.js';

const exec=promisify(execFile),BUCKET='shorts-media';
const VIDEO_PATH=/^[0-9a-f-]{36}\/short-[0-9a-f-]{36}\.(mp4|mov|webm)$/i;
const MAX_BYTES=50*1024*1024;
const fail=(res,code,message)=>res.status(code).json({error:message});

export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return fail(res,405,'Method not allowed.');
 let db,dir;
 try{
  db=adminClient();
  const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];
  if(!token)return fail(res,401,'Please sign in first.');
  const {data:{user},error:authError}=await db.auth.getUser(token);
  if(authError||!user)return fail(res,401,'Your sign-in has expired. Sign in again.');
  const member=await verifyFamilyMember(db,user,token);
  if(!member.ok)return membershipError(res,member);

  const path=String(req.body?.path||''),track=String(req.body?.track||'');
  if(!VIDEO_PATH.test(path)||!path.startsWith(user.id+'/')||
     !Object.hasOwn(SHORTS_TRACKS,track)||track==='none'){
   return fail(res,400,'Please select your own video and one of the available music tracks.');
  }
  if(!ffmpegPath)return fail(res,503,'Video music processing is unavailable right now.');

  const {data:original,error:downloadError}=await db.storage.from(BUCKET).download(path);
  if(downloadError||!original)return fail(res,404,'The video upload could not be found. Please try posting again.');
  const input=Buffer.from(await original.arrayBuffer());
  if(input.length<100||input.length>MAX_BYTES)return fail(res,400,'Video files must be under 50 MB.');

  dir=await mkdtemp(join(tmpdir(),'stafford-music-'));
  const inputPath=join(dir,'original.'+path.split('.').pop().toLowerCase());
  const soundtrackPath=join(dir,'soundtrack.wav');
  const outputPath=join(dir,'with-music.mp4');
  await writeFile(inputPath,input);

  let diagnostic='';
  try{
   await exec(ffmpegPath,['-hide_banner','-i',inputPath],{timeout:9000,maxBuffer:500000});
  }catch(e){diagnostic=String(e?.stderr||'')}
  const videoStream=/Stream #\d+:\d+[^\n]* Video:/i.test(diagnostic);
  const audioStream=/Stream #\d+:\d+[^\n]* Audio:/i.test(diagnostic);
  const h264=/Stream #\d+:\d+[^\n]* Video: h264/i.test(diagnostic);
  if(!videoStream)return fail(res,400,'That file is not a video Stafford Sisters can process.');
  const duration=diagnostic.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if(duration&&Number(duration[1])*3600+Number(duration[2])*60+Number(duration[3])>60.5){
   return fail(res,400,'Choose a video that is 60 seconds or shorter.');
  }
  // Generate 60 seconds of the selected original music in a standard WAV file.
  await writeFile(soundtrackPath,makeOriginalSoundtrack(track,60));

  const filter=audioStream?
   '[0:a:0]volume=0.78[original];[1:a:0]volume=0.55[background];'+
   '[original][background]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,'+
   'alimiter=limit=0.9[a]':
   '[1:a:0]volume=0.80[a]';
  const args=[
   '-hide_banner','-nostdin','-loglevel','error','-y',
   '-i',inputPath,'-i',soundtrackPath,
   '-filter_complex',filter,
   '-map','0:v:0','-map','[a]',
   '-t','60','-shortest',
   '-c:a','aac','-b:a','128k',
   ...(h264&&input.length<39*1024*1024?['-c:v','copy']:
    ['-c:v','libx264','-preset','veryfast','-crf','26',
     '-vf','scale=720:1280:force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p']),
   '-movflags','+faststart','-max_muxing_queue_size','1024',
   outputPath
  ];
  try{
   await exec(ffmpegPath,args,{timeout:55000,maxBuffer:1500000});
  }catch(e){
   console.error('Shorts music conversion failed',String(e?.stderr||e?.message||'').slice(0,500));
   return fail(res,422,'This video could not have music added automatically. Your original video is safe; try a shorter MP4.');
  }
  const stats=await stat(outputPath);
  if(stats.size<1000||stats.size>MAX_BYTES)
   return fail(res,422,'The music video was too large to upload. Try a shorter video.');

  const newPath=user.id+'/short-'+randomUUID()+'-mix.mp4';
  const finished=await readFile(outputPath);
  const {error:uploadError}=await db.storage.from(BUCKET).upload(newPath,finished,{
   contentType:'video/mp4',cacheControl:'3600',upsert:false
  });
  if(uploadError){
   console.error('Shorts music upload failed',uploadError.code||'',uploadError.message||'');
   return fail(res,503,'The music video could not be saved. Your original video is still safe.');
  }

  // Do not remove the original until the rendered video is safely saved.
  const {error:removeError}=await db.storage.from(BUCKET).remove([path]);
  if(removeError)console.warn('Unposted original video cleanup delayed',removeError.code||'');
  return res.status(200).json({ok:true,path:newPath,embedded:true});
 }catch(err){
  console.error('Shorts audio embed issue',String(err?.message||'').slice(0,400));
  return fail(res,503,'Could not add music to that video right now. Your original video was not posted.');
 }finally{
  if(dir)await rm(dir,{recursive:true,force:true}).catch(()=>{});
 }
}
