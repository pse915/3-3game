"""v5 quiz + projects serialise through exactly the existing v4/v3 save contract."""
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from server.storage import Store,validate
BASE=Path(__file__).resolve().parents[1]
class V5RoundTrip(unittest.TestCase):
    @unittest.skipUnless(shutil.which('node'),'Node.js unavailable')
    def test_full_story_quiz_mixed_results_and_sqlite_roundtrip(self):
        script='''
import {readFileSync} from 'node:fs';
import {freshState} from './components/rpg_game/systems.js';
import {ensureLife} from './components/rpg_game/life.js';
import {freshStory,performStoryChoice} from './components/rpg_game/story.js';
import {queueEventQuizzes,submitQuiz,applyVillageProject,quizById,openBonusQuiz} from './components/rpg_game/quiz.js';
const bank=JSON.parse(readFileSync('./components/rpg_game/data/quiz_v5.json','utf8'));
const stories=JSON.parse(readFileSync('./components/rpg_game/data/story_v4.json','utf8'));
const st=freshState();ensureLife(st);st.life.story=freshStory();
for(let i=0;i<32;i++){
  const chosen=performStoryChoice(st,stories,i%3);
  if(!chosen.ok)throw Error('Story progression stopped');
  const s=st.life.story;
  queueEventQuizzes(s,chosen.entry.id,bank);
  while(s.quiz?.pending){
    const question=quizById(bank,s.quiz.pending);
    submitQuiz(s,question.id,(question.correct+1)%4,bank);
    submitQuiz(s,question.id,question.correct,bank);
    if(i%2===0)applyVillageProject(s,question.id,bank);
  }
}
for(const id of ['q09','q13','q14']){
  if(!openBonusQuiz(st.life.story,id,bank).ok)throw Error('Missing bonus');
  const q=quizById(bank,id);
  submitQuiz(st.life.story,id,q.correct,bank);
  applyVillageProject(st.life.story,id,bank);
}
st.revision=72;
console.log(JSON.stringify(st));
'''
        process=subprocess.run([shutil.which('node'),'--input-type=module','-e',script],cwd=BASE,text=True,capture_output=True,check=True)
        state=json.loads(process.stdout)
        validate(state)
        quiz=state['life']['story']['quiz']
        self.assertEqual(len(quiz['completed']),15)
        self.assertIsNone(quiz['pending'])
        self.assertGreater(len(quiz['projects']),6)
        self.assertTrue(state['life']['story']['complete'])
        with tempfile.TemporaryDirectory() as folder:
            store=Store(Path(folder)/'save.sqlite')
            self.assertEqual(store.save(state),72)
            restored=store.restore(state['id'],state['token'])
            self.assertEqual(restored['life']['story'],state['life']['story'])
            self.assertEqual(restored['life']['story']['quiz'],quiz)
    def test_validator_rejects_corrupted_quiz(self):
        from server.storage import validate_story
        script='''import {freshStory} from './components/rpg_game/story.js';import {freshQuiz} from './components/rpg_game/quiz.js'; const s=freshStory();s.quiz=freshQuiz();console.log(JSON.stringify(s))'''
        process=subprocess.run(['node','--input-type=module','-e',script],cwd=BASE,text=True,capture_output=True,check=True)
        sample=json.loads(process.stdout)
        validate_story(sample)
        sample['quiz']['projects']=['q15']
        with self.assertRaises(ValueError):validate_story(sample)
if __name__=='__main__':unittest.main()
