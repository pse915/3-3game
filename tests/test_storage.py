import unittest,tempfile,json
from pathlib import Path
from server.storage import Store,validate
def sample():return dict(version=1,id='a'*36,token='b'*36,map='town',x=300,y=300,revision=1,playSeconds=20,completed=[],diary=[],stats=dict.fromkeys(['money','health','leisure','relations','time','care','community','support'],45),reflection='')
class StorageTests(unittest.TestCase):
 def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.db=Store(Path(self.tmp.name)/'data.db')
 def tearDown(self):self.tmp.cleanup()
 def test_auth_and_monotonic_revision(self):
  s=sample();self.db.save(s);s['revision']=0;s['x']=900;self.db.save(s);self.assertEqual(self.db.restore(s['id'],s['token'])['x'],300);self.assertIsNone(self.db.restore(s['id'],'wrong'));s['token']='c'*36
  with self.assertRaises(PermissionError):self.db.save(s)
 def test_retry_and_idempotency(self):
  s=sample();self.db.save(s);self.db.save(s)
  class Failure:
   def upsert(self,*args):raise ConnectionError()
  self.assertEqual(self.db.flush(Failure()),0);self.assertTrue(self.db.pending(s['id']))
  with self.db.connect() as db:db.execute('UPDATE outbox SET retry_at=0')
  class Success:
   def upsert(self,*args):pass
  self.assertEqual(self.db.flush(Success()),1);self.assertFalse(self.db.pending(s['id']))
 def test_invalid_payload(self):
  s=sample();s['stats']['money']=float('nan')
  with self.assertRaises(ValueError):validate(s)
 def test_v2_five_choices_and_ending(self):
  s=sample();s.update(version=2,choices={},ending=False)
  quests=json.loads((Path(__file__).resolve().parents[1]/'components/rpg_game/data/quests.json').read_text(encoding='utf-8'))
  for q in quests:
   s['completed'].append(q['id']);s['choices'][q['id']]=0
   s['diary'].append(dict(id=q['id'],title=q['title'],choice=q['choices'][0][3],consequence=q['choices'][0][1],concept=q['concept']))
  self.db.save(s);self.assertEqual(len(self.db.restore(s['id'],s['token'])['completed']),5)
  s['ending']=True
  with self.assertRaises(ValueError):validate(s)
  s['reflection']='건강과 관계를 준비해요.';validate(s)
  s['completed'].reverse()
  with self.assertRaises(ValueError):validate(s)
class MapsTests(unittest.TestCase):
 def test_maps_and_destinations(self):
  root=Path(__file__).resolve().parents[1]/'components/rpg_game/data';catalog=json.loads((root/'catalog.json').read_text(encoding='utf-8'));ids={m['id'] for m in catalog}
  for entry in catalog:
   m=json.loads((root/'maps'/f"{entry['id']}.json").read_text(encoding='utf-8'));self.assertEqual(len(m['tiles']),m['width']*m['height']);self.assertEqual(len(m['solid']),len(m['tiles']))
   for p in m['portals']:self.assertIn(p['target'],ids)
  teachers=json.loads((root/'teachers.json').read_text(encoding='utf-8'));self.assertEqual(len(teachers),17)
if __name__=='__main__':unittest.main()
