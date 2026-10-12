# 수정판 실행 안내

ZIP을 풀고 `seorabeol` 폴더에서 실행한다.

```sh
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

Google 서비스 계정 없이도 게임과 기기 저장·서버 저장은 사용할 수 있다. Sheets와 교사 비밀번호는 `.streamlit/secrets.example.toml`을 참고해 서버에 설정한다. 기존 GitHub 프로젝트를 업데이트하려면 ZIP 안의 소스·에셋·데이터를 프로젝트 루트에 반영하고, 기존 비밀키와 학생 기록을 덮어쓰지 않는다. 이번 작업에서는 원격 저장소 업로드나 배포를 하지 않았다.

첫 화면에서 캐릭터를 고르고 학교의 선생님과 이야기한 뒤 다이어리를 펼친다. 위의 목적지 안내를 따르면 핵심 이야기를 완료할 수 있다. **활동**은 원하는 순서의 자유 체험이다. **메뉴**에는 지도·퀘스트·가방·꾸미기·설정·저장이 있다. 주거 공간에서 다음 날을 시작할 수 있다. 모든 새 메뉴는 터치로 조작한다.

키보드: 방향키/WASD 이동, Shift 달리기, Enter/Space 상호작용, M 지도, J 다이어리, B 활동, Esc 메뉴.

수업 중에는 핵심 이야기와 원하는 활동1~2개를 경험한 뒤 소감을 작성하도록 제안한다. 실제 학생이20분에 완료할 수 있는지는 별도 수업 검증이 필요하다.

## 개발 확인

```sh
npm install
npm test
python -m unittest discover -s tests -p "test*.py"
```

브라우저 검증은 별도로 정적 서버를8765포트에 실행한다.

```sh
python -m http.server 8765 --directory components/rpg_game
npm run test:browser
npm run test:touch
```

실제 Streamlit 저장 확인은 기본8501포트에서 서버를 실행한 뒤 `npm run test:streamlit`을 사용한다. Chrome이 설치되어 있어야 하며 WebKit 확인에는 별도 Playwright 브라우저와 운영체제 구성요소가 필요하다. 다른 포트는 `GAME_URL`, `STREAMLIT_URL` 환경 변수로 지정한다. 테스트의 `?test` API는 localhost에서만 활성화된다.

에셋 재제작 스크립트에는 Pillow가 필요하다. `tools/build_avatars.py`는 캐릭터 원본을 만들고 `tools/finish_art.py`는 생성된 환경 원본을 정규화·정리하고 메타데이터를 갱신한다. `tools/build_life_data.py`는 자유 활동 데이터를 재생성한다. `build_world.py`로 이전 월드를 재생성한 경우 학교 확인·추정 메타데이터를 다시 갱신한다.

현재 검증 범위: `QA-v3.md`, 학습 연결: `LEARNING-v3.md`, 저장 운영: `OPERATIONS-v3.md`, 그래픽 출처와 한계: `ART-v3.md`. 실제 캡처는 `screenshots-v3/`에 있다.
