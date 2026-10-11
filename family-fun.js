// Stafford Sisters: a playable family games corner + an on-device TV watchlist.
// No new database migrations or private app secrets are needed.
export function initFamilyFun({getMe}){
 const $=s=>document.querySelector(s);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const WATCH_KEY='stafford-sisters-tv-watchlist-v1';
 // These are public videos uploaded by their original rightsholders, not copies
 // or redistributed TV/movie files. Only curated URLs can be embedded.
 const freeVideos=[
  {id:'aqz-KE-bpKQ',title:'Big Buck Bunny',kind:'movie',badge:'Animated short movie · 10 min',by:'Blender Foundation',note:'A funny forest adventure starring a giant bunny 🐰',emoji:'🐰'},
  {id:'5XpyVz5Bb7c',title:'Wild Kratts: Outfoxed',kind:'show',badge:'Full TV episode',by:'PBS KIDS',note:'Discover the clever, athletic red fox 🦊',emoji:'🦊'},
  {id:'Rx944HSeTH4',title:'Odd Squad: O Games',kind:'show',badge:'Full TV episode',by:'PBS KIDS',note:'An Olympic-style contest at Odd Squad 🏆',emoji:'🏆'},
  {id:'FiB6puNl8LQ',title:'Odd Squad: Welcome to Odd Squad',kind:'show',badge:'Full TV episode',by:'PBS KIDS',note:'A strange adventure for new agents 🕵️',emoji:'🕵️'},
  {id:'wr6kgCJim9k',title:'Molly of Denali: Mother’s Day Mission',kind:'show',badge:'Full TV episode',by:'PBS KIDS',note:'A surprise, an adventure, and a talking bird 🦜',emoji:'🌷'},
  {id:'DigGOlWCZnM',title:'Molly of Denali: Truth, Trust, and Harvest',kind:'show',badge:'Full TV episode',by:'PBS KIDS',note:'Friends help make a community garden 🪴',emoji:'🌿'},
  {id:'QVRI1quOPXs',title:'Wild Kratts: No Color, No Fun',kind:'show',badge:'Official TV clip',by:'PBS KIDS',note:'Creature power and a very strange color problem 🎨',emoji:'🎨'}
 ];
 let videoFilter='all',playingVideo=null;
 const suggestions=[
  {title:'Alexa & Katie',type:'show',emoji:'🎭',note:'A funny, heartfelt friendship series'},
  {title:'Erin & Aaron',type:'show',emoji:'🎤',note:'Music, family and a little friendly competition'},
  {title:'The Great British Baking Show',type:'show',emoji:'🧁',note:'Cozy baking inspiration'},
  {title:'Paddington 2',type:'movie',emoji:'🐻',note:'A sweet, funny family movie'},
  {title:'The Muppet Movie',type:'movie',emoji:'🎶',note:'Silly songs and a classic adventure'},
  {title:'Bluey',type:'show',emoji:'🐶',note:'Short episodes for everyone to enjoy'}
 ];
 const quizzes={
  mixed:[
   {q:'Which planet is known as the Red Planet?',a:['Venus','Mars','Jupiter','Mercury'],correct:1,why:'Iron-rich dust gives Mars its reddish color.'},
   {q:'How many sides does a hexagon have?',a:['Five','Six','Seven','Eight'],correct:1,why:'Hexa- means six!'},
   {q:'What is the largest ocean on Earth?',a:['Atlantic','Indian','Arctic','Pacific'],correct:3,why:'The Pacific Ocean is the largest.'},
   {q:'What do bees collect from flowers to make honey?',a:['Nectar','Sand','Leaves','Salt'],correct:0,why:'Honeybees turn nectar into honey.'},
   {q:'What is the name of a baby frog?',a:['Calf','Cub','Tadpole','Chick'],correct:2,why:'A tadpole grows into an adult frog.'},
   {q:'Which instrument has black and white keys?',a:['Flute','Piano','Drum','Trumpet'],correct:1,why:'Pianos have both black and white keys.'},
   {q:'What color is made by mixing blue and yellow paint?',a:['Orange','Purple','Green','Pink'],correct:2,why:'Blue and yellow make green.'},
   {q:'What is the capital city of Georgia (USA)?',a:['Savannah','Athens','Atlanta','Augusta'],correct:2,why:'Atlanta is Georgia’s capital.'}
  ],
  movies:[
   {q:'In Finding Nemo, what kind of fish is Nemo?',a:['Clownfish','Goldfish','Tuna','Shark'],correct:0,why:'Nemo and his dad Marlin are clownfish.'},
   {q:'Which animated film has a snowman named Olaf?',a:['Moana','Frozen','Tangled','Encanto'],correct:1,why:'Olaf loves warm hugs in Frozen.'},
   {q:'Who carries a suitcase in Paddington?',a:['A bear','A penguin','A fox','A rabbit'],correct:0,why:'Paddington is a very polite bear.'},
   {q:'In The Lion King, what animal is Simba?',a:['Tiger','Wolf','Lion','Bear'],correct:2,why:'Simba is a young lion.'},
   {q:'Which movie features a family with magical gifts and a house called Casita?',a:['Brave','Encanto','Up','Cars'],correct:1,why:'The Madrigal family lives in Casita.'},
   {q:'What type of animal is Kermit?',a:['Frog','Dog','Cat','Duck'],correct:0,why:'Kermit the Frog is a Muppet.'},
   {q:'In Toy Story, what kind of toy is Woody?',a:['Robot','Cowboy doll','Race car','Dinosaur'],correct:1,why:'Woody is a pull-string cowboy doll.'},
   {q:'Which movie includes the song “You’re Welcome”?',a:['Moana','Frozen','Coco','Shrek'],correct:0,why:'Maui sings it in Moana.'}
  ],
  history:[
   {q:'In what year was the Declaration of Independence adopted?',a:['1492','1776','1812','1865'],correct:1,why:'It was adopted on July 4, 1776.'},
   {q:'Who was the first U.S. president?',a:['Thomas Jefferson','George Washington','Abraham Lincoln','Benjamin Franklin'],correct:1,why:'George Washington became president in 1789.'},
   {q:'Which country was on the other side of the American Revolutionary War?',a:['Spain','Italy','Great Britain','Canada'],correct:2,why:'The colonies fought Great Britain for independence.'},
   {q:'What was the famous December 1773 protest involving tea?',a:['The Boston Tea Party','The Gold Rush','The Boston Marathon','The Louisiana Purchase'],correct:0,why:'Protesters dumped tea into Boston Harbor.'},
   {q:'Who wrote the main draft of the Declaration of Independence?',a:['George Washington','Paul Revere','Thomas Jefferson','John Adams'],correct:2,why:'Thomas Jefferson wrote the primary draft.'},
   {q:'What was the name of the 13 colonies’ fighting force?',a:['Continental Army','Union Army','Royal Navy','Space Force'],correct:0,why:'The Continental Army fought for the colonies.'},
   {q:'Which Frenchman helped the Continental Army?',a:['Napoleon','Lafayette','Louis XIV','Descartes'],correct:1,why:'The Marquis de Lafayette helped the American cause.'},
   {q:'What ended the Revolutionary War in 1783?',a:['Treaty of Paris','Magna Carta','Gettysburg Address','Mayflower Compact'],correct:0,why:'The Treaty of Paris recognized U.S. independence.'}
  ]
 };
 const either=[
  ['Movie night 🍿','Game night 🎲'],['Beach day 🏖️','Mountain trip 🏔️'],
  ['Bake cookies 🍪','Make cupcakes 🧁'],['Sing a duet 🎤','Dance together 💃'],
  ['Have a pet dragon 🐉','Have a pet unicorn 🦄'],['Read a book 📚','Watch a show 📺'],
  ['Build a fort 🏰','Have a picnic 🧺'],['Go to a concert 🎵','Go to a theme park 🎢']
 ];
 let tvItems=readItems(),tvFilter='all',questionIndex=0,score=0,category='mixed',answered=false,choices=[],eitherIndex=0;
 function readItems(){
  try{
   const data=JSON.parse(localStorage.getItem(WATCH_KEY)||'[]');
   return Array.isArray(data)?data.filter(x=>x&&typeof x.title==='string'&&['movie','show'].includes(x.type)).slice(0,100):[];
  }catch{return []}
 }
 function saveItems(){
  try{localStorage.setItem(WATCH_KEY,JSON.stringify(tvItems));return true}
  catch{return false}
 }
 function tvStatus(msg,problem=false){
  const el=$('#tv-status');el.hidden=!msg;el.textContent=msg;el.classList.toggle('fun-error',problem);
 }
 function addItem(title,type){
  title=String(title||'').trim().slice(0,90);
  if(!title)return tvStatus('Type a show or movie title first.',true);
  if(tvItems.some(x=>x.title.toLowerCase()===title.toLowerCase()))return tvStatus('That one is already on this device’s list.');
  if(tvItems.length>=100)return tvStatus('Your list is full. Remove an item to add another.',true);
  tvItems.unshift({id:Date.now()+'-'+Math.random().toString(36).slice(2,7),title,type,watched:false});
  const ok=saveItems();tvStatus(ok?'Added to your watchlist! 💕':'Added for now, but this device could not save it.',!ok);
  renderTV();
 }
 function renderTV(){
  const root=$('#tv-watchlist'),count=$('#tv-watch-count');
  if(!root||!count)return;
  count.textContent=tvItems.filter(x=>!x.watched).length+' to watch · '+tvItems.filter(x=>x.watched).length+' watched';
  const view=tvItems.filter(x=>tvFilter==='all'||(tvFilter==='todo'?!x.watched:x.watched));
  root.innerHTML=view.length?view.map(x=>'<div class="fun-watch-item" data-watch-id="'+esc(x.id)+'">'+
   '<span class="fun-watch-icon">'+(x.type==='movie'?'🎬':'📺')+'</span>'+
   '<div class="fun-watch-info"><strong>'+esc(x.title)+'</strong><small>'+esc(x.type==='movie'?'Movie':'TV show')+' · '+(x.watched?'Watched ✅':'Want to watch 🍿')+'</small></div>'+
   '<button type="button" data-watch-toggle="'+esc(x.id)+'" aria-label="'+(x.watched?'Mark unwatched':'Mark watched')+'">'+(x.watched?'↩':'✓')+'</button>'+
   '<button type="button" data-watch-remove="'+esc(x.id)+'" aria-label="Remove '+esc(x.title)+'">×</button></div>').join(''):
   '<div class="fun-empty">'+(tvFilter==='all'?'Your list is waiting! Add something above or try a recommendation.':'Nothing in this section yet!')+'</div>';
  $$('#tv-filter-buttons button').forEach(b=>{b.classList.toggle('active',b.dataset.filter===tvFilter);b.setAttribute('aria-pressed',String(b.dataset.filter===tvFilter))});
 }
 function $$ (selector){return [...document.querySelectorAll(selector)]}
 const tvForm=$('#tv-add-form');
 tvForm.onsubmit=e=>{
  e.preventDefault();addItem($('#tv-add-title').value,$('#tv-add-type').value);
  $('#tv-add-title').value='';
 };
 $('#tv-suggestions').innerHTML=suggestions.map(s=>'<div class="fun-suggestion">'+
  '<div class="fun-suggestion-icon">'+s.emoji+'</div><strong>'+esc(s.title)+'</strong>'+
  '<small>'+esc(s.note)+'</small><button type="button" data-suggest="'+esc(s.title)+'">＋ Watchlist</button></div>').join('');
 $('#tv-suggestions').onclick=e=>{
  const b=e.target.closest('[data-suggest]');if(!b)return;
  const pick=suggestions.find(s=>s.title===b.dataset.suggest);
  if(pick)addItem(pick.title,pick.type);
 };
 $('#tv-filter-buttons').onclick=e=>{
  const b=e.target.closest('[data-filter]');if(!b)return;
  tvFilter=b.dataset.filter;renderTV();
 };
 $('#tv-watchlist').onclick=e=>{
  const b=e.target.closest('[data-watch-toggle],[data-watch-remove]');if(!b)return;
  const id=b.dataset.watchToggle||b.dataset.watchRemove,x=tvItems.find(x=>x.id===id);
  if(!x)return;
  if(b.hasAttribute('data-watch-toggle')){x.watched=!x.watched;tvStatus(x.watched?'Marked as watched! ✅':'Back on your watchlist!')}
  else{tvItems=tvItems.filter(t=>t.id!==id);tvStatus('Removed from this device’s list.')}
  saveItems();renderTV();
 };
 $('#tv-pick-tonight').onclick=()=>{
  const pool=tvItems.filter(x=>!x.watched);
  const result=$('#tv-picked');
  if(!pool.length){result.textContent='Add a show or movie to your watchlist first! 🍿';return}
  const x=pool[Math.floor(Math.random()*pool.length)];
  result.textContent='🍿 Tonight’s pick: '+x.title+'!';
 };

 function renderFreeVideos(){
  const library=$('#tv-video-library');
  if(!library)return;
  const selection=freeVideos.filter(x=>videoFilter==='all'||x.kind===videoFilter);
  library.innerHTML=selection.map(video=>{
   const thumb='https://i.ytimg.com/vi/'+video.id+'/hqdefault.jpg';
   return '<article class="fun-video-card" data-video-id="'+esc(video.id)+'">'+
    '<button class="fun-video-poster" type="button" data-watch-video="'+esc(video.id)+'" aria-label="Watch '+esc(video.title)+' inside Stafford Sisters">'+
     '<img alt="" loading="lazy" src="'+thumb+'">'+
     '<span class="fun-video-play" aria-hidden="true">▶</span>'+
     '<span class="fun-video-badge">'+esc(video.badge)+'</span></button>'+
    '<div class="fun-video-card-info"><small>'+esc(video.by)+'</small>'+
     '<h4>'+esc(video.title)+'</h4><p>'+esc(video.note)+'</p>'+
     '<div class="fun-video-card-actions">'+
      '<button class="fun-primary" type="button" data-watch-video="'+esc(video.id)+'">▶ Watch now</button>'+
      '<button class="fun-button" type="button" data-save-video="'+esc(video.id)+'">＋ List</button>'+
     '</div></div></article>';
  }).join('');
  $('#tv-video-filter button').forEach(b=>{
   b.classList.toggle('active',b.dataset.videoFilter===videoFilter);
   b.setAttribute('aria-pressed',String(b.dataset.videoFilter===videoFilter));
  });
 }
 const player=$('#tv-player-modal'),videoFrame=$('#tv-player-frame');
 function openPlayer(video){
  if(!video)return;
  closePlayer();
  playingVideo=video;
  $('#tv-player-title').textContent=video.title;
  $('#tv-player-caption').textContent=video.badge+' · '+video.by+' — '+video.note;
  $('#tv-player-source').href='https://www.youtube.com/watch?v='+video.id;
  $('#tv-player-save').textContent=tvItems.some(x=>x.title===video.title)?'✓ On your watchlist':'♡ Save to watchlist';
  player.hidden=false;
  const frame=document.createElement('iframe');
  frame.title='Watch '+video.title;
  frame.loading='eager';
  frame.src='https://www.youtube-nocookie.com/embed/'+video.id+'?playsinline=1&rel=0';
  frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
  frame.allowFullscreen=true;
  frame.referrerPolicy='strict-origin-when-cross-origin';
  videoFrame.replaceChildren(frame);
  player.querySelector('#tv-player-close').focus();
  document.body.classList.add('fun-video-open');
 }
 function closePlayer(){
  if(player)player.hidden=true;
  if(videoFrame)videoFrame.replaceChildren();
  document.body.classList.remove('fun-video-open');
  playingVideo=null;
 }
 $('#tv-video-filter').onclick=e=>{
  const b=e.target.closest('[data-video-filter]');
  if(!b)return;
  videoFilter=b.dataset.videoFilter;
  renderFreeVideos();
 };
 $('#tv-video-library').onclick=e=>{
  const b=e.target.closest('[data-watch-video],[data-save-video]');
  if(!b)return;
  const id=b.dataset.watchVideo||b.dataset.saveVideo;
  const video=freeVideos.find(v=>v.id===id);
  if(!video)return;
  if(b.hasAttribute('data-save-video'))addItem(video.title,video.kind==='movie'?'movie':'show');
  else openPlayer(video);
 };
 $('#tv-player-close').onclick=closePlayer;
 player.addEventListener('click',e=>{if(e.target===player)closePlayer()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!player.hidden)closePlayer()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)closePlayer()});
 $('#tv-player-save').onclick=()=>{
  if(!playingVideo)return;
  addItem(playingVideo.title,playingVideo.kind==='movie'?'movie':'show');
  $('#tv-player-save').textContent='✓ On your watchlist';
 };

 const gameStart=$('#games-start'),gamePlay=$('#games-play'),gameResult=$('#games-result');
 function startQuiz(which){
  category=which;questionIndex=0;score=0;answered=false;
  gameStart.hidden=true;gameResult.hidden=true;gamePlay.hidden=false;
  renderQuestion();
 }
 function renderQuestion(){
  const q=quizzes[category][questionIndex];
  answered=false;
  $('#games-progress').textContent='Question '+(questionIndex+1)+' of '+quizzes[category].length;
  $('#games-score').textContent=score+' points';
  $('#games-question').textContent=q.q;
  $('#games-answer-feedback').textContent='';
  $('#games-next').hidden=true;
  $('#games-answers').innerHTML=q.a.map((v,i)=>'<button type="button" data-answer="'+i+'">'+esc(v)+'</button>').join('');
 }
 $('#games-start').onclick=e=>{
  const b=e.target.closest('[data-quiz]');if(b)startQuiz(b.dataset.quiz);
 };
 $('#games-answers').onclick=e=>{
  const b=e.target.closest('[data-answer]');if(!b||answered)return;
  answered=true;
  const q=quizzes[category][questionIndex],selected=Number(b.dataset.answer);
  if(selected===q.correct){score+=10;$('#games-answer-feedback').textContent='✅ Correct! '+q.why}
  else $('#games-answer-feedback').textContent='💕 Nice try! '+q.why;
  $('#games-score').textContent=score+' points';
  $$('#games-answers button').forEach((button,i)=>{
   button.disabled=true;
   if(i===q.correct)button.classList.add('correct');
   else if(i===selected)button.classList.add('incorrect');
  });
  $('#games-next').hidden=false;
 };
 $('#games-next').onclick=()=>{
  questionIndex++;
  if(questionIndex<quizzes[category].length){renderQuestion();return}
  gamePlay.hidden=true;gameResult.hidden=false;
  $('#games-final-score').textContent=score+' / '+(quizzes[category].length*10);
  $('#games-final-message').textContent=score===80?'Perfect score! 🏆':score>=50?'You did great! 🎉':'Want another round? 💜';
 };
 function homeGames(){gamePlay.hidden=true;gameResult.hidden=true;gameStart.hidden=false}
 $('#games-home').onclick=homeGames;
 $('#games-again').onclick=homeGames;
 function renderEither(){
  const pair=either[eitherIndex];
  $('#games-either-count').textContent='Pick '+(eitherIndex+1)+' of '+either.length;
  $('#games-either-a').textContent=pair[0];
  $('#games-either-b').textContent=pair[1];
  $('#games-either-message').textContent='Which one would you choose?';
 }
 function chooseEither(index){
  choices.push(either[eitherIndex][index]);
  eitherIndex=(eitherIndex+1)%either.length;
  if(eitherIndex===0){
   $('#games-either-message').textContent='You finished! 🎉 Play another round!';
   choices=[];
  }else renderEither();
 }
 $('#games-either-a').onclick=()=>chooseEither(0);
 $('#games-either-b').onclick=()=>chooseEither(1);
 $('#games-either-restart').onclick=()=>{eitherIndex=0;choices=[];renderEither()};
 renderEither();renderTV();renderFreeVideos();
 return {showTV:()=>{renderTV();renderFreeVideos()},showGames:()=>{},closePlayer};
}
