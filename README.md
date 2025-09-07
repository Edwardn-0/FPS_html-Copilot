
# Block FPS Online v0.9 (Render-Ready)

이 프로젝트는 **클라이언트(브라우저)**와 **Node.js WebSocket 서버**를 단일 웹 서비스로 배포하도록 보강되었습니다.

## 실행 방법

### 1) 로컬
```bash
npm install
# 로컬은 8080 포트로 기동됩니다 (PORT 미설정 시).
node server.js
# http://localhost:8080 (WebSocket: ws://localhost:8080/ws)
```

### 2) Render 배포 (Web Service)
1. 저장소를 GitHub에 푸시
2. Render 대시보드 → **New > Web Service**
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. (권장) Health Check Path: `/healthz`
6. (선택) 환경변수
   - `NODE_ENV=production`
   - `ALLOWED_ORIGINS=https://<서비스>.onrender.com`

> 참고: Render 웹 서비스는 **0.0.0.0 + PORT(기본 10000)** 에 바인드해야 하며, 브라우저는 `wss://<서비스>/ws`로 접속합니다. Health Check를 설정하면 무중단 배포/자동복구에 유리합니다. [Render Web Services](https://render.com/docs/web-services), [Health Checks](https://render.com/docs/health-checks).

## 변경 사항 요약
- `server.js`: Express 정적 서빙 + `/ws` WebSocket (WSS 자동), `/healthz`, ping/pong 하트비트, 오리진 화이트리스트, 페이로드 제한
- `index.html`: WebSocket 엔드포인트를 동적으로 계산(`window.WS_ENDPOINT`), 로컬/배포 모두 자동 대응
- `README.md`: 배포 가이드 추가

## 라이선스
프로토타입/교육용. 실제 서비스용으로는 인증/권한/보안 강화를 반드시 수행하세요.

참고 문서: [WebSocket API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
