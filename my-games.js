// Stafford Sisters: make and play your own games.
// Games are saved only in this browser on this device (no account/database changes).
export function initMyGames(){
 const root=document.getElementById('mygames');
 if(!root)return {show:()=>{}};
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const KEY='stafford-sisters-my-games-v1',MAX_GAMES=30,MAX_ITEMS=12;
 const messages=$('mygames-message'),library=$('mygames-library'),editor=$('mygames-editor'),runner=$('mygames-player');
 let games=read(),draft=null,editingId=null,active=null,index=0,score=0,answered=false;
 function read(){
  try{
   const stored=JSON.parse(localStorage.getItem(KEY)||'[]');
   return Array.isArray(stored)?stored.filter(g=>g&&typeof g.name==='string'&&['quiz','either'].includes(g.type)&&Array.isArray(g.items)).slice(0,MAX_GAMES):[];
  }catch{return []}
 }
 function store(){try{localStorage.setItem(KEY,JSON.stringify(games));return true}catch{return false}}
 function notice(message,isError=false){
  messages.textContent=message||'';
  messages.classList.toggle('fun-error',isError);
 }
 function jump(){try{root.scrollIntoView({behavior:'smooth',block:'start'})}catch{}}
 function list(){
  library.innerHTML=games.length?games.map(g=>
   '<article class="mygame-card" data-game-id="'+esc(g.id)+'">'+
   '<span class="mygame-emoji" aria-hidden="true">'+(g.type==='quiz'?'🧠':'💜')+'</span>'+
   '<div class="mygame-card-text"><strong>'+esc(g.name)+'</strong><small>'+(g.type==='quiz'?'Quiz':'This or That')+' · '+g.items.length+' '+(g.items.length===1?'round':'rounds')+'</small></div>'+
   '<div class="mygame-buttons"><button type="button" class="fun-primary" data-my-action="play">▶ Play</button>'+
   '<button type="button" class="fun-button" data-my-action="edit">✏️ Edit</button>'+
   '<button type="button" class="fun-button mygame-delete" data-my-action="delete" aria-label="Delete '+esc(g.name)+'">×</button></div></article>'
  ).join(''):'<div class="mygame-empty">Your game shelf is empty! 🎮<br>Press <strong>Make a Quiz</strong> or <strong>Make This or That</strong> to create your first game.</div>';
  $('mygames-count').textContent=games.length+' '+(games.length===1?'game':'games')+' saved';
 }
 function showShelf(){
  draft=null;editingId=null;active=null;
  editor.hidden=true;runner.hidden=true;
  $('mygames-shelf').hidden=false;
  list();jump();
 }
 function blankItem(type){return type==='quiz'?{question:'',answers:['','','',''],correct:0}:{left:'',right:''}}
 function startCreate(type){
  if(games.length>=MAX_GAMES){notice('Your shelf is full. Delete an old game to create another one.',true);return}
  draft={name:'',type,items:[blankItem(type)]};
  editingId=null;
  showEditor();
 }
 function editGame(g){
  draft={name:g.name,type:g.type,items:g.items.map(x=>g.type==='quiz'?{
   question:String(x.question||''),answers:Array.isArray(x.answers)?x.answers.slice(0,4):['','','',''],correct:Number(x.correct)||0
  }:{left:String(x.left||''),right:String(x.right||'')})};
  editingId=g.id;
  showEditor();
 }
 function showEditor(){
  $('mygames-shelf').hidden=true;runner.hidden=true;editor.hidden=false;
  $('mygames-editor-title').textContent=editingId?'✏️ Edit your game':draft.type==='quiz'?'🧠 Create a Quiz':'💜 Create This or That';
  $('mygames-name').value=draft.name;
  $('mygames-add-item').textContent=draft.type==='quiz'?'＋ Add another question':'＋ Add another round';
  notice('');renderItems();jump();
 }
 function renderItems(){
  const items=$('mygames-items');
  items.innerHTML=draft.items.map((x,i)=>{
   const header='<div class="mygame-round-header"><strong>'+(draft.type==='quiz'?'Question ':'Round ')+(i+1)+'</strong>'+
    '<button type="button" class="mygame-remove" data-remove-item="'+i+'" '+(draft.items.length===1?'disabled':'')+' aria-label="Remove '+(i+1)+'">✕ Remove</button></div>';
   if(draft.type==='either'){
    return '<div class="mygame-edit-round">'+header+
     '<label>First choice<input type="text" maxlength="100" data-game-field="left" data-i="'+i+'" placeholder="Beach day 🏖️" value="'+esc(x.left)+'"></label>'+
     '<label>Second choice<input type="text" maxlength="100" data-game-field="right" data-i="'+i+'" placeholder="Mountain trip 🏔️" value="'+esc(x.right)+'"></label></div>';
   }
   const answerFields=[0,1,2,3].map(n=>
    '<label>Answer '+('ABCD'[n])+'<input type="text" maxlength="100" data-game-field="answer" data-i="'+i+'" data-a="'+n+'" placeholder="Type an answer" value="'+esc(x.answers[n]||'')+'"></label>'
   ).join('');
   const options=[0,1,2,3].map(n=>'<option value="'+n+'" '+(Number(x.correct)===n?'selected':'')+'>Answer '+('ABCD'[n])+'</option>').join('');
   return '<div class="mygame-edit-round">'+header+
    '<label>Your question<input type="text" maxlength="180" data-game-field="question" data-i="'+i+'" placeholder="What is your question?" value="'+esc(x.question)+'"></label>'+
    '<div class="mygame-answer-grid">'+answerFields+'</div>'+
    '<label>✅ Which answer is correct?<select data-game-field="correct" data-i="'+i+'">'+options+'</select></label></div>';
  }).join('');
  $('mygames-editor-count').textContent=draft.items.length+' of '+MAX_ITEMS+(draft.type==='quiz'?' questions':' rounds');
  $('mygames-add-item').disabled=draft.items.length>=MAX_ITEMS;
 }
 function editField(t){
  if(!draft)return;
  if(t.id==='mygames-name'){draft.name=t.value.slice(0,60);return}
  const field=t.dataset.gameField,i=Number(t.dataset.i);
  if(!field||!Number.isInteger(i)||!draft.items[i])return;
  const item=draft.items[i];
  if(field==='answer')item.answers[Number(t.dataset.a)]=t.value.slice(0,100);
  else if(field==='correct')item.correct=Number(t.value);
  else if(field==='question')item.question=t.value.slice(0,180);
  else if(field==='left'||field==='right')item[field]=t.value.slice(0,100);
 }
 function validate(){
  draft.name=draft.name.trim();
  if(!draft.name){notice('Give your game a name first! 💕',true);$('mygames-name').focus();return false}
  for(let i=0;i<draft.items.length;i++){
   const x=draft.items[i];
   if(draft.type==='quiz'){
    x.question=String(x.question||'').trim();
    x.answers=x.answers.map(y=>String(y||'').trim());
    if(!x.question||x.answers.some(y=>!y)){
     notice('Fill in question '+(i+1)+' and all four answers.',true);return false
    }
   }else{
    x.left=String(x.left||'').trim();x.right=String(x.right||'').trim();
    if(!x.left||!x.right){notice('Fill in both choices for round '+(i+1)+'.',true);return false}
   }
  }
  return true;
 }
 function saveGame(){
  if(!draft||!validate())return;
  const data={id:editingId||String(Date.now())+'-'+Math.random().toString(36).slice(2,8),
   name:draft.name.slice(0,60),type:draft.type,items:draft.items};
  if(editingId){
   const i=games.findIndex(g=>g.id===editingId);
   if(i<0){notice('That game could not be found. Please try again.',true);return}
   games[i]=data;
  }else games.unshift(data);
  const ok=store();
  showShelf();
  notice(ok?'Saved! 🎉 Your game is ready to play.':'You can play for now, but this browser did not allow saving. Your game may disappear after closing.',!ok);
 }
 function playGame(g){
  active=g;index=0;score=0;answered=false;
  $('mygames-shelf').hidden=true;editor.hidden=true;runner.hidden=false;
  $('mygames-player-name').textContent=g.name;
  showRound();notice('');jump();
 }
 function showRound(){
  if(!active)return;
  answered=false;
  $('mygames-round').hidden=false;
  $('mygames-finish').hidden=true;
  $('mygames-next').hidden=true;
  $('mygames-feedback').textContent='';
  const x=active.items[index];
  $('mygames-progress').textContent='Round '+(index+1)+' of '+active.items.length;
  $('mygames-score').textContent=active.type==='quiz'?score+' points':'No wrong answers 💜';
  $('mygames-question').textContent=active.type==='quiz'?x.question:'Which would you choose?';
  const labels=active.type==='quiz'?x.answers:[x.left,x.right];
  $('mygames-choices').innerHTML=labels.map((label,n)=>'<button type="button" data-my-answer="'+n+'">'+esc(label)+'</button>').join('');
 }
 function pickAnswer(n){
  if(answered||!active||n<0)return;
  const x=active.items[index],length=active.type==='quiz'?4:2;
  if(n>=length)return;
  answered=true;
  if(active.type==='quiz'){
   const correct=Number(x.correct)===n;
   if(correct)score+=10;
   $('mygames-feedback').textContent=correct?'✅ Correct! Great job!':'Nice try! 💕 The right answer is '+x.answers[Number(x.correct)]+'.';
  }else $('mygames-feedback').textContent='You picked '+(n===0?x.left:x.right)+'! 💜';
  [...$('mygames-choices').querySelectorAll('button')].forEach((b,i)=>{
   b.disabled=true;
   if(active.type==='quiz'&&i===Number(x.correct))b.classList.add('correct');
   else if(i===n)b.classList.add(active.type==='quiz'?'incorrect':'correct');
  });
  $('mygames-score').textContent=active.type==='quiz'?score+' points':'Great choice! 💜';
  $('mygames-next').hidden=false;
  $('mygames-next').textContent=index+1===active.items.length?'See results 🎉':'Next round →';
 }
 function next(){
  if(!active||!answered)return;
  index++;
  if(index<active.items.length){showRound();return}
  $('mygames-round').hidden=true;$('mygames-finish').hidden=false;
  $('mygames-final').textContent=active.type==='quiz'?
   'You got '+score+' out of '+(active.items.length*10)+' points!':
   'You finished all '+active.items.length+' choices!';
  $('mygames-end-message').textContent=active.type==='quiz'?
   'Great playing! Want to give it another try? 💜':'You made all your picks! Play again with a friend. 💕';
 }
 $('mygames-create-quiz').onclick=()=>startCreate('quiz');
 $('mygames-create-either').onclick=()=>startCreate('either');
 $('mygames-name').addEventListener('input',e=>editField(e.target));
 $('mygames-items').addEventListener('input',e=>editField(e.target));
 $('mygames-items').addEventListener('change',e=>editField(e.target));
 $('mygames-items').onclick=e=>{
  const b=e.target.closest('[data-remove-item]');if(!b||!draft||draft.items.length<=1)return;
  draft.items.splice(Number(b.dataset.removeItem),1);renderItems();
 };
 $('mygames-add-item').onclick=()=>{
  if(!draft||draft.items.length>=MAX_ITEMS)return;
  draft.items.push(blankItem(draft.type));renderItems();
  $('mygames-items').lastElementChild?.scrollIntoView({behavior:'smooth',block:'nearest'});
 };
 $('mygames-save').onclick=saveGame;
 $('mygames-cancel').onclick=()=>{
  if(draft&&(draft.name.trim()||draft.items.some(x=>x.question||x.left||x.right||x.answers?.some(Boolean)))&&!confirm('Leave without saving your game?'))return;
  showShelf();notice('');
 };
 library.onclick=e=>{
  const b=e.target.closest('[data-my-action]');if(!b)return;
  const card=b.closest('[data-game-id]'),g=games.find(x=>x.id===card?.dataset.gameId);
  if(!g)return;
  if(b.dataset.myAction==='play')playGame(g);
  if(b.dataset.myAction==='edit')editGame(g);
  if(b.dataset.myAction==='delete'){
   if(!confirm('Delete "'+g.name+'"? You cannot undo this.'))return;
   games=games.filter(x=>x.id!==g.id);
   const ok=store();list();
   notice(ok?'Game deleted.':'Could not save the change to this device.',!ok);
  }
 };
 $('mygames-choices').onclick=e=>{
  const b=e.target.closest('[data-my-answer]');if(b)pickAnswer(Number(b.dataset.myAnswer));
 };
 $('mygames-next').onclick=next;
 $('mygames-player-back').onclick=showShelf;
 $('mygames-replay').onclick=()=>{if(active)playGame(active)};
 $('mygames-finish-back').onclick=showShelf;
 list();
 return {show:()=>{list()}};
}
