---
name: opendataloader-pdf
description: PDF 문서를 Markdown으로 변환하는 범용 스킬. PDF 파일을 읽어야 할 때 자동으로 opendataloader-pdf를 설치하고 변환한다.
license: MIT
---

# OpenDataLoader PDF

PDF 파일을 Markdown으로 변환하는 범용 도구. **PDF를 읽어야 하는 모든 상황에서 사용한다.**

## 언제 사용하는가

- PDF 파일의 내용을 분석해야 할 때
- PDF 문서를 다른 문서에 인용/참조해야 할 때
- 사용자가 PDF 파일 경로를 제공했을 때
- 디렉토리를 탐색하다 PDF 파일을 발견했을 때

> Claude Code의 Read 도구도 PDF를 직접 읽을 수 있지만(최대 20페이지), 표가 복잡하거나 페이지가 많은 PDF는 opendataloader-pdf로 변환하는 것이 정확하다.

## 실행 절차

### Step 1: 설치 확인 및 자동 설치

```bash
opendataloader-pdf --version 2>/dev/null || pip install -U opendataloader-pdf
```

설치 전제 조건:
- Java 11+: `java -version`
- Python 3.10+: `python --version`

### Step 2: 변환

```bash
# 단일 파일
opendataloader-pdf "파일.pdf" -o "출력경로/" -f markdown

# 여러 파일
find "폴더/" -name "*.pdf" -exec opendataloader-pdf {} -o "출력경로/" -f markdown \;
```

### Step 3: 변환된 Markdown 읽기

Read 도구로 변환된 `.md` 파일을 읽는다.

## 출력 포맷 옵션

| 포맷 | 용도 |
|------|------|
| `markdown` | 텍스트 분석, LLM 입력 (기본 권장) |
| `json` | 바운딩 박스 포함 구조화 데이터 |
| `html` | 웹 표시용 |

## 주의사항

- 이미지만 있는 PDF(스캔 문서)는 OCR 필요 → `pip install -U "opendataloader-pdf[hybrid]"`
- 변환 실패 시 Claude Code Read 도구로 직접 읽기 (fallback)
- 민감정보 포함 PDF → `--sanitize` 옵션 사용
