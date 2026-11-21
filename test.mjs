import assert from 'node:assert/strict';
import {run} from './solve.js';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const tests=[
 [{text:'',header:false},{columns:null,rows:[],errors:[]}],
 [{text:'a,b\nx',header:true},{columns:['a','b'],rows:[['x','']],errors:[{code:'short_row',line:2,row:0,fields:1}]}],
 [{text:'"a,b","c""d"',header:false},{columns:null,rows:[['a,b','c"d']],errors:[]}],
 [{text:'"a,b',header:false},{columns:null,rows:[['"a','b']],errors:[{code:'unterminated_quote',line:1,row:0}]}],
 [{text:'a\rb,c',header:false},{columns:null,rows:[['ab','c']],errors:[{code:'stray_cr',line:1,row:0}]}],
 [{text:'"a"x,b',header:false},{columns:null,rows:[['ax','b']],errors:[{code:'quote_junk',line:1,row:0}]}]
];
for(const [input,expected] of tests)assert.deepStrictEqual(run(input),expected);
assert.notEqual(process.features.typescript,false,'Use an official Node build with TypeScript support');
const temp=mkdtempSync(join(tmpdir(),'csv-test-'));
try{
 const input=join(temp,'in'),output=join(temp,'out');mkdirSync(input);mkdirSync(output);
 writeFileSync(join(input,'cases.json'),JSON.stringify(tests.map(([input],i)=>({id:String(i),input}))));
 let previous;
 for(let i=0;i<2;i++){
  const child=spawnSync(process.execPath,[fileURLToPath(new URL('./main.ts',import.meta.url))],{env:{...process.env,MAKEFUN_INPUT_DIR:input,MAKEFUN_OUTPUT_DIR:output},encoding:'utf8',timeout:10000});
  assert.ifError(child.error);assert.equal(child.status,0,child.stderr);
  const bytes=readFileSync(join(output,'answers.json'),'utf8');
  assert.deepStrictEqual(JSON.parse(bytes),tests.map(([,expected])=>expected));
  if(i)assert.equal(bytes,previous);previous=bytes;
 }
 console.log('PASS: parser, main.ts I/O contract, and deterministic output');
}finally{rmSync(temp,{recursive:true,force:true});}
