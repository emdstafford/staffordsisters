// Stafford Sisters Shorts: private family videos, photo shorts, and original musical loops.
export function initShorts({supabase,getMe,profileFor,avatarMarkup,signedUrl,esc,ago,showPage,openProfile,pushDispatch=()=>{}}){
 const $=s=>document.querySelector(s);
 const feed=$('#shorts-feed'),form=$('#shorts-form'),input=$('#shorts-file'),status=$('#shorts-status');
 let mediaFile=null,previewURL=null,items=[],busy=false,music=null;
 const tunes={
  sunshine:{base:261.63,notes:[0,4,7,9,7,4,2,4,5,9,7,4,2,0],speed:290},
  starlight:{base:220,notes:[0,7,9,7,4,2,0,-3,0,4,7,4],speed:390},
  cozy:{base:196,notes:[0,2,4,7,4,2,0,-3,0,2,5,2],speed:350}
 };
 function message(txt,bad=false){status.textContent=txt;status.hidden=!txt;status.style.color=bad?'#a42d4f':'#60426f'}
 function stopMusic(){
  if(!music)return;
  clearInterval(music.timer);
  music.ctx.close().catch(()=>{});
  music=null;
  document.querySelectorAll('.short-music-play').forEach(x=>x.textContent='♫ Play soundtrack');
  $('#shorts-preview-music').textContent='♫ Preview soundtrack';
 }
 function playMusic(track,button){
  if(!tunes[track])return;
  if(music?.button===button){stopMusic();return}
  stopMusic();
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass){message('Your device cannot preview music.',true);return}
  const ctx=new AudioContextClass();ctx.resume().catch(()=>{});
  let count=0;const tune=tunes[track];
  const note=()=>{
   if(ctx.state==='closed')return;
   const osc=ctx.createOscillator(),vol=ctx.createGain(),now=ctx.currentTime;
   osc.type='sine';osc.frequency.value=tune.base*Math.pow(2,tune.notes[count++%tune.notes.length]/12);
   vol.gain.setValueAtTime(.0001,now);
   vol.gain.exponentialRampToValueAtTime(.035,now+.022);
   vol.gain.exponentialRampToValueAtTime(.0001,now+.25);
   osc.connect(vol);vol.connect(ctx.destination);osc.start(now);osc.stop(now+.27);
  };
  note();music={ctx,timer:setInterval(note,tune.speed),button};button.textContent='♫ Stop soundtrack';
 }
 function resetMedia(clearInput=true){
  mediaFile=null;if(clearInput)input.value='';
  if(previewURL)URL.revokeObjectURL(previewURL);
  previewURL=null;$('#shorts-preview').hidden=true;$('#shorts-preview').innerHTML='';
  $('#shorts-file-name').textContent='';
 }
 const isVideo=f=>f.type.startsWith('video/')||/\.(mov|mp4|webm)$/i.test(f.name);
 async function durationOK(file){
  return new Promise(resolve=>{
   const v=document.createElement('video'),url=URL.createObjectURL(file);
   let finished=false;
   const done=ok=>{if(finished)return;finished=true;URL.revokeObjectURL(url);v.removeAttribute('src');resolve(ok)};
   v.preload='metadata';v.onloadedmetadata=()=>done(Number.isFinite(v.duration)&&v.duration>0&&v.duration<=60);
   v.onerror=()=>done(false);
   v.src=url;
  });
 }
 $('#shorts-pick-file').onclick=()=>input.click();
 $('#shorts-remove-file').onclick=()=>{resetMedia();message('')};
 input.onchange=async()=>{
  const file=input.files?.[0];
  resetMedia(false);
  if(!file)return;
  const video=isVideo(file),image=file.type.startsWith('image/')||/\.(heic|heif)$/i.test(file.name);
  if(!video&&!image){message('Please choose a picture or video.',true);return}
  if(file.size>50*1024*1024){message('Please choose a file smaller than 50 MB.',true);return}
  if(video){
   message('Checking video length…');
   if(!await durationOK(file)){message('Choose a playable video of 60 seconds or less.',true);return}
  }
  mediaFile=file;previewURL=URL.createObjectURL(file);
  const display=document.createElement(video?'video':'img');display.src=previewURL;
  if(video){display.controls=true;display.playsInline=true;display.preload='metadata'}else display.alt='Short preview';
  $('#shorts-preview').replaceChildren(display);$('#shorts-preview').hidden=false;
  $('#shorts-file-name').textContent=file.name;
  message((video?'Video':'Picture')+' selected! You can tap Post Short below.');
 };
 $('#shorts-preview-music').onclick=e=>{
  const track=$('#shorts-track').value;
  if(track==='none'){stopMusic();message('Choose a soundtrack to preview first.');return}
  playMusic(track,e.currentTarget);
 };
 $('#shorts-track').onchange=stopMusic;
 form.onsubmit=async e=>{
  e.preventDefault();const me=getMe();
  if(!me){message('Please sign in first.',true);return}
  const selected=mediaFile;
  if(!selected){message('Choose a photo or video first. Wait until the preview appears before posting.',true);return}
  const video=isVideo(selected),mediaType=video?'video':'image';
  let ext=(selected.name.split('.').pop()||'').replace(/[^a-z0-9]/gi,'').toLowerCase();
  if(!ext||ext.length>6)ext=video?'mp4':'jpg';
  const mime=selected.type||(video?'video/mp4':ext==='heic'?'image/heic':ext==='heif'?'image/heif':'image/jpeg');
  const path=me.id+'/short-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'.'+ext;
  const button=$('#shorts-submit');button.disabled=true;button.textContent='Uploading…';
  message('Privately uploading your Short… Please keep Stafford Sisters open.');
  try{
   const uploaded=await supabase.storage.from('shorts-media').upload(path,selected,{contentType:mime,upsert:false});
   if(uploaded.error)throw uploaded.error;
   const {error}=await supabase.from('shorts').insert({
    user_id:me.id,caption:$('#shorts-caption').value.trim(),
    media_path:path,media_type:mediaType,music_track:$('#shorts-track').value
   });
   if(error){await supabase.storage.from('shorts-media').remove([path]);throw error}
   pushDispatch();stopMusic();form.reset();resetMedia();message('Your Short is posted! 🎬💕');
   await load();
  }catch(err){
   console.error('Short upload failed',err);
   const detail=String(err?.message||'').trim();
   const lower=detail.toLowerCase();
   let help='Upload failed. Please try once more.';
   if(/expired|jwt|unauthorized|token/.test(lower))help='Your sign-in may have expired. Sign out and back in, then retry.';
   else if(/bucket not found|relation .* does not exist|schema cache|does not exist/.test(lower))help='Shorts database or storage setup is missing. Ask Mama to rerun the Shorts setup in Supabase.';
   else if(/row.level security|policy|permission|forbidden|403/.test(lower))help='The Shorts storage permissions are blocking the upload. Ask Mama to check the Shorts Supabase setup.';
   else if(/mime|content.type|not allowed|unsupported/.test(lower))help='This file type is not allowed. Try a JPG photo or MP4 video.';
   else if(/size|large|413|maximum/.test(lower))help='This file is too large. Please try a smaller photo or video.';
   message(help+(detail?' ('+detail.slice(0,160)+')':''),true);
  }finally{button.disabled=false;button.textContent='🎬 Post Short'}
 };
 async function load(){
  if(!getMe()||busy)return;
  busy=true;$('#shorts-loading').hidden=false;
  try{
   const {data,error}=await supabase.from('shorts').select(
    'id,user_id,caption,media_path,media_type,music_track,created_at,shorts_reactions(id,user_id,reaction),shorts_comments(id,user_id,body,created_at)'
   ).order('created_at',{ascending:false}).limit(100);
   if(error)throw error;
   items=await Promise.all((data||[]).map(async p=>({
    ...p,media_url:await signedUrl('shorts-media',p.media_path),
    shorts_comments:(p.shorts_comments||[]).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))
   })));
   render();
  }catch(err){
   console.error('Shorts unavailable',err);
   feed.innerHTML='<div class="empty-card"><strong>Shorts needs its database setup.</strong><small>Ask Mama to run the Shorts setup SQL in Supabase first. Your other family posts are safe.</small></div>';
  }finally{busy=false;$('#shorts-loading').hidden=true}
 }
 function render(){
  const me=getMe();
  if(!items.length){feed.innerHTML='<div class="empty-card">🎬<strong>Ready to make your first Short?</strong><small>Share a photo or a video with your family!</small></div>';return}
  feed.innerHTML=items.map(p=>{
   const author=profileFor(p.user_id),rs=p.shorts_reactions||[],cs=p.shorts_comments||[];
   const own=rs.find(x=>x.user_id===me?.id);
   const likes=rs.filter(x=>x.reaction==='like').length,loves=rs.filter(x=>x.reaction==='heart').length;
   const media=p.media_url?(p.media_type==='video'
    ?'<video class="shorts-media" src="'+esc(p.media_url)+'" preload="metadata" playsinline controls></video>'
    :'<img class="shorts-media" src="'+esc(p.media_url)+'" loading="lazy" alt="Family Short">')
    :'<p>Media is temporarily unavailable.</p>';
   return '<article class="shorts-card" data-short="'+esc(p.id)+'">'+
    '<div class="shorts-media-wrap">'+media+'</div><div class="shorts-body">'+
    '<div class="shorts-author"><button type="button" class="profile-link" data-short-profile="'+esc(p.user_id)+'">'+avatarMarkup(author)+'</button>'+
    '<button type="button" class="profile-name-link" data-short-profile="'+esc(p.user_id)+'">'+esc(author.display_name)+'</button>'+
    '<small>'+esc(ago(p.created_at))+'</small>'+
    (p.user_id===me?.id?'<button type="button" class="shorts-delete" data-short-delete="'+esc(p.id)+'" title="Delete your Short">🗑️</button>':'')+'</div>'+
    (p.caption?'<p class="shorts-caption">'+esc(p.caption)+'</p>':'')+
    (tunes[p.music_track]?'<button type="button" class="short-music-play" data-track="'+esc(p.music_track)+'">♫ Play soundtrack</button>':'')+
    '<div class="shorts-reactions">'+
    '<button type="button" data-short-react="like" class="'+(own?.reaction==='like'?'selected':'')+'">👍 '+likes+'</button>'+
    '<button type="button" data-short-react="heart" class="'+(own?.reaction==='heart'?'selected':'')+'">❤️ '+loves+'</button>'+
    '<span>💬 '+cs.length+'</span></div>'+
    '<div class="shorts-comments">'+cs.map(c=>'<div class="shorts-comment"><strong>'+esc(profileFor(c.user_id).display_name)+'</strong> '+esc(c.body)+'</div>').join('')+'</div>'+
    '<form class="shorts-comment-form"><input maxlength="1000" aria-label="Short comment" placeholder="Write a kind comment…" required><button type="submit">Post</button></form>'+
    '</div></article>';
  }).join('');
 }
 feed.onclick=async e=>{
  const profile=e.target.closest('[data-short-profile]');
  if(profile){stopMusic();openProfile(profile.dataset.shortProfile);return}
  const sound=e.target.closest('.short-music-play');
  if(sound){playMusic(sound.dataset.track,sound);return}
  const card=e.target.closest('[data-short]'),me=getMe();
  if(!card||!me)return;
  const id=card.dataset.short,short=items.find(x=>x.id===id);
  const btn=e.target.closest('[data-short-react]');
  if(btn){
   const value=btn.dataset.shortReact,existing=short?.shorts_reactions?.find(x=>x.user_id===me.id);
   let result;
   if(existing?.reaction===value)result=await supabase.from('shorts_reactions').delete().eq('id',existing.id).eq('user_id',me.id);
   else if(existing)result=await supabase.from('shorts_reactions').update({reaction:value}).eq('id',existing.id).eq('user_id',me.id);
   else result=await supabase.from('shorts_reactions').insert({short_id:id,user_id:me.id,reaction:value});
   if(result.error){alert('Could not save your reaction. Please try again.');return}
   pushDispatch();await load();return;
  }
  if(e.target.closest('[data-short-delete]')){
   if(short?.user_id!==me.id||!confirm('Delete your Short? This cannot be undone.'))return;
   const {data,error}=await supabase.from('shorts').delete().eq('id',id).eq('user_id',me.id).select('id');
   if(error||!data?.length){alert('Could not delete this Short.');return}
   await supabase.storage.from('shorts-media').remove([short.media_path]);
   stopMusic();await load();
  }
 };
 feed.onsubmit=async e=>{
  const form=e.target.closest('.shorts-comment-form');
  if(!form)return;
  e.preventDefault();
  const card=form.closest('[data-short]'),me=getMe(),field=form.querySelector('input');
  if(!me||!card||!field.value.trim())return;
  const button=form.querySelector('button');button.disabled=true;
  const {error}=await supabase.from('shorts_comments').insert({short_id:card.dataset.short,user_id:me.id,body:field.value.trim()});
  button.disabled=false;
  if(error){alert('Could not post comment. Please try again.');return}
  field.value='';pushDispatch();await load();
 };
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMusic()});
 return {load,stopMusic};
}
