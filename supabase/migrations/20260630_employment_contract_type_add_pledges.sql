-- 전자계약 양식에 서약서·동의서 4종 추가
-- privacy: 개인정보 수집·이용 및 제공 동의서
-- ethics : 보안/윤리 강령 서약서
-- nda    : 비밀유지서약서
-- pledge : 입사서약서
ALTER TYPE employment_contract_type ADD VALUE IF NOT EXISTS 'privacy';
ALTER TYPE employment_contract_type ADD VALUE IF NOT EXISTS 'ethics';
ALTER TYPE employment_contract_type ADD VALUE IF NOT EXISTS 'nda';
ALTER TYPE employment_contract_type ADD VALUE IF NOT EXISTS 'pledge';
