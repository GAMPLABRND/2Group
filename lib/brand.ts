// 시스템 표기 상수. 공유 파일이므로 오케스트레이터만 수정한다.
// 시스템 제목은 "CSV실습과정 [조번호]조 [시스템명]" 형식으로 고정한다. 브라우저 탭, 로그인 화면, 상단바, 대시보드 제목에 같은 값이 쓰인다.
// STEP 2 에서 TEAM_NO(URS 표지 또는 §1.1 의 "N조") 와 SYSTEM_NAME(URS 의 시스템명, 짧게) 만 바꾼다. APP_NAME 의 형식은 바꾸지 않는다.
// CI 와 문구는 design.md 2절, 9절을 따른다.

export const ORG_NAME = "한국제약바이오협회";
export const COURSE_NAME = "CSV실습과정";        // 고정 접두어
export const TEAM_NO = "1";                       // 조 번호 (URS 표지의 "N조". URS 에 없으면 조별 폴더명 team0N 의 N, 그것도 없으면 1 로 두고 DECISIONS.md 에 기록)
export const SYSTEM_NAME = "GMP 교육 시스템";     // URS 의 시스템명 (예: 전자로그북, 세척밸리데이션 관리, 실험실 재고관리). 자리표시 기본값
export const APP_NAME = `${COURSE_NAME} ${TEAM_NO}조 ${SYSTEM_NAME}`;
export const APP_SUBTITLE = "AI 바이브코딩 기반 데이터 완전성 및 CSV 실습";
export const CI_SRC = "/kpbma-ci.png";            // 파란 원본 (흰 바탕, 로그인 화면, 인쇄물)
export const CI_WHITE_SRC = "/kpbma-ci-white.png"; // 흰색 버전 (네이비 상단바)
export const FOOTER_NOTICE = "본 시스템은 CSV 실습 교육을 위한 교육용 목업 시스템입니다.";
export const FOOTER_COPYRIGHT = "한국제약바이오협회 CSV 실습과정. AI 바이브코딩 기반 데이터 완전성 및 CSV 교육";
export const INITIAL_PASSWORD = "1234";           // 첫 빌드 시 모든 시드 계정의 비밀번호 (QA 편의). 배포 전 변경
export const INITIAL_PASSWORD_NOTICE = `초기 비밀번호는 ${INITIAL_PASSWORD} 입니다. 배포 전에 비밀번호 변경 화면에서 바꿉니다.`;
