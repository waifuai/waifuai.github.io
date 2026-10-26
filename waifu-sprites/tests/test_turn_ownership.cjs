const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const tick = async () => { for (let i=0;i<20;i++) await Promise.resolve(); };
function client(embed=false, store=new Map()) {
  const timers = new Map(); let next=0;
  const ctx=vm.createContext({ window:{WaifuSpritesEmbed:embed}, navigator:{}, crypto:require('node:crypto').webcrypto,
    AbortController, TextDecoder, TextEncoder, TypeError, Sprites:{EMOTIONS:['happy'],detectEmotion:()=> 'happy'},
    Pictures:{CHAT_RULE:'Picture outcomes are app-authored',forget:()=>{}},
    setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;}, clearTimeout:id=>timers.delete(id),
    localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)} });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../context_budget.js'),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../chat.js'),'utf8')+';this.chat=Chat;',ctx);
  return {chat:ctx.chat,ctx,store,timers};
}
const json = text => ({ok:true,json:async()=>({choices:[{message:{content:text}}]})});
function stream() {
  const pending=[];let canceled=0;
  const response={ok:true,body:{getReader:()=>({read:()=>{const d=deferred();pending.push(d);return d.promise;},cancel:()=>{canceled++;},releaseLock:()=>{}})}};
  return {response, pending, get canceled(){return canceled;}, chunk(text){pending.shift().resolve({value:new TextEncoder().encode('data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\n\n'),done:false});},end(){pending.shift().resolve({value:new TextEncoder().encode('data: [DONE]\n\n'),done:false});}};
}
for (const embed of [false,true]) {
  const mode=embed?'embed':'full';
  test(mode+': ownership precedes delayed context; replacement never fetches or stores the old reply',async()=>{
    const {chat,ctx}=client(embed);const battery=deferred();let calls=0,done=0;
    chat.settings.includeBattery=true;ctx.navigator.getBattery=()=>battery.promise;ctx.fetch=()=>{calls++;return Promise.resolve(json('stale'));};
    const work=chat.send('first',{onDone:()=>done++});
    assert.equal(chat.busy,true);assert.equal(chat.messages.filter(m=>m.role==='user').length,1);
    assert.ok(chat.current.attemptId);chat.newConversation();
    await work;battery.resolve({level:.5,charging:true});await tick();
    assert.equal(calls,0);assert.equal(done,0);assert.equal(chat.messages.length,0);
  });
  test(mode+': Stop before headers retains the user and separates cancellation from timeout',async()=>{
    const {chat,ctx}=client(embed);const headers=deferred();ctx.fetch=()=>headers.promise;let errors=0;
    const work=chat.send(' hello  world ',{onError:()=>errors++});await tick();
    assert.equal(chat.isDuplicate('hello world'),true);assert.equal(await chat.send('hello world',{}),undefined);
    chat.stop();await work;
    assert.equal(chat.messages.length,2);assert.equal(chat.messages[1].status,'stopped');assert.equal(errors,1);
    headers.resolve(stream().response);await tick();assert.equal(chat.busy,false);
    const s=stream();ctx.fetch=async()=>s.response;
    const again=chat.send('hello world',{});await tick();s.chunk('[happy] Yes');await tick();s.end();await again;
    assert.equal(chat.messages.filter(m=>m.role==='user').length,2);
  });
  for (const partial of ['', '[happy] Partial answer']) test(mode+': Stop during stream preserves partial '+Boolean(partial),async()=>{
    const {chat,ctx}=client(embed);const s=stream();ctx.fetch=async()=>s.response;
    let successful=0;const work=chat.send('question',{onDone:()=>successful++});await tick();
    if(partial){s.chunk(partial);await tick();}
    chat.stop();await work;
    assert.equal(chat.messages[1].content,partial?'Partial answer':'');assert.equal(chat.messages[1].status,'stopped');assert.ok(s.canceled);
    if(s.pending.length){s.chunk('late stale text');await tick();}
    assert.equal(successful,0);assert.equal(chat.messages[1].content,partial?'Partial answer':'');
  });
  test(mode+': Retry reuses user identity, excludes partials, and late cleanup cannot unlock the newer attempt',async()=>{
    const {chat,ctx}=client(embed);let old=stream();ctx.fetch=async()=>old.response;
    const first=chat.send('question',{});await tick();old.chunk('[happy] BAD PARTIAL');await tick();chat.stop();
    const reply=chat.messages[1], user=chat.messages[0], attempt=reply.attemptId;assert.ok(chat.canRetry(reply.id));
    const fresh=stream();let request;ctx.fetch=async(_url,opts)=>{request=JSON.parse(opts.body);return fresh.response;};
    const retry=chat.send('question',{}, {retryId:reply.id});await tick();await first;
    assert.equal(chat.busy,true);assert.equal(chat.messages.filter(m=>m.role==='user').length,1);
    assert.equal(chat.current.userMessage,user);assert.notEqual(chat.current.attemptId,attempt);
    assert.ok(!JSON.stringify(request.messages).includes('BAD PARTIAL'));
    assert.equal(request.messages.filter(m=>m.role==='user').length,1);
    fresh.chunk('[happy] Good answer');await tick();fresh.end();await retry;assert.equal(chat.messages.at(-1).status,'completed');
    assert.equal(chat.canRetry(reply.id),false);
  });
  for (const action of ['new','open','delete','message','memory']) test(mode+': '+action+' invalidates late stream persistence',async()=>{
    const {chat,ctx,store}=client(embed);chat.newConversation();const saved=chat.convId;
    chat.messages.push({id:'saved',role:'user',content:'saved'});
    // Persist a second conversation to switch to.
    store.set((embed?'ws_embed_conv_':'ws_conv_')+'other',JSON.stringify([{id:'other',role:'user',content:'other'}]));
    const s=stream();ctx.fetch=async()=>s.response;const work=chat.send('question',{});await tick();
    if(action==='new')chat.newConversation();
    if(action==='open') { chat.newConversation(); chat.openConversation(saved); }
    if(action==='delete')chat.deleteConversation(saved);
    if(action==='message')chat.deleteMessage(chat.messages[0].id);
    if(action==='memory')chat.setSummary('Edited');
    await work;const before=JSON.stringify(chat.messages);s.chunk('[happy] stale');await tick();assert.equal(JSON.stringify(chat.messages),before);
  });
  test(mode+': title, romanization, decisions, and summary JSON cannot mutate a replacement',async()=>{
    for (const job of ['title','romaji','decision','summary']) {
      const {chat,ctx}=client(embed);chat.newConversation();
      for(let i=0;i<30;i++)chat.messages.push({id:'m'+i,role:i%2?'assistant':'user',content:'こんにちは '+i});
      // A real accepted turn creates its history entry, then is settled locally.
      const owner=chat.beginTurn('question');owner.replyMessage.content='こんにちは';chat.finishTurn(owner);
      const body=deferred();ctx.fetch=async()=>({ok:true,json:()=>body.promise});
      const work=job==='title'?chat.generateTitle(chat.convId,owner):job==='romaji'?chat.romanize(owner.replyMessage,owner):job==='summary'?chat.summarize(true,owner):chat.askDecisions(['sprites_emotion_v1'],{reply:'hello'},owner);
      await tick();chat.newConversation();body.resolve({choices:[{message:{content:'Stale'}}],status:'ok',answers:{}});
      await Promise.resolve(work).catch(()=>{});assert.equal(chat.messages.length,0);assert.equal(chat.summary,'');
    }
  });
  test(mode+': reload interrupts pending work without making requests; image notes are safe for speech and context',async()=>{
    const {chat,ctx,store}=client(embed);const owner=chat.beginTurn('draw');
    const image=chat.createPicture(owner,'a sunny garden','2:3');const id=chat.convId;
    const reloaded=client(embed,store);let calls=0;reloaded.ctx.fetch=()=>{calls++;};reloaded.chat.openConversation(id);
    assert.equal(reloaded.chat.busy,false);assert.equal(calls,0);assert.equal(reloaded.chat.messages[1].status,'interrupted');
    assert.equal(reloaded.chat.messages[2].generation,'interrupted');assert.ok(!chat.messageText(image).includes('sent a picture'));
    assert.doesNotThrow(()=>chat.recentContext());
    chat.updatePicture(owner,image,{image:'https://image.test/pic',generation:'generated'});
    chat.setPictureDisplay(id,image,image.image,'failed');
    assert.match(chat.messageText(image),/browser display failed/);
    ctx.fetch=()=>{throw Error('No inference needed');};assert.match(JSON.stringify(await chat.modelMessages()),/App image status/);
    chat.setPictureDisplay(id,image,image.image,'unknown');chat.stop();assert.equal(image.display,'interrupted');
  });
}
test('request deadline is a failed attempt, while explicit Stop is stopped',async()=>{
  const {chat,ctx,timers}=client();ctx.fetch=()=>new Promise(()=>{});
  const work=chat.send('hello',{});await tick();[...timers.values()].find(t=>t.ms===90000).fn();await work;
  assert.equal(chat.messages[1].status,'failed');assert.ok(chat.canRetry(chat.messages[1].id));
});

test('canceled picture decision never falls through to a writer; canceled blob storage is discarded',async()=>{
  const {chat,ctx}=client();
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../pictures.js'),'utf8')+';this.pictures=Pictures;',ctx);
  const picture=ctx.pictures;
  const decision=deferred();let calls=0;
  chat.askDecisions=()=>decision.promise;
  ctx.fetch=async()=>{calls++;return json('DRAW: Stale picture prompt');};
  const owner=chat.beginTurn('send me a selfie');
  const work=picture.decide(owner.text,'',{}, {owner,signal:owner.signal,valid:()=>chat.isCurrent(owner)});
  chat.newConversation();decision.resolve({picture_action_v1:{choice_id:'draw'}});
  assert.equal(await work,null);assert.equal(calls,0);

  const storage=deferred();let forgotten=0;
  // Expose only the existing IndexedDB adapter for a deterministic commit boundary.
  const ctx2=client().ctx;
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../pictures.js'),'utf8').replace('return { decide, draw,','return { Store, decide, draw,')+';this.pictures=Pictures;',ctx2);
  ctx2.URLSearchParams=URLSearchParams;
  ctx2.pictures.Store.put=()=>storage.promise;
  ctx2.pictures.Store.del=()=>{forgotten++;};
  const controller=new AbortController();
  ctx2.fetch=async()=>({ok:true,headers:new Headers({'X-Image-Id':'one'}),blob:async()=>new Blob(['bytes'])});
  const drawing=ctx2.pictures.draw('garden','1:1',{}, {signal:controller.signal});await tick();
  controller.abort();storage.resolve();await assert.rejects(drawing,{name:'AbortError'});assert.equal(forgotten,1);
});

test('delayed transcription and audio decoding cannot submit or play after cancellation',async()=>{
  const body=deferred();let captureOptions, submitted=0, canceled=0, signal;
  const window={MediaRecorder:function(){},MicCapture:{create:options=>{captureOptions=options;return {start(){},cancel(){canceled++;}};}}};
  const context=vm.createContext({window,navigator:{mediaDevices:{getUserMedia(){}},language:'en'},
    AbortController,FormData,setTimeout,clearTimeout,fetch:async(_url,options)=>{signal=options.signal;return {ok:true,json:()=>body.promise};}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../voice.js'),'utf8')+';this.voice=Voice;',context);
  const handlers={};context.voice.init({addEventListener:(name,fn)=>handlers[name]=fn}, {onText:()=>submitted++,onError:()=>{throw Error('stale error');}});
  handlers.click({detail:0});const transcribing=captureOptions.onAudio(new Blob(['audio'],{type:'audio/webm'}));await tick();
  context.voice.cancel();body.resolve({text:'stale transcript'});await transcribing;
  assert.equal(submitted,0);assert.equal(canceled,1);assert.equal(signal.aborted,true);

  const decoding=deferred();let plays=0, valid=true;
  class AudioContext { constructor(){this.state='running';} decodeAudioData(){return decoding.promise;} createBufferSource(){plays++;throw Error('stale playback');} }
  const audioWindow={AudioContext};
  const audio=vm.createContext({window:audioWindow,navigator:{language:'en'},localStorage:{getItem:()=>null},setTimeout,clearTimeout,
    atob,fetch:async()=>({ok:true,json:async()=>({data:'YQ=='})})});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../tts_language_router.js'),'utf8'),audio);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../speech.js'),'utf8')+';this.speech=Speech;',audio);
  const speaking=audio.speech.speak('Hello there.',{valid:()=>valid});await tick();valid=false;audio.speech.stop();decoding.resolve({duration:1});
  await speaking;assert.equal(plays,0);assert.ok(!audio.speech.speaking);
});

test('per-chat interface locale reaches Cloud settings in full and embedded apps',async()=>{
 for(const embed of [false,true]){
  const {chat,ctx}=client(embed);let body;
  const snapshot={interface_locale:'ja',interface_locale_preference:'auto',interface_locale_status:'ready',interface_locale_version:1};
  ctx.window.WaifuI18n={snapshot:()=>snapshot};
  chat.settings.stream=false;
  ctx.fetch=async(url,options)=>{body=JSON.parse(options.body);return json('Invented reply');};
  await chat.send('Invented',{onDone(){}});
  assert.ok(body);
  for(const [key,value] of Object.entries(snapshot))assert.equal(body.client_settings[key],value);
 }
});
