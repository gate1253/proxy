# Node.js 런타임 기반 이미지 사용
FROM node:18-slim

# 작업 디렉토리 설정
WORKDIR /app

# package.json 및 package-lock.json 복사 및 의존성 설치
COPY package*.json ./
RUN npm install

# 애플리케이션 소스 코드 복사
COPY index.js ./

# Cloud Run은 PORT 환경 변수를 사용합니다.
# functions-framework는 기본적으로 8080 포트를 사용합니다.
ENV PORT 8080

# 애플리케이션 시작 명령어
# functions-framework를 사용하여 'proxy' 함수를 실행합니다.
CMD ["npm", "start"]
