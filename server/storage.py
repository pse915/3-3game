"""Authenticated anonymous checkpoints; durable SQLite outbox; server-only Sheets access."""
import hashlib, hmac, json, math, sqlite3, time
from contextlib import contextmanager
from pathlib import Path

STAT_KEYS={'money','health','leisure','relations','time','care','community','support'}
QUEST_IDS={'life','day','job','housing','budget','care','elder','generation','policy','retire'}
LIFE_STATS={'money','time','fatigue','satisfaction','growth','stability','preparation','relations','health'}

def validate_life(life):
    if not isinstance(life,dict) or life.get('version')!=1:raise ValueError('Invalid life version')
    if type(life.get('day')) is not int or life['day']<1:raise ValueError('Invalid life day')
    for key in LIFE_STATS:
        value=life.get(key)
        maximum=480 if key=='time' else (float('inf') if key=='money' else 100)
        if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or not 0<=value<=maximum:raise ValueError('Invalid life resources')
    def text(value,limit=1000):return isinstance(value,str) and len(value)<=limit
    for key in ('plan','reason'):
        if not text(life.get(key),600):raise ValueError('Invalid life text')
    for key in ('coreReasons','corePlans'):
        mapping=life.get(key,{})
        if not isinstance(mapping,dict) or not set(mapping)<=QUEST_IDS or any(not text(v,600) for v in mapping.values()):raise ValueError('Invalid core reflections')
    if type(life.get('lastEventAt',0)) is not int or life.get('lastEventAt',0)<0:raise ValueError('Invalid event checkpoint')
    if 'appearance' in life:
        appearance=life['appearance']
        if not isinstance(appearance,dict) or set(appearance)!={'hair','skin','outfit','bag','glasses'}:raise ValueError('Invalid appearance')
        if any(type(appearance[k]) is not int or not 0<=appearance[k]<=maximum for k,maximum in (('hair',3),('skin',3),('outfit',3),('bag',2))) or type(appearance['glasses']) is not bool:raise ValueError('Invalid appearance options')
    if 'fragments' in life:
        fragments=life['fragments']
        if not isinstance(fragments,list) or len(fragments)>8 or any(not text(v,100) for v in fragments) or len(set(fragments))!=len(fragments):raise ValueError('Invalid discoveries')
    for key in ('unlocked','seenEvents'):
        values=life.get(key)
        if not isinstance(values,list) or len(values)>500 or any(not text(v,100) for v in values):raise ValueError('Invalid life flags')
    careers=life.get('careers')
    if not isinstance(careers,dict) or len(careers)>100 or any(not text(k,100) or type(v) is not int or v<0 for k,v in careers.items()):raise ValueError('Invalid careers')
    if life.get('pending') is not None and not text(life['pending'],100):raise ValueError('Invalid pending event')
    for key in ('history','events'):
        entries=life.get(key)
        if not isinstance(entries,list) or len(entries)>500:raise ValueError('Invalid life history')
        for entry in entries:
            fields=('id','title','choice','consequence','reason')+ (('domain','concept','plan') if key=='history' else ())
            if not isinstance(entry,dict) or any(not text(entry.get(f),600 if f in ('reason','plan') else 1000) for f in fields):raise ValueError('Invalid activity text')
            if type(entry.get('day')) is not int or not 1<=entry['day']<=life['day']:raise ValueError('Invalid activity day')
            delta=entry.get('effects')
            if not isinstance(delta,dict) or not set(delta)<=LIFE_STATS or any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in delta.values()):raise ValueError('Invalid activity effects')
            if key=='history' and (isinstance(entry.get('score'),bool) or not isinstance(entry.get('score'),(int,float)) or not math.isfinite(entry['score']) or entry['score']<0):raise ValueError('Invalid activity score')
    if 'story' in life:validate_story(life['story'])
    return life

def validate_story(story):
    """Bound the v4 story extension stored alongside legacy v3 saves."""
    if not isinstance(story,dict) or story.get('version')!=4:raise ValueError('Invalid story version')
    for key,limit in (('chapter',8),('step',8)):
        if type(story.get(key)) is not int or not 0<=story[key]<=limit:raise ValueError('Invalid story progress')
    if type(story.get('complete')) is not bool or type(story.get('reunion')) is not bool:raise ValueError('Invalid story completion')
    records=story.get('records')
    if not isinstance(records,list) or len(records)>64:raise ValueError('Invalid story records')
    for entry in records:
        if not isinstance(entry,dict) or any(not isinstance(entry.get(k),str) or len(entry[k])>limit for k,limit in (('id',100),('title',200),('choice',300),('result',1200))):raise ValueError('Invalid story record')
        if type(entry.get('age')) is not int or not 15<=entry['age']<=65:raise ValueError('Invalid story age')
    flags=story.get('flags')
    if not isinstance(flags,dict) or len(flags)>100 or any(not isinstance(k,str) or len(k)>100 or not isinstance(v,str) or len(v)>100 for k,v in flags.items()):raise ValueError('Invalid story flags')
    for key in ('self','world','relationships'):
        values=story.get(key)
        if not isinstance(values,dict) or len(values)>20 or any(isinstance(v,bool) or type(v) is not int or not 0<=v<=100 for v in values.values()):raise ValueError('Invalid story meters')
    if any(not isinstance(story.get(k),list) or len(story[k])>limit for k,limit in (('worldHistory',8),('outcomes',30))):raise ValueError('Invalid story history')
    if not isinstance(story.get('reflection'),str) or len(story['reflection'])>2000:raise ValueError('Invalid story reflection')
    if 'quiz' in story:
        q=story['quiz']
        if not isinstance(q,dict) or q.get('version')!=5:raise ValueError('Invalid quiz version')
        def quiz_ids(value):
            return isinstance(value,list) and len(value)<=15 and len(value)==len(set(map(str,value))) and all(isinstance(v,str) and len(v)==3 and v.startswith('q') and v[1:].isdigit() for v in value)
        if any(not quiz_ids(q.get(k)) for k in ('completed','queue','projects')):raise ValueError('Invalid quiz ids')
        if q.get('pending') is not None and (not isinstance(q['pending'],str) or len(q['pending'])!=3 or not q['pending'].startswith('q') or not q['pending'][1:].isdigit()):raise ValueError('Invalid pending quiz')
        for key in ('attempts','hints'):
            values=q.get(key)
            if not isinstance(values,dict) or len(values)>15 or any(not isinstance(k,str) or len(k)!=3 or not k.startswith('q') or not k[1:].isdigit() or type(v) is not int or not 0<=v<=999 for k,v in values.items()):raise ValueError('Invalid quiz counts')
        first=q.get('firstAttemptResults',{})
        if not isinstance(first,dict) or len(first)>15 or any(not isinstance(k,str) or len(k)!=3 or not k.startswith('q') or not k[1:].isdigit() or type(v) is not bool or q['attempts'].get(k,0)<1 for k,v in first.items()):raise ValueError('Invalid first quiz results')
        if any(project not in q['completed'] for project in q['projects']):raise ValueError('Invalid quiz projects')
    return story

def life_result(life):
    """Mirror the client result rules; labels describe patterns, not grades."""
    if life['fatigue']>=70:return '계획을 다시 돌보는 미래'
    if life['stability']>=65 and life['preparation']>=65 and life['health']>=60 and life['relations']>=55:return '균형을 만들어 가는 미래'
    if len(life['events'])>=4 and life['preparation']>=55:return '변화에 대응하는 미래'
    if life['relations']>=70:return '함께 살아가는 미래'
    if life['growth']>=70:return '계속 배우는 미래'
    if life['stability']>=70:return '안정을 쌓는 미래'
    if life['satisfaction']>=70:return '즐거움을 설계하는 미래'
    return '가능성을 탐색하는 미래'
def validate(s):
    if not isinstance(s,dict) or s.get('version') not in (1,2): raise ValueError('Invalid version')
    if len(json.dumps(s,ensure_ascii=False))>100000: raise ValueError('Checkpoint too large')
    for k in ('id','token'):
        if not isinstance(s.get(k),str) or len(s[k])!=36: raise ValueError('Invalid identity')
    if not isinstance(s.get('map'),str) or len(s['map'])>64: raise ValueError('Invalid map')
    for k in ('x','y','revision','playSeconds'):
        if isinstance(s.get(k),bool) or not isinstance(s.get(k),(int,float)) or not math.isfinite(s[k]) or s[k]<0: raise ValueError('Invalid position/revision')
    if s['x']>8192 or s['y']>8192: raise ValueError('Outside world')
    if type(s['revision']) is not int: raise ValueError('Invalid revision')
    if not isinstance(s.get('completed'),list) or any(not isinstance(q,str) for q in s['completed']) or not set(s['completed'])<=QUEST_IDS or len(set(s['completed']))!=len(s['completed']): raise ValueError('Invalid quest list')
    if not isinstance(s.get('diary'),list) or len(s['diary'])>8: raise ValueError('Invalid diary')
    for entry in s['diary']:
        if not isinstance(entry,dict) or entry.get('id') not in QUEST_IDS:raise ValueError('Invalid diary entry')
        if any(not isinstance(entry.get(k),str) or len(entry[k])>1000 for k in ('title','choice','consequence','concept')):raise ValueError('Invalid diary text')
    if [d['id'] for d in s['diary']]!=s['completed']:raise ValueError('Inconsistent diary')
    if not isinstance(s.get('visited',[]),list) or len(s.get('visited',[]))>100 or any(not isinstance(v,str) or len(v)>64 for v in s.get('visited',[])):raise ValueError('Invalid visits')
    if not isinstance(s.get('stats'),dict) or set(s['stats'])!=STAT_KEYS: raise ValueError('Invalid stats')
    if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not 0<=v<=100 for v in s['stats'].values()): raise ValueError('Invalid stat values')
    if not isinstance(s.get('reflection',''),str) or len(s.get('reflection',''))>2000: raise ValueError('Invalid reflection')
    if 'life' in s:validate_life(s['life'])
    if s['version']==2:
        ids=['life','day','care','policy','retire']
        if not isinstance(s.get('choices',{}),dict): raise ValueError('Invalid choices')
        if s['completed']!=ids[:len(s['completed'])] or len(s['completed'])>5: raise ValueError('Invalid story order')
        if any(type(s.get('choices',{}).get(k)) is not int or s['choices'][k] not in range(3) for k in s['completed']): raise ValueError('Invalid choice')
        if s.get('ending') and (len(s['completed'])!=5 or not s.get('reflection','').strip()): raise ValueError('Incomplete ending')
    return s

def digest(token): return hashlib.sha256(token.encode()).hexdigest()
class Store:
    def __init__(self,path):
        self.path=str(path);Path(path).parent.mkdir(parents=True,exist_ok=True)
        with self.connect() as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('CREATE TABLE IF NOT EXISTS saves (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, updated REAL NOT NULL)')
            db.execute('CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, retry_at REAL NOT NULL DEFAULT 0, error TEXT)')
    @contextmanager
    def connect(self):
        connection=sqlite3.connect(self.path,timeout=20)
        try:
            with connection: yield connection
        finally: connection.close()
    def save(self,state):
        validate(state);safe=dict(state);safe.pop('token');payload=json.dumps(safe,ensure_ascii=False,separators=(',',':'))
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE');row=db.execute('SELECT token_hash, revision FROM saves WHERE id=?',(state['id'],)).fetchone()
            if row and not hmac.compare_digest(row[0],digest(state['token'])): raise PermissionError('Invalid restore token')
            if row and row[1]>=state['revision']: return row[1]
            db.execute('INSERT INTO saves VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,updated=excluded.updated',(state['id'],digest(state['token']),state['revision'],payload,time.time()))
            db.execute('INSERT INTO outbox(id,revision) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision',(state['id'],state['revision']))
        return state['revision']
    def restore(self,id,token):
        with self.connect() as db: row=db.execute('SELECT token_hash,payload FROM saves WHERE id=?',(id,)).fetchone()
        if not row or not hmac.compare_digest(row[0],digest(token)): return None
        state=json.loads(row[1]);state['token']=token;return state
    def summaries(self):
        with self.connect() as db: rows=db.execute('SELECT payload,updated FROM saves ORDER BY updated DESC').fetchall()
        return [dict(json.loads(s),updated=t) for s,t in rows]
    def flush(self,sheet,limit=8):
        if sheet is None:return 0
        with self.connect() as db: rows=db.execute('SELECT s.id,s.token_hash,s.revision,s.payload,o.attempts FROM outbox o JOIN saves s ON s.id=o.id WHERE o.retry_at<=? LIMIT ?',(time.time(),limit)).fetchall()
        done=0
        for id,token_hash,rev,payload,attempts in rows:
            try:
                sheet.upsert(id,token_hash,rev,payload)
                with self.connect() as db: db.execute('DELETE FROM outbox WHERE id=? AND revision<=?',(id,rev))
                done+=1
            except Exception:
                with self.connect() as db:db.execute('UPDATE outbox SET attempts=attempts+1,retry_at=?,error=? WHERE id=?',(time.time()+min(300,2**min(attempts+1,8)),'Sheets 전송 실패',id))
        return done
    def pending(self,id):
        with self.connect() as db:return bool(db.execute('SELECT 1 FROM outbox WHERE id=?',(id,)).fetchone())
    def sync_status(self,id):
        """Only expose generic operational status, never credentials or payloads."""
        with self.connect() as db: row=db.execute('SELECT attempts,retry_at FROM outbox WHERE id=?',(id,)).fetchone()
        return {'pending':bool(row),'attempts':row[0] if row else 0,'retryAt':row[1] if row else 0}
