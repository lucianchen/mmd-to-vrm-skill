import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {normalizeAssetPath,resolveSelectedFile} from '../compare/file_paths.mjs';
import {resolveWithin} from '../scripts/serve_compare.mjs';

test('normalizes Chinese, encoded and Windows texture paths',()=>{
  assert.equal(normalizeAssetPath('角色/Textures\\face%20color.png'),'角色/Textures/face color.png');
  assert.equal(normalizeAssetPath('folder/model/../Textures/a.png'),'folder/Textures/a.png');
});
test('resolves textures by complete path rather than ambiguous basenames',()=>{
  const files=new Map([['avatar/a/face.png','first'],['avatar/b/face.png','second']]);
  assert.equal(resolveSelectedFile(files,'/selected/avatar/b/face.png'),'second');
  assert.equal(resolveSelectedFile(files,'/selected/AVATAR/A/Face.png'),'first');
  assert.throws(()=>resolveSelectedFile(files,'/selected/face.png'),/Missing/);
});
test('fails on missing files and ambiguous case folding',()=>{
  const files=new Map([['a/face.png',1],['a/FACE.png',2]]);
  assert.throws(()=>resolveSelectedFile(files,'/selected/a/Face.png'),/Ambiguous/);
  assert.throws(()=>resolveSelectedFile(files,'/selected/a/missing.png'),/Missing/);
});
test('does not resolve selected assets above their folder',()=>{
  assert.throws(()=>normalizeAssetPath('../private.png'),/escapes/);
  assert.throws(()=>normalizeAssetPath('%2E%2E/secret.png'),/escapes/);
});
test('local server confines relative and absolute paths to its selected asset root',()=>{
  const root=path.resolve('fixture-assets');assert.equal(resolveWithin(root,'Textures/a.png'),path.join(root,'Textures','a.png'));
  assert.throws(()=>resolveWithin(root,'../outside.png'),/escapes/);
  assert.throws(()=>resolveWithin(root,path.resolve('outside.png')),/escapes/);
});
