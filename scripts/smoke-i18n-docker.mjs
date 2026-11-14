#!/usr/bin/env node
// Offline container packaging check: no host ports, no network, data in tmpfs.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { root } from "./i18n-layout-checks.mjs";
assert.equal(process.version, "v22.22.2");
const [evidence] = process.argv.slice(2);
assert.ok(evidence);
await mkdir(evidence, { recursive: true });
const image = `paint-vault:i18n-smoke-${process.pid}`;
async function command(args, filename, input) {
  const child = spawn("docker", args, { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
  let output = "";
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (data) => {
      output += data;
    });
  child.stdin.end(input);
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  await writeFile(path.join(evidence, filename), output);
  assert.equal(code, 0, output.slice(-5000));
  return output;
}
const program = String.raw`
import assert from 'node:assert/strict'; import {readFile,readdir} from 'node:fs/promises';
process.env.NODE_ENV='test';const {startServer}=await import('./dist/server.mjs');process.env.NODE_ENV='production';await startServer();
const origin='http://127.0.0.1:3000';assert.equal((await fetch(origin)).status,200);
let bundle,url;
for(const file of await readdir('./dist/web-dist/assets')) if(file.endsWith('.js')){
 const source=await readFile('./dist/web-dist/assets/'+file,'utf8');
 if(source.includes('./locales/en/common.json')) {bundle=source;url=new URL('/assets/'+file,origin);break;}
}
assert.ok(bundle,'Local namespace import map present');const reports=[];
for(const language of ['en','es','fr','de','it','pt-BR','nl','pl','ru','ja','ko','zh-Hans','zh-Hant']){
 for(const namespace of ['common','glossary','pages','components','shell','errors']){
  const key='./locales/'+language+'/'+namespace+'.json';const start=bundle.indexOf(JSON.stringify(key));assert.ok(start>=0,key);
  const target=bundle.slice(start,start+250).match(/import\("([^"]+)"\)/)[1];const response=await fetch(new URL(target,url));
  assert.equal(response.status,200,key);assert.match(response.headers.get('content-type'),/javascript/);assert.ok((await response.text()).length>30);reports.push(language+'/'+namespace);
 }
}
console.log(JSON.stringify({status:'PASS',network:'none (no egress)',data:'/data tmpfs, uid1000',hostPortsPublished:false,catalogChunks:reports.length,languages:13,node:process.version}));process.exit(0);
`;
let output;
try {
  await command(["build", "--progress=plain", "-t", image, "."], "docker-build.log");
  output = await command(
    [
      "run",
      "--rm",
      "-i",
      "--network",
      "none",
      "--tmpfs",
      "/data:uid=1000,gid=1000,mode=700",
      "--entrypoint",
      "node",
      image,
      "--input-type=module",
      "-",
    ],
    "docker-smoke.log",
    program,
  );
  const result = JSON.parse(output.trim().split("\n").at(-1));
  await writeFile(
    path.join(evidence, "docker-results.json"),
    JSON.stringify(
      { ...result, image, buildCommand: "docker build --progress=plain", imageRemovedAfterRun: true },
      null,
      2,
    ),
  );
  console.log(result);
} finally {
  await command(["image", "rm", image], "docker-cleanup.log");
}
