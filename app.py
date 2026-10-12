from pathlib import Path
from collections import Counter
import hmac
import streamlit as st
import streamlit.components.v1 as components
from server.storage import Store, life_result
from server.sheets import Sheets

ROOT = Path(__file__).parent
st.set_page_config(page_title='서라벌여중 · 나의 미래 다이어리', layout='wide', initial_sidebar_state='collapsed')
st.markdown('<style>.block-container{padding:2.2rem 1rem 0.4rem}header[data-testid="stHeader"]{background:transparent}iframe{border:0;border-radius:12px}</style>', unsafe_allow_html=True)

def secret(name, default=None):
    try: return st.secrets.get(name, default)
    except Exception: return default

@st.cache_resource
def store(): return Store(ROOT/'private_data'/'progress.sqlite3')

@st.cache_resource
def sheets():
    creds, sid = secret('gcp_service_account'), secret('google_sheet_id')
    return Sheets(creds, sid) if creds and sid else None

db = store()
mode = st.sidebar.radio('화면', ['게임', '교사용 대시보드'])
if mode == '교사용 대시보드':
    st.title('함께 걸어온 이야기')
    configured = secret('teacher_password')
    if not configured:
        st.info('교사 화면을 사용하려면 서버에 teacher_password를 설정하세요.'); st.stop()
    entered = st.text_input('교사 비밀번호', type='password')
    if not entered or not hmac.compare_digest(entered.encode(), str(configured).encode()): st.stop()
    records = db.summaries()
    st.caption('이 서버에 저장된 익명 학습 기록입니다. 선택의 우열을 평가하지 않습니다.')
    a, b, c = st.columns(3)
    a.metric('참여 기록', len(records))
    b.metric('다이어리 완성', sum(bool(r.get('life', {}).get('story', {}).get('complete') or r.get('ending')) for r in records))
    c.metric('평균 활동 시간(분)', round(sum(r['playSeconds'] for r in records)/max(1, len(records))/60, 1))
    rows = []
    for r in records:
        life = r.get('life')
        status = db.sync_status(r['id'])
        rows.append({'익명 ID': r['id'][:8], '단계': r.get('stage'), '완료': bool((life or {}).get('story', {}).get('complete') or r.get('ending', False)),
                     '시간(분)': round(r['playSeconds']/60, 1), '핵심 선택': ' / '.join(d['choice'] for d in r['diary']),
                     '자유 활동': len(life['history']) if life else 0, '돌발 사건': len(life['events']) if life else 0,
                     '발견한 기억 조각': len(life.get('fragments', [])) if life else 0,
                     '미래 모습': life_result(life) if life else '', '생애 챕터': (life or {}).get('story',{}).get('chapter',0), '생애 사건': len((life or {}).get('story',{}).get('records',[])), '미래 마을': (life or {}).get('story',{}).get('world',{}).get('localEconomy',''), '지금 실천할 계획': life['plan'] if life else '',
                     '소감': r.get('reflection', ''), '연동': ('재시도 대기' if status['attempts'] else '전송 대기') if status['pending'] else '전송 완료'})
    st.dataframe(rows, use_container_width=True)
    counts = Counter(d['choice'] for r in records for d in r['diary'])
    if counts: st.bar_chart(dict(counts))
    if records:
        chosen = st.selectbox('학습 과정 살펴보기', range(len(records)), format_func=lambda i: records[i]['id'][:8])
        record = records[chosen]
        core = record.get('life', {})
        st.dataframe([{'이야기': d.get('title',''), '선택': d.get('choice',''), '결과': d.get('consequence',''), '학습 내용': d.get('concept',''), '선택 이유': core.get('coreReasons', {}).get(d['id'], ''), '실천 계획': core.get('corePlans', {}).get(d['id'], '')} for d in record['diary']], use_container_width=True)
        if record.get('life'):
            life = record['life']
            st.write('활동 선택과 그 이유')
            st.dataframe([{'날짜': h.get('day', ''), '활동': h.get('title',''), '선택': h.get('choice',''), '이유': h.get('reason',''), '결과': h.get('consequence',''), '학습 내용': h.get('concept',''), '계획': h.get('plan','')} for h in life['history']], use_container_width=True)
            if life['events']:
                st.write('변화에 대응한 과정')
                st.dataframe([{'날짜': h.get('day',''), '사건': h.get('title',''), '선택': h.get('choice',''), '이유': h.get('reason',''), '결과': h.get('consequence','')} for h in life['events']], use_container_width=True)
        life_story=core.get('story', {})
        if life_story.get('records'):
            st.write('v4 · 15~65세 생애 선택 연표')
            st.dataframe([{'나이': r.get('age',''), '사건': r.get('title',''), '선택': r.get('choice',''), '결과': r.get('result','')} for r in life_story['records']],use_container_width=True)
            st.write('미래 마을 지표')
            st.dataframe([{'사회 지표': {'populationVitality':'인구 활력','familySupport':'가족·돌봄 지원','localEconomy':'지역 경제','communityTrust':'공동체 신뢰','environment':'환경 상태','socialSafetyNet':'사회 안전망'}.get(k,'기타 지표'), '상태':v} for k,v in life_story.get('world',{}).items()], use_container_width=True)
            st.write('65세 성찰: '+(life_story.get('reflection') or '미작성'))
        st.write(record.get('reflection', '') or '아직 소감이 작성되지 않았습니다.')
    st.stop()

component = components.declare_component('seorabeol_rpg', path=str(ROOT/'components/rpg_game'))
event = component(ack=st.session_state.get('ack'), restore=st.session_state.get('restore'), restoreNonce=st.session_state.get('restore_nonce'), key='diary_game', default=None)
if isinstance(event, dict):
    state = event.get('state', {})
    if not isinstance(state, dict): state = {}
    signature = (event.get('action'), state.get('revision'), event.get('nonce'), state.get('id'))
    if signature != st.session_state.get('last_event'):
        try:
            cloud_failed = False
            try: cloud = sheets()
            except Exception: cloud = None; cloud_failed = True
            if event.get('action') == 'save':
                revision = db.save(state)
                db.flush(cloud)
                sync = db.sync_status(state['id'])
                st.session_state.ack = {'id': state['id'], 'revision': revision,
                                        'cloud': cloud is not None and not sync['pending'],
                                        'sync': 'failed' if cloud_failed or sync['attempts'] else ('pending' if cloud else 'local'),
                                        'retryAt': sync['retryAt']}
            elif event.get('action') == 'restore':
                s = db.restore(event['id'], event['token'])
                if cloud:
                    try:
                        remote = cloud.restore(event['id'], event['token'])
                        if remote and (not s or remote['revision'] > s['revision']): s = remote
                    except Exception: cloud_failed = True
                if s: db.save(s)
                st.session_state.restore = s or {}
                st.session_state.restore_nonce = event['nonce']
                st.session_state.restore_warning = cloud_failed and not s
            else: raise ValueError('Unknown action')
            st.session_state.last_event = signature
            st.rerun()
        except (ValueError, PermissionError, KeyError, TypeError):
            st.warning('저장 요청을 확인하지 못했습니다. 기기 저장 파일을 내려받아 보관하세요.')
        except Exception:
            st.warning('서버 연결이 원활하지 않습니다. 기기 저장 파일을 보관하고 다시 시도하세요.')

ack = st.session_state.get('ack', {})
if ack.get('sync') == 'failed': st.info('서버 저장은 완료됐지만 Google Sheets 전송을 기다리고 있습니다. 다음 저장 때 자동으로 재시도합니다. 기기 저장 파일도 보관하세요.')
elif ack.get('sync') == 'local': st.caption('현재 기기와 서버에 저장합니다. Google Sheets가 연결되지 않아 서버 초기화 후 복구에는 기기 저장 파일이 필요합니다.')
if st.session_state.get('restore_warning'): st.warning('Google Sheets에서 복구하지 못했습니다. 연결을 확인한 뒤 다시 시도하거나 기기 저장 파일을 불러오세요.')
st.caption('서라벌여중 · 미래 다이어리 | 기기 자동 저장 / 서버 체크포인트 | 실제 학교 배치는 추가 확인이 필요합니다.')

