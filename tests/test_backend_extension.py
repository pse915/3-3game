import copy
import json
import threading
import unittest
from server.storage import validate, digest
from server.sheets import Sheets
from test_storage import sample

def life():
    return dict(version=1, day=1, money=120, time=480, fatigue=15, satisfaction=45,
                growth=35, stability=40, preparation=30, relations=45, health=65,
                history=[], events=[], unlocked=[], careers={}, plan='', reason='', seenEvents=[], pending=None)

class ExtensionTests(unittest.TestCase):
    def test_optional_appearance_and_discoveries(self):
        s=sample(); s['life']=life(); validate(s)
        s['life'].update(appearance=dict(hair=3,skin=0,outfit=1,bag=2,glasses=False),fragments=['library','garden'])
        validate(s)
        for invalid in (dict(hair=4,skin=0,outfit=1,bag=2,glasses=False),dict(hair=0,skin=0,outfit=1,bag=2,glasses=1)):
            broken=copy.deepcopy(s); broken['life']['appearance']=invalid
            with self.assertRaises(ValueError):validate(broken)
        for invalid in ([{}],['duplicate','duplicate'],['id']*9):
            broken=copy.deepcopy(s); broken['life']['fragments']=invalid
            with self.assertRaises(ValueError):validate(broken)
    def test_old_save_and_new_activity_round_trip_validation(self):
        s = sample(); s.update(version=2, choices={}, ending=False)
        validate(s)  # Optional extension keeps old v2 checkpoints usable.
        s['life'] = life()
        s['life']['history'].append(dict(id='work', title='직업 체험', domain='work', choice='협력',
            consequence='함께 과제를 완성했다.', concept='생애 설계', reason='관계를 중요하게 생각해요.',
            plan='다음에는 시간을 미리 나누어요.', day=1, effects={'money':20, 'time':-60}, score=2))
        validate(json.loads(json.dumps(s)))
        for field, invalid in [('money', float('inf')), ('health', True), ('time', -1), ('day', 0)]:
            broken = copy.deepcopy(s); broken['life'][field] = invalid
            with self.assertRaises(ValueError): validate(broken)
        s['life']['history'][0]['effects']['time'] = float('nan')
        with self.assertRaises(ValueError): validate(s)

class FakeWorksheet:
    def __init__(self, rows): self.rows = rows; self.appends = 0; self.updates = 0
    def get_all_values(self): return copy.deepcopy(self.rows)
    def append_row(self, row, **kw): self.rows.append(row); self.appends += 1
    def update(self, range_name, values, **kw):
        number = int(range_name.split(':')[0][1:]); self.rows[number-1] = values[0]; self.updates += 1

def sheets(rows):
    client = Sheets.__new__(Sheets); client.ws = FakeWorksheet(rows); client.lock = threading.Lock(); return client

def row(s):
    clean = dict(s); clean.pop('token')
    return [s['id'], digest(s['token']), s['revision'], json.dumps(clean)]

class SheetsTests(unittest.TestCase):
    def test_duplicate_retry_and_newest_restore(self):
        old = sample(); new = dict(old, revision=2, x=500)
        client = sheets([['id','token_hash','revision','payload'], row(old), row(new)])
        self.assertEqual(client.restore(old['id'], old['token'])['x'], 500)
        self.assertIsNone(client.restore(old['id'], 'wrong'))
        client.upsert(*row(new)); self.assertEqual(client.ws.appends, 0)
        client.upsert(old['id'], digest(old['token']), 3, row(dict(old, revision=3))[3])
        self.assertEqual(client.ws.updates, 1)
        self.assertEqual(client.restore(old['id'], old['token'])['revision'], 3)
        with self.assertRaises(PermissionError): client.upsert(old['id'], digest('wrong'), 4, '{}')
    def test_corrupt_newest_cloud_payload_falls_back(self):
        s = sample(); broken = row(dict(s, revision=2)); broken[3] = '{}'
        client = sheets([row(s), broken])
        self.assertEqual(client.restore(s['id'], s['token'])['revision'], 1)
    def test_append_retries_do_not_duplicate(self):
        s = sample(); client = sheets([])
        client.upsert(*row(s)); client.upsert(*row(s))
        self.assertEqual(client.ws.appends, 1)
    def test_large_cloud_payload_compression_keeps_old_format_readable(self):
        s = sample(); s['note'] = '학교에서 배우고 미래를 설계해요.' * 3500
        clean = row(s); client = sheets([])
        client.upsert(*clean)
        self.assertTrue(client.ws.rows[0][3].startswith('gzip:'))
        self.assertLess(len(client.ws.rows[0][3]), 49000)
        self.assertEqual(client.restore(s['id'], s['token'])['note'], s['note'])

if __name__ == '__main__': unittest.main()
