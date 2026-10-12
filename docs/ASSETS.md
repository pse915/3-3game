# 에셋 제작 기록

제작일: 2026-10-10. 모든 생성에는 내장 imagegen 도구를 사용했습니다. 별도 API/CLI와 외부 게임 에셋은 사용하지 않았습니다. 생성 PNG 원본은 `components/rpg_game/assets/*-source.png`로 보존했습니다. 타일은 `build_world.py`, UI 원본은 `tools/build_ui.py`로 제작했습니다.

`tools/normalize_assets.py`는 포함된 원본을 정수 프레임으로 자르고 nearest-neighbor로 정규화합니다. 캐릭터는 알파값 128을 경계 계산 기준으로 사용하며 원래 알파 채널은 유지합니다. 발 위치를 일정한 셀 기준점으로 정렬했습니다. NPC 생성 결과는 요청한 6×6이 아닌 7열 배치였으므로 육안 확인 후 완전하게 포함된 첫 5행, 총 35개만 추출했습니다. 잘린 마지막 행은 게임에 사용하지 않습니다.

실제 게임 적용 파일, 크기, SHA-256, 프레임 규칙은 `assets/manifest.json`에 있습니다. 생성 원본은 실행 시 로드하지 않습니다. 초상화는 NPC 원본의 상반신을 별도 PNG 시트로 가공한 것입니다. 표정별 독립 세트는 아직 없습니다.

## 사용한 최종 생성 프롬프트

### 환경 아틀라스

Create an original production game sprite atlas for a polished cozy Korean school life top-down 32px tile RPG. Transparent background. Exactly 4 columns x 4 rows of equal 256x256 cells on a 1024x1024 image, no gutters, NO TEXT, no grid lines. Each isolated object centered in its own cell, no overlapping cells, base near bottom of cell. Crisp richly detailed pixel art, 3/4 overhead orthographic RPG perspective, limited warm muted sage, plum, brick red, cream palette, consistent upper-left light and pixel density. Row 1: leafy broad tree; pink flowering tree; detailed wooden school desk and chair; book-filled double bookcase. Row 2: brick school facade modular section with two floors of windows; green school entry doors with brick arch; blue-roof cozy cafe storefront with striped awning; cream and sage clinic storefront. Row 3: fountain stone basin blue water; wooden park bench and flowers; classroom chalkboard on wall with chalk and ledge; large potted plant. Row 4: cafe counter with espresso machine mugs cake and shelves; science laboratory table with microscope glassware; personal computer workstation; diary book open with ribbon. Original commercial-quality 16-bit pixel assets, not flat icons, not simplistic geometric placeholders. All objects fully inside cell, alpha transparent surrounding.

### 플레이어 시트

Original transparent pixel RPG player sprite sheet, production asset, exactly 8 columns by 4 rows, equal cells, image 1024x768. Each cell 128x192. A Korean middle-school girl, brown bob hair, cream cardigan, plum skirt, dark shoes, mint satchel. Finely detailed charming 16-bit pixel art, natural 3-head-tall proportions, consistent overhead RPG view. Each sprite fits inside cell centered horizontally feet baseline at 88% cell height, character occupies 70% width and 80% height, never touches cells. Row1 facing DOWN/front, row2 facing LEFT, row3 facing RIGHT, row4 facing UP/back. First 4 columns four sequential distinct walking frames, last 4 columns four distinct running frames with larger leg and arm stride. Proper views not identical front poses. Clean precisely aligned grid, NO borders NO labels NO text NO background ground. Sharp solid pixel clusters, no blur, no shadow outside sprite. All 32 cells populated.

### NPC 시트

Original production pixel RPG NPC sprite atlas with exactly 6 columns x 6 rows, 36 distinct full body front-facing characters, evenly spaced in equal cells on transparent background. Each centered, feet at same relative baseline. No text labels no grid no props between characters. Detailed crisp 16-bit JRPG character sprite art, 3-head-tall human proportions, consistent warm Korean cozy school RPG style, light from upper left. First 3 rows: 18 distinct ADULT Korean teachers with varied short/long hair, glasses, cardigans, blouses, shirts, trousers, skirts, scarves, holding different small books or notebooks; no student uniforms. Last 3 rows: 18 diverse residents with young adults in workwear, cafe aprons, healthcare scrubs, elderly women and men with gray hair, a community gardener, craft artist, office workers, parent, librarian. Readable unique silhouettes, refined shading, natural faces and limbs, plum sage cream ochre muted colors. Actual isolated sprites suitable to crop to 32x48 or 48x64. Every character inside its cell without overlap, alpha background, no scenery, no ground shadow.

### 마을 건물

An ORIGINAL game-ready transparent atlas of 16 DIFFERENT cozy Korean town buildings in exact 4 columns x 4 rows, equal 256px square cells, 1024x1024 PNG. Fully isolated one building per cell, no overlap and no text. Detailed crisp PIXEL ART with visible square pixel clusters, overhead 3/4 top-down RPG orthographic view with clearly visible ROOFS, natural scale, warm muted cream brick sage lavender. Row1: two story blue roof cafe striped awning; civic career center with terracotta roof; 3 story apartment building balconies; one story childcare center green courtyard. Row2: elderly welfare community center garden; arts workshop lilac roof and pottery; town hall with clock and broad steps; small future home mint roof flower garden. Row3: hospital white and teal with cross; library with slate roof and books in window; bakery peach facade with bread display; small gift shop green awning. Row4: modern office building; kindergarten yellow roof; shared housing building with terrace; convenience store cream-red sign without text. Highly distinct silhouettes and architecture, shaded roofs with tile details, window reflections, plants, steps. No people, no scenery outside each cell, NO drop shadows crossing cell boundaries. All 16 cells filled. Professional pixel RPG buildings, not flat vector, not photoreal.

### 학교 외관

Original production pixel RPG building sprite of a FOUR-STORY Korean girls middle school, reddish brown brick walls, cream window frames, exactly four rows of repeated classroom windows, central glass entrance with green framing. L-shaped floor plan: long main wing horizontally, LEFT wing turns 90 degrees and extends toward back/top of image. Orthographic 3/4 overhead RPG perspective, visible gray flat roof, correct consistent perspective, finely shaded brickwork, rooftop railings and a subtle small clock. A few plants along foundation. Isolated complete school building on TRUE transparent background. Wide landscape composition whole building fully inside canvas, no ground plane no sky no people no text no title no labels, no UI. Original detailed cozy pixel art with visible pixel clusters, NOT realistic photograph, no smoothing. Professional refined 32px tile RPG art direction in brick, warm cream, sage, muted slate. This is a fictionalized provisional architecture sprite based only on these supplied features, not a claim of exact reconstruction.

### 실내 가구

Production transparent sprite atlas, original cozy top-down PIXEL RPG interior furniture. Exactly 4 columns x 4 rows equal square cells on 1024x1024, each object fully inside own cell, evenly aligned. Crisp detailed 16-bit pixel clusters, orthographic 3/4 overhead perspective (see surfaces), warm sage cream oak plum, upper-left lighting. NO text NO grid NO scenery NO people. Row1: round cafe table with two upholstered chairs and coffee mugs; green sofa with cushions; neat single bed with cream blanket; wooden kitchen worktop with sink and cooking hob. Row2: piano with music stand and stool; wooden art easel with landscape painting; school blue metal lockers; classroom wall window with cream curtains and sunlight. Row3: hospital bed with compact monitor; toddler play carpet with toys and low shelf; library reading table with books and chairs; supermarket stocked grocery shelf. Row4: notice board with pinned papers; potted flowering shrub in rectangular planter; tall brass streetlamp with warm lantern; school science equipment cabinet. Finely crafted readable silhouettes and intricate shading. No cut off cells. Original not based on existing game assets.

프롬프트의 “commercial-quality” 등은 생성 목표 표현이며 달성 판정이 아닙니다. 실제 참고 이미지 대조와 추가 픽셀 정제는 미완료입니다. 실제 교사의 얼굴이나 성격을 재현한 것이 아닌 교육용 가상 아바타입니다.


## 2026-10-11 추가 제작 및 실제 적용

- facilities-source.png → facilities.png: 4×4 16개 시설. 변기, 개별 칸, 거울·세면대·수도·비누, 배수구, 위생 휴지통, 휴지함, 환기창, 청소함, 조리대, 냉장고, 재봉틀, 공구 작업대, 공구함, 보면대, 악기 수납장, 미술 건조대.
- details-source.png → details.png: 4×4 16개 보조 시설. 교탁, 시계, 안전함, 복사기, 의료 가림막, 체중계, 대출대, 도서 카트, 회의 테이블, 운동 기구, 그림책 수납장, 서류함, 경사로, 텃밭, 울타리, 안내소.
- 생성 지시: 독창적인 한국 학교 픽셀 RPG, 투명 배경, 4열 4행 균일 셀, 같은 위쪽 시점과 왼쪽 광원, 크림·세이지·목재·자주 팔레트, 글자·격자·인물 없이 각 시설을 분리 배치. 내장 imagegen으로 새로 생성했습니다.
- 원본 각각 1280×1280을 1024×1024 아틀라스로 최근접 정규화했습니다. clean_atlas.py는 작은 분리 알파 조각만 제거합니다. 원본은 수정하지 않습니다.
- game.js의 drawAsset에서 49~64, 65~80번을 각각 두 PNG에서 읽고 world_v2.py의 공간별 가구에 적용합니다. 실제 화장실·가정실·음악실·기술실 화면으로 확인했습니다.

새 에셋 생성과 적용은 확인했으나 사용자 참고 이미지와의 품질 대조는 아직 불가능합니다.
