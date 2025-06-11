#!/bin/bash
# publish.sh

# 1. 버전 업 (patch, minor, major 중 선택 가능)
VERSION=$(npm version patch)

# 2. Git add & 커밋
git add .
git commit -m "Release $VERSION"

# 3. Git 푸시 + 태그 푸시
git push origin main --tags

# 4. NPM 배포
npm publish
