import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname} from 'node:path';
export function openDatabase(path){if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});const db=new DatabaseSync(path);db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,verified INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY REFERENCES users(id),display_name TEXT NOT NULL,residence TEXT DEFAULT 'unspecified',language TEXT DEFAULT 'es',avatar_path TEXT);
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER NOT NULL,aal2 INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS tokens(hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),purpose TEXT,expires INTEGER);
CREATE TABLE IF NOT EXISTS global_roles(user_id TEXT REFERENCES users(id),role TEXT CHECK(role IN ('admin','editor','writer','guide')),PRIMARY KEY(user_id,role));
CREATE TABLE IF NOT EXISTS organizations(id TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS memberships(organization_id TEXT REFERENCES organizations(id),user_id TEXT REFERENCES users(id),role TEXT CHECK(role IN ('owner','staff')),active INTEGER DEFAULT 1,PRIMARY KEY(organization_id,user_id));
CREATE TABLE IF NOT EXISTS access_requests(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),kind TEXT CHECK(kind IN ('business','writer','guide')),name TEXT,status TEXT DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX IF NOT EXISTS pending_request ON access_requests(user_id,kind) WHERE status='pending';
CREATE TABLE IF NOT EXISTS favorites(user_id TEXT REFERENCES users(id),path TEXT,title TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,path));
CREATE TABLE IF NOT EXISTS point_entries(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),program TEXT,delta INTEGER,reason TEXT,reference TEXT UNIQUE,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS factors(id TEXT PRIMARY KEY,user_id TEXT UNIQUE REFERENCES users(id),secret TEXT,verified INTEGER DEFAULT 0,last_step INTEGER DEFAULT -1);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY,actor TEXT,action TEXT,subject TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS page_views(day TEXT,path TEXT,count INTEGER DEFAULT 0,PRIMARY KEY(day,path));`);if(!db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='status'))db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended'))"); if(path!==':memory:')chmodSync(path,0o600);return db;}
