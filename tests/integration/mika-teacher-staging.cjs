// Opt-in integration test. Run against a local Next server configured for staging only.
// Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
// SUPABASE_SECRET_KEY. Never use production credentials.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const {createServerClient}=require('@supabase/ssr');
test('MIKA teacher: real grading, new session and cross-user isolation', {timeout:120000}, async()=>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 assert.equal(url,'https://sdwguqyjuvuamfiingsp.supabase.co');
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 const secret=process.env.SUPABASE_SECRET_KEY;
 assert.ok(key && secret && key!==secret);
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const users=[];
 const checked=({data,error},stage='database')=>{if(error){const safe=v=>typeof v==='string'&&/^[a-zA-Z0-9_]+$/.test(v)&&v.length<80?v:'unknown';throw new Error(`${stage}: ${safe(error.name)} code=${safe(error.code)} status=${Number.isInteger(error.status)?error.status:'unknown'}`);}return data;};
 async function login(email,password){
  const jar=new Map();
  const client=createServerClient(url,key,{cookies:{getAll:()=>Array.from(jar,([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>jar.set(name,value))}});
  checked(await client.auth.signInWithPassword({email,password}),'student-login');
  return {client,cookie:()=>Array.from(jar,([k,v])=>k+'='+v).join('; ')};
 }
 async function provision(){
  const email='mika-qa-'+randomUUID()+'@example.com',password=randomUUID()+randomUUID();
  const {user}=checked(await admin.auth.admin.createUser({email,password,email_confirm:true}),'admin-create-student');
  users.push(user.id);
  return {id:user.id,email,password,...await login(email,password)};
 }
 try{
  const a=await provision(),b=await provision();
  const j=checked(await admin.from('myryra_journeys').insert({owner_id:a.id,title:'QA fundamentos de IA'}).select('id').single());
  const m=checked(await admin.from('myryra_journey_missions').insert({journey_id:j.id,title:'IA, machine learning e IA generativa'}).select('id').single());
  const session=checked(await admin.from('mika_teacher_sessions').insert({owner_id:a.id,journey_id:j.id,mission_id:m.id,topic:'Fundamentos de IA'}).select('id').single());
  const exercise='Escreva um exemplo de IA preditiva e outro de IA generativa aplicados ao seu trabalho.';
  async function grade(actor,answer){
   const res=await fetch('http://127.0.0.1:3000/api/journeys/feedback',{method:'POST',headers:{'content-type':'application/json',cookie:actor.cookie()},body:JSON.stringify({journeyId:j.id,missionId:m.id,sessionId:session.id,exercise,answer}),signal:AbortSignal.timeout(30000)});
   return {status:res.status,body:await res.json()};
  }
  async function complete(actor,status='completed'){
   const res=await fetch('http://127.0.0.1:3000/api/journeys/'+j.id+'/missions/'+m.id,{method:'PATCH',headers:{'content-type':'application/json',cookie:actor.cookie()},body:JSON.stringify({status}),signal:AbortSignal.timeout(15000)});
   return {status:res.status,body:await res.json()};
  }
  async function balance(actor){
   const res=await fetch('http://127.0.0.1:3000/api/journeys/myra',{headers:{cookie:actor.cookie()},signal:AbortSignal.timeout(15000)});
   assert.equal(res.status,200,'MYRA balance HTTP status');
   return (await res.json()).balance;
  }
  const initial=await balance(a),otherInitial=await balance(b);
  assert.equal((await complete(a)).status,409,'Completion before grading');
  assert.equal(await balance(a),initial);
  assert.equal((await complete(b)).status,404,'Cross-user completion');
  const wrong='IA preditiva e generativa são exatamente iguais e não usam dados nem modelos.';
  const right='IA preditiva estima a probabilidade de falha de um servidor com dados históricos. IA generativa produz um resumo textual do incidente a partir de informações verificadas.';
  for(const [answer,passed] of [[wrong,false],[right,true]]){
   checked(await admin.from('myryra_journey_learning_progress').upsert({mission_id:m.id,owner_id:a.id,answer,updated_at:new Date().toISOString()}));
   const result=await grade(a,answer);
   const knownErrors=['Não foi possível verificar a aula vinculada.','Exercício oficial indisponível.','Não foi possível emitir o exercício oficial.','Não foi possível confirmar o exercício oficial.','Histórico de aprendizagem indisponível.','Serviço temporariamente indisponível.','Serviço de IA não configurado.','A avaliação retornou dados inválidos.','A avaliação retornou uma nota inconsistente.','Não foi possível verificar a versão atual da resposta.','Não foi possível confirmar o exercício atual.','A avaliação foi gerada, mas não pôde ser salva. Tente novamente antes de concluir a missão.','Não foi possível avaliar a resposta agora.'];
   assert.equal(result.status,200,'Feedback HTTP status: '+(knownErrors.includes(result.body?.error)?result.body.error:'unclassified response'));
   assert.equal(result.body.saved,true);
   assert.equal(result.body.passed,passed);
   assert.equal(result.body.score>=70,passed);
   const fresh=await login(a.email,a.password);
   const progress=checked(await fresh.client.from('myryra_journey_learning_progress').select('assessment_score,assessment_passed').eq('mission_id',m.id).single());
   assert.equal(progress.assessment_score,result.body.score);
   assert.equal(progress.assessment_passed,passed);
   if(!passed){assert.equal((await complete(a)).status,409,'Completion after failed grading');assert.equal(await balance(a),initial); }
  }
  const completed=await complete(a);
  assert.equal(completed.status,200,'Completion after passing grade');
  assert.equal(completed.body.mission.status,'completed');
  assert.equal(completed.body.myraAwarded,true);
  assert.equal(await balance(a),initial+10);
  const repeated=await complete(a);
  assert.equal(repeated.status,200);
  assert.equal(repeated.body.myraAwarded,false);
  assert.equal(await balance(a),initial+10);
  assert.equal(await balance(b),otherInitial);
  const hidden=checked(await b.client.from('mika_teacher_sessions').select('id').eq('id',session.id));
  assert.equal(hidden.length,0);
  const denied=await grade(b,right);
  assert.equal(denied.status,404);
 }finally{
  for(const id of users.reverse()) checked(await admin.auth.admin.deleteUser(id));
 }
});
