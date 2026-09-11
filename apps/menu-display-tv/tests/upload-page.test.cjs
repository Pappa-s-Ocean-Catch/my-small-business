const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(`${__dirname}/../app/src/main/assets/upload.html`,'utf8');
function page(response={ok:true,text:async()=> 'Paired with TV'}, savedCode=null) {
 const storage=new Map(savedCode ? [['menu-display-pairing-code',savedCode]] : []);
 const elements={};
 for(const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
  elements[match[1]]={hidden:/\bhidden\b/.test(match[0]),disabled:/\bdisabled\b/.test(match[0]),value:'',textContent:'',files:[],handlers:{},addEventListener(name,handler){this.handlers[name]=handler},focus(){}};
 }
 const requests=[];
 class XHR {
  constructor(){this.upload={};this.status=401;this.responseText='Incorrect pairing code';}
  open(){}setRequestHeader(){}send(){this.onload();}
 }
 const ready=vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{document:{getElementById:id=>elements[id]},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},fetch:async(...args)=>{requests.push(args);return args[1].headers['X-Pairing-Code'] ? (typeof response==='function' ? await response() : response) : {ok:false,status:401,text:async()=> 'Incorrect pairing code'}},AbortController,setTimeout,clearTimeout,XMLHttpRequest:XHR});
 return {elements,requests,storage,ready,submit:id=>elements[id].handlers.submit({preventDefault(){}})};
}
test('uploads unlock only after TV confirms pairing',async()=>{
 const p=page();await p.ready;assert.equal(p.elements['upload-fields'].disabled,true);
 p.elements.code.value='123456';await p.submit('pair');
 assert.equal(p.requests.at(-1)[0],'/pair');assert.equal(p.requests.at(-1)[1].headers['X-Pairing-Code'],'123456');
 assert.equal(p.elements['upload-fields'].disabled,false);assert.match(p.elements['pair-status'].textContent,/Paired with TV/);
});
test('incorrect code keeps uploads locked and displays server error',async()=>{
 const p=page({ok:false,text:async()=> 'Incorrect pairing code'});await p.ready;p.elements.code.value='000000';await p.submit('pair');
 assert.equal(p.elements['upload-fields'].disabled,true);assert.equal(p.elements['pair-status'].textContent,'Incorrect pairing code');
});
test('editing confirmed code requires pairing again',async()=>{
 const p=page();await p.ready;p.elements.code.value='123456';await p.submit('pair');p.elements.code.handlers.input();
 assert.equal(p.elements['upload-fields'].disabled,true);await p.submit('upload');assert.match(p.elements.status.textContent,/pair with the TV first/);
});
test('expired pairing during upload returns to step one',async()=>{
 const p=page();await p.ready;p.elements.code.value='123456';await p.submit('pair');p.elements.files.files=[{name:'menu.png',size:100}];await p.submit('upload');
 assert.equal(p.elements['upload-fields'].disabled,true);assert.match(p.elements['pair-status'].textContent,/Pairing expired/);assert.equal(p.elements['pair-button'].disabled,false);
});

test('only pairing is visible initially and only uploads after success',async()=>{
 const p=page();await p.ready;assert.equal(p.elements.pair.hidden,false);assert.equal(p.elements.upload.hidden,true);
 p.elements.code.value='123456';await p.submit('pair');
 assert.equal(p.elements.pair.hidden,true);assert.equal(p.elements.upload.hidden,false);
 p.elements.files.files=[{name:'menu.png',size:100}];await p.submit('upload');
 assert.equal(p.elements.pair.hidden,false);assert.equal(p.elements.upload.hidden,true);
});

test('load always checks pairing even without a saved code',async()=>{
 const p=page();await p.ready;
 assert.equal(p.requests.length,1);assert.equal(p.requests[0][0],'/pair');
 assert.equal(p.elements.pair.hidden,false);assert.equal(p.elements.upload.hidden,true);
});
test('saved pairing is validated before showing uploads on reload',async()=>{
 const p=page(undefined,'123456');
 assert.equal(p.elements.pair.hidden,true);assert.equal(p.elements.upload.hidden,true);
 await p.ready;
 assert.equal(p.requests[0][1].headers['X-Pairing-Code'],'123456');
 assert.equal(p.elements.upload.hidden,false);assert.equal(p.elements.pair.hidden,true);
 assert.equal(p.storage.get('menu-display-pairing-code'),'123456');
});
test('rejected saved pairing is cleared and code entry returns',async()=>{
 const p=page({ok:false,status:401,text:async()=> 'Incorrect pairing code'},'123456');await p.ready;
 assert.equal(p.elements.upload.hidden,true);assert.equal(p.elements.pair.hidden,false);
 assert.equal(p.elements.code.value,'');assert.equal(p.storage.has('menu-display-pairing-code'),false);
});
test('successful manual pairing persists for next load',async()=>{
 const p=page();await p.ready;p.elements.code.value='123456';await p.submit('pair');
 assert.equal(p.storage.get('menu-display-pairing-code'),'123456');
});

test('connection failure on load returns to code input and clears saved pairing',async()=>{
 const p=page(async()=>{throw new Error('Failed to fetch')},'123456');await p.ready;
 assert.equal(p.elements.pair.hidden,false);assert.equal(p.elements.upload.hidden,true);
 assert.equal(p.elements.checking.hidden,true);assert.equal(p.elements.code.disabled,false);
 assert.equal(p.storage.has('menu-display-pairing-code'),false);
 assert.match(p.elements['pair-status'].textContent,/Cannot reach the TV/);
});
