import unittest
from server.storage import validate_story
class FirstResponseValidation(unittest.TestCase):
    def sample(self):
        return dict(version=4,chapter=0,step=0,complete=False,reunion=False,records=[],flags={},self={},world={},relationships={},worldHistory=[],outcomes=[],reflection='',quiz=dict(version=5,completed=['q01'],queue=[],projects=[],pending=None,attempts={'q01':2},hints={'q01':1},firstAttemptResults={'q01':False}))
    def test_first_wrong_survives_validator(self):
        s=self.sample();validate_story(s);self.assertIs(s['quiz']['firstAttemptResults']['q01'],False)
    def test_old_save_without_first_results(self):
        s=self.sample();del s['quiz']['firstAttemptResults'];validate_story(s)
    def test_reject_unknown_types_and_results_without_attempt(self):
        for result in (1,'false',None):
            s=self.sample();s['quiz']['firstAttemptResults']['q01']=result
            with self.assertRaises(ValueError):validate_story(s)
        s=self.sample();s['quiz']['attempts']={}
        with self.assertRaises(ValueError):validate_story(s)
