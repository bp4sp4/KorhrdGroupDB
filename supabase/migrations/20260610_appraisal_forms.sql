-- 인사고과표 (appraisal_forms)
-- 인사고과 규정(26.07.01) + 고과 양식 xlsx 기반.
-- 열람: 전직원 / 수정: 경영실장(직책) 또는 master-admin — API 레이어에서 차단.

-- 1) '경영실장' 직책 추가 (없을 때만)
INSERT INTO positions (name, sort_order)
SELECT '경영실장', COALESCE((SELECT MAX(sort_order) FROM positions), 0) + 1
WHERE NOT EXISTS (SELECT 1 FROM positions WHERE name = '경영실장');

-- 2) 인사고과표 테이블
CREATE TABLE IF NOT EXISTS appraisal_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  form_data JSONB NOT NULL DEFAULT '{}',
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION appraisal_forms_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appraisal_forms_updated_at_trigger ON appraisal_forms;
CREATE TRIGGER appraisal_forms_updated_at_trigger
  BEFORE UPDATE ON appraisal_forms
  FOR EACH ROW
  EXECUTE FUNCTION appraisal_forms_set_updated_at();

-- 서비스 롤(API)만 접근 — 클라이언트 직접 접근 차단
ALTER TABLE appraisal_forms ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE appraisal_forms IS '인사고과표 양식 — 경영실장만 수정 가능 (API에서 직책 검사)';

-- 3) 기본 양식 시드 (고과 양식 xlsx 그대로)
INSERT INTO appraisal_forms (title, form_data)
SELECT
  '2025년 하반기 인사고과표',
  '{
    "team": {
      "title": "팀역량평가서",
      "managingDept": "경영지원본부",
      "indicatorName": "팀역량평가서",
      "method": "[측정산식]\n\n평가의 공정성 : 분야별 평가자를 세부로 나눠 공정성을 확립하며\n성과체계도의 적절성 : 정성적 평가는 점수로 환산하여 총 합 100점 만점으로 측정함.\n\n* 측정항목 : 2분야 1문항, 1문항당 50점 척도\n   ㄴ 1,2번 정량 기록에 의한 평가(고정 각50점)",
      "blocks": [
        {
          "no": 1,
          "category": "팀 역할1",
          "evaluator": "본부장\n(사업부총괄)",
          "indicators": [
            { "text": "팀 목표 대비 실제 매출 달성률" },
            { "text": "팀 목표 대비 실제 등록률" },
            { "text": "팀 KPI 달성률" },
            { "text": "팀 환불 건수" },
            { "text": "팀 근태관리" }
          ]
        },
        {
          "no": 2,
          "category": "팀 역할2",
          "evaluator": "본부장\n(사업부총괄)",
          "indicators": [
            { "text": "팀 내 업무 절차가 문서화되어 있고 체계적으로 운영되는가" },
            { "text": "팀원 간 정보 공유와 협업이 원활하게 이루어지는가" },
            { "text": "이슈 발생 시 팀 차원에서 신속하게 대응하는가" },
            { "text": "퇴사, 갈등, 업무 공백 없이 안정적으로 운영되는가" },
            { "text": "신입 또는 신규 구성원이 빠르게 적응할 수 있는 환경을 제공하는가" }
          ]
        },
        {
          "no": 3,
          "category": "팀 역할3",
          "evaluator": "본부장\n(사업부총괄)",
          "indicators": [
            { "text": "특정 인원 부재 시에도 업무가 정상적으로 진행되는가" },
            { "text": "업무 효율화를 위한 개선 활동을 지속적으로 수행하는가" },
            { "text": "회사 규정 및 프로세스를 팀 단위로 준수하는가" },
            { "text": "타 부서와의 업무 협조가 원활한가" },
            { "text": "팀장이 조직을 효과적으로 관리하고 있는가" }
          ]
        },
        {
          "no": 4,
          "category": "공통\n팀역량",
          "evaluator": "본부장\n(사업부총괄)",
          "indicators": [
            { "text": "팀 목표가 구성원들에게 명확하게 공유되는가" },
            { "text": "긍정적인 조직문화 형성에 기여하는가" },
            { "text": "긴급 상황 발생 시 팀 단위 대응이 가능한가" },
            { "text": "업무 노하우, DB, 매뉴얼 등을 축적하고 있는가" },
            { "text": "교육, 스터디, 업무 개선 등 지속적인 발전 활동을 하는가" }
          ]
        }
      ],
      "unit": "점",
      "cycle": "분기별",
      "registerCycle": "년 4회",
      "evidence": "",
      "target": "학점은행제 사업부 - 학사운영팀",
      "usage": "성과급 반영 및 개별 승진 점수환산 반영",
      "note": "* 본 지표는 해당 팀이 제시하는 사업계획의 타당성 평가 용도로 활용될 수 있음"
    },
    "personal": {
      "title": "개인역량평가서",
      "managingDept": "경영지원본부",
      "indicatorName": "개인역량평가서",
      "method": "[측정산식]\n\n평가의 공정성 : 분야별 평가자를 세부로 나눠 공정성을 확립하며\n성과체계도의 적절성 : 정성적 평가는 점수로 환산하여 총 합 100점 만점으로 측정함.\n\n* 측정항목 : 2분야 1문항, 1문항당 50점 척도\n   ㄴ 1,2번 정량 기록에 의한 평가(고정 각50점)",
      "blocks": [
        {
          "no": 1,
          "category": "정량평가",
          "evaluator": "경영지원본부\n상위 담당자",
          "indicators": [
            { "text": "목표 대비 실제 매출 달성률", "evalType": "절대평가" },
            { "text": "목표 대비 실제 등록률", "evalType": "절대평가" },
            { "text": "배정 DB수", "evalType": "상대평가" },
            { "text": "환불 건수", "evalType": "절대평가" },
            { "text": "근태관리", "evalType": "절대평가" }
          ]
        },
        {
          "no": 2,
          "category": "정성평가",
          "evaluator": "상위 담당자",
          "indicators": [
            { "text": "업무를 정확하고 책임감 있게 수행하는가" },
            { "text": "업무를 효율적으로 처리하고 생산성을 높이는가" },
            { "text": "문제 발생 시 적절하게 해결하는가" },
            { "text": "맡은 업무를 끝까지 수행하는가" },
            { "text": "동료와 원활하게 협업하는가" }
          ]
        },
        {
          "no": 3,
          "category": "정성평가",
          "evaluator": "상위 담당자",
          "indicators": [
            { "text": "업무 개선 및 효율화를 위한 아이디어를 제안하고 실행하는가" },
            { "text": "조직 목표 달성에 기여하는가" },
            { "text": "갈등 상황을 원만하게 해결하는가" },
            { "text": "리더십을 발휘하여 조직을 이끄는가" },
            { "text": "필요한 사항을 적시에 보고하는가" }
          ]
        },
        {
          "no": 4,
          "category": "정성평가",
          "evaluator": "상위 담당자",
          "indicators": [
            { "text": "원활하게 의사소통하는가" },
            { "text": "피드백을 수용하고 개선하는가" },
            { "text": "회사 규정 및 절차를 준수하는가" },
            { "text": "AI 및 디지털 도구를 적극 활용하는가" },
            { "text": "신규 업무나 변화하는 환경에 능동적으로 적응하는가" }
          ]
        }
      ],
      "unit": "점",
      "cycle": "분기별",
      "registerCycle": "년 4회",
      "evidence": "",
      "target": "한평생그룹 전직원 대상",
      "usage": "성과급 반영 및 개별 승진 점수환산 반영",
      "note": "* 본 지표는 해당 팀이 제시하는 사업계획의 타당성 평가 용도로 활용될 수 있음"
    }
  }'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM appraisal_forms);
