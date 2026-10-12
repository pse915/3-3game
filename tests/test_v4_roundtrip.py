"""V4 cross-runtime save/load test using the real JS simulation and SQLite server."""
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from server.storage import Store, validate

PROJECT = Path(__file__).resolve().parents[1]

class V4RoundTrip(unittest.TestCase):
    @unittest.skipUnless(shutil.which('node'), 'Node.js unavailable')
    def test_65_year_lifetime_roundtrip(self):
        script = '''
          import {freshState} from './components/rpg_game/systems.js';
          import {ensureLife} from './components/rpg_game/life.js';
          import {freshStory,performStoryChoice,applyRegionalScenario} from './components/rpg_game/story.js';
          import {readFileSync} from 'node:fs';
          const data=JSON.parse(readFileSync('./components/rpg_game/data/story_v4.json','utf8'));
          const state=freshState();ensureLife(state);state.life.story=freshStory();
          for(let i=0;i<32;i++){
            if([16,20,24].includes(i))applyRegionalScenario(state,i===16?'migration':i===20?'downturn':'investment');
            if(!performStoryChoice(state,data,i%3).ok)throw new Error('Story failed');
          }
          state.revision=17;
          console.log(JSON.stringify(state));
        '''
        result = subprocess.run([shutil.which('node'), '--input-type=module', '-e', script],
                                cwd=PROJECT, capture_output=True, text=True, check=True)
        state=json.loads(result.stdout)
        self.assertTrue(state['life']['story']['complete'])
        self.assertEqual(state['life']['story']['records'][-1]['age'],65)
        validate(state)
        with tempfile.TemporaryDirectory() as folder:
            store=Store(Path(folder)/'test.sqlite')
            self.assertEqual(store.save(state),17)
            restored=store.restore(state['id'],state['token'])
            self.assertEqual(restored['life']['story'],state['life']['story'])
            self.assertEqual(restored['life']['story']['records'][0]['effects'][0][:2],'나의')
            self.assertTrue(store.pending(state['id']))
            self.assertIsNone(store.restore(state['id'],'wrong'))
            self.assertEqual(store.save(state),17)

if __name__=='__main__':unittest.main()
