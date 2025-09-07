# Block FPS Online

**Block FPS Online**은 브라우저에서 실행되는 1인칭 슈팅(FPS) 게임으로, Node.js 기반 WebSocket 서버를 통해 실시간 멀티플레이를 지원합니다. 플레이어는 방을 생성하거나 참가하여 데스매치 또는 점령전 모드에서 경쟁할 수 있습니다.

## 주요 특징
- **Three.js 기반 3D FPS 게임**
- **WebSocket을 통한 실시간 멀티플레이**
- **방 생성 및 참가 기능**
- **데스매치 / 점령전 모드 지원**
- **간단한 룸 설정 (목표 킬 수, 제한 시간 등)**
- **재장전, 리스폰, 점수판 등 기본 FPS 기능 포함**

## 게임 방법
1. 게임을 실행하면 닉네임, 캐릭터 색상, 방 이름 등을 설정할 수 있습니다.
2. `방 만들기` 또는 `방 참가`를 선택합니다.
3. 방장이 설정을 마치고 `게임 시작`을 누르면 게임이 시작됩니다.
4. 플레이어는 WASD로 이동하고 마우스로 조준/사격합니다.
5. 목표 킬 수 또는 제한 시간이 충족되면 게임이 종료됩니다.

## 조작법
- `W/A/S/D`: 이동
- 마우스 좌클릭: 사격
- `R`: 재장전
- `N`: 맵 리빌드 요청
- `ESC`: 마우스 포인터 잠금 해제

## 실행 방법
### 로컬 실행
```bash
npm install
node server.js
# http://localhost:8080 에서 접속
```

### Render 배포
1. GitHub 저장소에 푸시
2. Render 대시보드 → New > Web Service
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. Health Check Path: `/healthz`
6. 환경변수 설정 (선택)
   - `NODE_ENV=production`
   - `ALLOWED_ORIGINS=https://<서비스>.onrender.com`

## 기술 스택
- **클라이언트**: HTML, CSS, JavaScript, Three.js, PointerLockControls
- **서버**: Node.js, ws (WebSocket)

## 주의사항
- 이 서버는 데모용으로 제작되었으며, 실제 서비스에서는 인증, 보안, 데이터 검증 등의 추가 구현이 필요합니다.

