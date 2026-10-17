// Stafford Sisters Shorts: private full-screen, swipe-up family videos and photo galleries.
import {SHORTS_TRACKS,createShortsMusicPlayer} from './shorts-music.js';
export function initShorts({supabase,getMe,profileFor,avatarMarkup,esc,ago,openProfile,pushDispatch=()=>{}}){
 const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
 const feed=$('#shorts-feed'),form=$('#shorts-form'),input=$('#shorts-file'),status=$('#shorts-status');
 const details=$('#shorts-create-details'),modal=$('#shorts-comments-modal');
 let selectedFiles=[],previewUrls=[],items=[],busy=false,observer=null,activeId=null;
 const sound=createShortsMusicPlayer({onStop:()=>restoreMusicLabels()});
 const isVideo=f=>/^video\//.test(f.type)||/\.(mov|mp4|webm)$/i.test(f.name);
 const supported=f=>/^(image\/(jpeg|png|webp|heic|heif)|video\/(mp4|quicktime|webm))$/.test(f.type)||/\.(jpg|jpeg|png|webp|heic|heif|mp4|mov|webm)$/i.test(f.name);
 function showStatus(message,isError=false){
  status.textContent=message;status.hidden=!message;
  status.style.color=isError?'#a12c51':'#426447';
 }
 async function api(method,payload,endpoint='/api/shorts'){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)throw Error('Please sign in to Stafford Sisters again.');
  let response;
  try{
   response=await fetch(endpoint,{
    method,cache:'no-store',
    headers:{Authorization:'Bearer '+session.access_token,...(method==='POST'?{'Content-Type':'application/json'}:{})},
    ...(method==='POST'?{body:JSON.stringify(payload)}:{})
   });
  }catch{throw Error('Could not reach Stafford Sisters. Check your connection and try again.')}
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||('Shorts request failed ('+response.status+').'));
  return data;
 }
 function resetMedia(){
  selectedFiles=[];input.value='';
  for(const url of previewUrls)URL.revokeObjectURL(url);
  previewUrls=[];$('#shorts-preview').replaceChildren();$('#shorts-preview').hidden=true;
  $('#shorts-file-name').textContent='';
 }
 async function videoDurationOK(file){
  return await new Promise(resolve=>{
   const v=document.createElement('video'),url=URL.createObjectURL(file);
   let finished=false;
   const finish=ok=>{
    if(finished)return;finished=true;clearTimeout(timeout);
    v.removeAttribute('src');v.load();URL.revokeObjectURL(url);
    resolve(ok);
   };
   const timeout=setTimeout(()=>finish(false),12000);
   v.preload='metadata';v.onloadedmetadata=()=>finish(Number.isFinite(v.duration)&&v.duration>0&&v.duration<=60);
   v.onerror=()=>finish(false);v.src=url;
  });
 }
 $('#shorts-create-open').onclick=()=>{details.open=true};
 $('#shorts-pick-file').onclick=()=>input.click();
 $('#shorts-remove-file').onclick=()=>{resetMedia();showStatus('')};
 input.onchange=async()=>{
  const files=[...input.files];resetMedia();
  if(!files.length)return;
  if(files.length>6){showStatus('Choose up to six pictures, or one short video.',true);return}
  if(files.some(f=>!supported(f))){showStatus('Please choose JPG, PNG, WebP, HEIC, MP4, MOV, or WebM files.',true);return}
  if(files.some(isVideo)&&(files.length!==1||!isVideo(files[0]))){
   showStatus('Choose a single video or up to six pictures, not a mix.',true);return;
  }
  const total=files.reduce((sum,f)=>sum+f.size,0);
  if(!total||total>50*1024*1024){showStatus('Please keep your whole Short under 50 MB.',true);return}
  if(isVideo(files[0])){
   showStatus('Checking that your video is 60 seconds or less…');
   if(!(await videoDurationOK(files[0]))){showStatus('Please choose a playable video of 60 seconds or less.',true);return}
  }
  selectedFiles=files;
  const preview=$('#shorts-preview');
  preview.hidden=false;
  for(const [idx,file] of files.entries()){
   const url=URL.createObjectURL(file);previewUrls.push(url);
   const wrap=document.createElement('div');wrap.className='shorts-preview-tile';
   const element=document.createElement(isVideo(file)?'video':'img');
   element.src=url;
   if(isVideo(file)){element.controls=true;element.playsInline=true;element.preload='metadata';}
   else element.alt='Selected photo '+(idx+1);
   wrap.appendChild(element);
   if(files.length>1){const count=document.createElement('span');count.textContent=String(idx+1);wrap.appendChild(count)}
   preview.appendChild(wrap);
  }
  $('#shorts-file-name').textContent=files.length===1?files[0].name:files.length+' pictures selected';
  showStatus(files.length===1?'Ready to post! 💕':'Your photo slideshow is ready! 💕');
 };
 function restoreMusicLabels(){
  $$('.shorts-music-toggle,#shorts-preview-music').forEach(b=>{
   if(b.id==='shorts-preview-music')b.textContent='▶ Preview soundtrack';
   else{
    const tune=SHORTS_TRACKS[b.dataset.track];
    b.textContent='▶ '+(tune?.emoji||'♫')+' '+(tune?.name||'Music');
   }
  });
 }
 function stopMusic(){sound.stop();restoreMusicLabels()}
 async function playMusic(track,button){
  if(!SHORTS_TRACKS[track]||track==='none')return;
  if(sound.isPlaying(track)){stopMusic();return}
  try{
   await sound.start(track);
   if(sound.isPlaying(track)){
    restoreMusicLabels();
    button.textContent='❚❚ Pause '+SHORTS_TRACKS[track].name;
   }
  }catch(err){
   stopMusic();
   showToast(err?.message||'Music could not start. Turn up your volume and try again.');
  }
 }
 $('#shorts-preview-music').onclick=e=>{
  const track=$('#shorts-track').value;
  if(track==='none'){showStatus('Choose a soundtrack first.');return}
  playMusic(track,e.currentTarget);
 };
 $('#shorts-track').onchange=stopMusic;
 details.addEventListener('toggle',()=>{if(!details.open){stopMusic();resetMedia();form.reset();showStatus('')}});
 form.onsubmit=async e=>{
  e.preventDefault();
  if(!getMe()){showStatus('Please sign in again.',true);return}
  if(!selectedFiles.length){showStatus('Add a picture or short video first.',true);return}
  const button=$('#shorts-submit'),files=[...selectedFiles],mediaType=isVideo(files[0])?'video':'image';
  button.disabled=true;button.textContent='Posting…';
  try{
   showStatus('Preparing your private Short…');
   const result=await api('POST',{action:'prepare',files:files.map(f=>({name:f.name,size:f.size,type:f.type}))});
   if(!result.uploads||result.uploads.length!==files.length)throw Error('The upload was not prepared. Try again.');
   const paths=[];
   for(const [i,file] of files.entries()){
    showStatus('Uploading '+(i+1)+' of '+files.length+'… Please keep the app open.');
    const info=result.uploads[i];
    const extension=file.name.split('.').pop().toLowerCase();
    const defaultTypes={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',heif:'image/heif',mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm'};
    const upload=await supabase.storage.from('shorts-media')
     .uploadToSignedUrl(info.path,info.token,file,{contentType:file.type&&file.type!=='application/octet-stream'?file.type:defaultTypes[extension]});
    if(upload.error)throw Error('Could not upload picture/video '+(i+1)+': '+upload.error.message);
    paths.push(info.path);
   }
   const chosenTrack=$('#shorts-track').value;
   // Uploads are private. When a video has a soundtrack, replace that upload
   // with a real MP4 whose audio is mixed into the file before publishing it.
   if(mediaType==='video'&&chosenTrack!=='none'){
    stopMusic();
    showStatus('🎵 Adding music into your video… This can take up to a minute. Please keep the app open!');
    const mixed=await api('POST',{path:paths[0],track:chosenTrack},'/api/shorts-remix');
    if(!mixed?.embedded||!mixed.path||!/-mix\.mp4$/i.test(mixed.path)){
     throw Error('Could not attach the music to your video. Your Short was not posted. Try again.');
    }
    paths[0]=mixed.path;
   }
   showStatus('Saving your Short…');
   await api('POST',{
    action:'create',paths,mediaType,
    caption:$('#shorts-caption').value.trim(),track:$('#shorts-track').value
   });
   pushDispatch();
   stopMusic();details.open=false;resetMedia();form.reset();
   showStatus('');await load({top:true});
  }catch(err){showStatus(err?.message||'Could not post your Short. Please retry.',true)}
  finally{button.disabled=false;button.textContent='🎬 Post Short'}
 };
 function makeGallery(p){
  if(!p.media?.length)return '<p class="shorts-unavailable">This Short could not load its picture or video.</p>';
  if(p.media_type==='video'){
   return '<video class="shorts-video" src="'+esc(p.media[0].url)+'" playsinline controls preload="metadata" aria-label="Family video Short"></video>';
  }
  return '<div class="shorts-gallery" aria-label="Swipe sideways to view pictures">'+p.media.map((m,i)=>
   '<div class="shorts-photo-slide"><img src="'+esc(m.url)+'" alt="Picture '+(i+1)+' of '+p.media.length+'" loading="'+(i===0?'eager':'lazy')+'"></div>'
  ).join('')+'</div>'+
  (p.media.length>1?'<span class="shorts-photo-hint">‹ Swipe photos ›</span><span class="shorts-photo-count">1 / '+p.media.length+'</span>':'');
 }
 function render(){
  if(!items.length){
   feed.innerHTML='<div class="shorts-empty"><span>🎬</span><strong>Be the first to post a Short!</strong><p>Tap + Create at the top to share a picture or video.</p></div>';
   return;
  }
  const me=getMe();
  feed.innerHTML=items.map((p,i)=>{
   const author=profileFor(p.user_id),reactions=p.shorts_reactions||[],comments=p.shorts_comments||[];
   const mine=reactions.find(r=>r.user_id===me?.id);
   const likes=reactions.filter(r=>r.reaction==='like').length;
   const hearts=reactions.filter(r=>r.reaction==='heart').length;
   return '<article class="shorts-reel" data-short="'+esc(p.id)+'" aria-label="Short '+(i+1)+' of '+items.length+'">'+
    '<div class="shorts-reel-media">'+makeGallery(p)+'</div>'+
    '<div class="shorts-reel-shadow"></div>'+
    '<div class="shorts-overlay-bottom">'+
     '<div class="shorts-user-row"><button type="button" class="shorts-avatar" data-short-profile="'+esc(p.user_id)+'" aria-label="View '+esc(author.display_name)+' profile">'+avatarMarkup(author)+'</button>'+
      '<button type="button" class="shorts-username" data-short-profile="'+esc(p.user_id)+'">'+esc(author.display_name)+'</button>'+
      '<small>'+esc(ago(p.created_at))+'</small></div>'+
     (p.caption?'<p class="shorts-reel-caption">'+esc(p.caption)+'</p>':'')+
     (SHORTS_TRACKS[p.music_track]&&p.music_track!=='none'?
       (p.media_type==='video'&&p.media?.[0]?.path?.endsWith('-mix.mp4')?
        '<span class="shorts-music-embedded" aria-label="Soundtrack permanently included in video">🎵 '+esc(SHORTS_TRACKS[p.music_track].name)+' · in video</span>':
        '<button type="button" class="shorts-music-toggle" data-track="'+esc(p.music_track)+'" aria-label="Play '+esc(SHORTS_TRACKS[p.music_track].name)+' soundtrack">▶ '+esc(SHORTS_TRACKS[p.music_track].emoji)+' '+esc(SHORTS_TRACKS[p.music_track].name)+'</button>'
       ):'')+
    '</div>'+
    '<div class="shorts-overlay-side">'+
     '<button type="button" class="shorts-side-button'+(mine?.reaction==='like'?' is-selected':'')+'" data-short-react="like" aria-label="Like Short"><span>👍</span><small>'+likes+'</small></button>'+
     '<button type="button" class="shorts-side-button'+(mine?.reaction==='heart'?' is-selected':'')+'" data-short-react="heart" aria-label="Love Short"><span>❤️</span><small>'+hearts+'</small></button>'+
     '<button type="button" class="shorts-side-button" data-short-comments aria-label="View comments"><span>💬</span><small>'+comments.length+'</small></button>'+
     '<button type="button" class="shorts-side-button" data-short-share aria-label="Share with family"><span>↗</span><small>Share</small></button>'+
     (p.user_id===me?.id?'<button type="button" class="shorts-side-button shorts-side-delete" data-short-delete aria-label="Delete your Short"><span>🗑️</span><small>Delete</small></button>':'')+
    '</div>'+
    (i===0?'<div class="shorts-up-hint">Swipe up for the next Short ↑</div>':'')+
    '</article>';
  }).join('');
  initObserver();
 }
 function initObserver(){
  observer?.disconnect();
  observer=new IntersectionObserver(entries=>{
   for(const entry of entries){
    if(!entry.isIntersecting||entry.intersectionRatio<.6)continue;
    const id=entry.target.dataset.short;
    if(activeId!==id){activeId=id;stopMusic()}
    $$('.shorts-video').forEach(video=>{
     if(!entry.target.contains(video)&&!video.paused)video.pause();
    });
   }
  },{root:feed,threshold:[.6]});
  $$('.shorts-reel').forEach(card=>observer.observe(card));
  $$('.shorts-gallery').forEach(gallery=>gallery.addEventListener('scroll',()=>{
   const count=gallery.closest('.shorts-reel').querySelector('.shorts-photo-count');
   if(count)count.textContent=(Math.round(gallery.scrollLeft/gallery.clientWidth)+1)+' / '+gallery.children.length;
  },{passive:true}));
 }
 async function load(opts={}){
  if(!getMe()||busy)return;
  busy=true;$('#shorts-loading').hidden=false;
  const oldTop=feed.scrollTop;
  try{
   const result=await api('GET');
   items=result.shorts||[];
   render();
   feed.scrollTop=opts.top?0:oldTop;
   if(opts.top)activeId=null;
   const desired=new URLSearchParams(location.search).get('short');
   if(desired){
    const card=[...$$('.shorts-reel')].find(x=>x.dataset.short===desired);
    if(card)card.scrollIntoView({block:'nearest'});
   }
  }catch(err){
   feed.innerHTML='<div class="shorts-empty"><strong>Shorts could not load yet</strong><p>'+esc(err.message||'Please try again.')+'</p><button type="button" id="shorts-retry">Try again</button></div>';
   $('#shorts-retry').onclick=()=>load();
  }finally{busy=false;$('#shorts-loading').hidden=true}
 }
 function openComments(p){
  const author=profileFor(p.user_id);
  $('#shorts-comments-title').textContent='Comments · '+author.display_name;
  $('#shorts-comments-list').innerHTML=(p.shorts_comments||[]).length?
   p.shorts_comments.map(c=>'<p class="shorts-comment"><strong>'+esc(profileFor(c.user_id).display_name)+'</strong> '+esc(c.body)+'</p>').join(''):
   '<p class="shorts-comment-empty">No comments yet! 💕</p>';
  $('#shorts-comment-form').dataset.short=p.id;
  $('#shorts-comment-input').value='';
  modal.hidden=false;$('#shorts-comment-input').focus();
 }
 function closeComments(){modal.hidden=true}
 $('#shorts-comments-close').onclick=closeComments;
 modal.addEventListener('click',e=>{if(e.target===modal)closeComments()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)closeComments()});
 $('#shorts-comment-form').onsubmit=async e=>{
  e.preventDefault();
  const id=e.currentTarget.dataset.short,field=$('#shorts-comment-input'),comment=field.value.trim(),button=$('#shorts-comment-submit');
  if(!comment)return;button.disabled=true;
  try{
   await api('POST',{action:'comment',id,comment});
   field.value='';pushDispatch();
   const current=items.find(x=>x.id===id);
   if(current){
    current.shorts_comments.push({id:'pending-'+Date.now(),user_id:getMe().id,body:comment,created_at:new Date().toISOString()});
    openComments(current);
    const count=[...$$('.shorts-reel')].find(x=>x.dataset.short===id)?.querySelector('[data-short-comments] small');
    if(count)count.textContent=current.shorts_comments.length;
   }
  }catch(err){alert(err.message||'Could not post your comment.')}
  finally{button.disabled=false}
 };
 feed.onclick=async e=>{
  const profile=e.target.closest('[data-short-profile]');
  if(profile){stopMusic();openProfile(profile.dataset.shortProfile);return}
  const play=e.target.closest('.shorts-music-toggle');
  if(play){playMusic(play.dataset.track,play);return}
  const card=e.target.closest('.shorts-reel');
  if(!card)return;
  const id=card.dataset.short,post=items.find(x=>x.id===id);
  if(!post)return;
  const button=e.target.closest('[data-short-react]');
  if(button){
   button.disabled=true;
   try{await api('POST',{action:'react',id,reaction:button.dataset.shortReact});pushDispatch();await load()}
   catch(err){alert(err.message||'Could not save your reaction.')}
   finally{button.disabled=false}
   return;
  }
  if(e.target.closest('[data-short-comments]')){stopMusic();openComments(post);return}
  if(e.target.closest('[data-short-share]')){
   const link=new URL(location.pathname,location.origin);link.searchParams.set('short',id);
   const text='See this private Stafford Sisters Short 💕';
   try{
    if(navigator.share)await navigator.share({title:'Stafford Sisters Short',text,url:link.href});
    else if(navigator.clipboard){await navigator.clipboard.writeText(link.href);showToast('Private Short link copied! 💕')}
    else showToast('Share this with your family: '+link.href);
   }catch(err){if(err.name!=='AbortError')showToast('Could not share this Short.')}
   return;
  }
  if(e.target.closest('[data-short-delete]')){
   if(!confirm('Delete this Short and all its photos/videos? This cannot be undone.'))return;
   try{await api('POST',{action:'delete',id});await load({top:true})}
   catch(err){alert(err.message||'Could not delete your Short.')}
  }
 };
 function showToast(text){
  const toast=$('#shorts-toast');
  toast.textContent=text;toast.hidden=false;
  setTimeout(()=>{toast.hidden=true},3200);
 }
 // When a video plays, turn off any separate preview so audio doesn't overlap.
 feed.addEventListener('play',e=>{
  if(!e.target.matches?.('.shorts-video'))return;
  stopMusic();
  $('.shorts-video').forEach(v=>{if(v!==e.target&&!v.paused)v.pause()});
 },true);
 $('#shorts-refresh').onclick=()=>load();
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMusic()});
 function stop(){stopMusic();$$('.shorts-video').forEach(v=>v.pause())}
 return {load,stopMusic:stop};
}
