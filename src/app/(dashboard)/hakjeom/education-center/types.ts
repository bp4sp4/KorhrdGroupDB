export type EduStudentStatus = '등록' | '사회복지사-실습예정' | '수료' | '환불' | '삭제예정';
export type EducationLevel = '고졸' | '2년제중퇴' | '2년제졸업' | '3년제중퇴' | '3년제졸업' | '4년제중퇴' | '4년제졸업';
export type DesiredDegree = '학사 X' | '전문학사' | '전문학사(타전공)' | '학사' | '학사(타전공)';

export interface EduEducationCenter {
  id: number;
  name: string;
  created_at: string;
}

export interface EduCourse {
  id: number;
  name: string;
  created_at: string;
}

export interface EduStudent {
  id: string;
  name: string;
  phone: string | null;
  education_level: EducationLevel | null;
  major: string | null;
  desired_degree: DesiredDegree | null;
  status: EduStudentStatus;
  course_id: number | null;
  manager_name: string | null;
  cost: number | null;
  class_start: string | null;
  target_completion_date: string | null;
  education_center_name: string | null;
  all_care: boolean;
  notes: string | null;
  registered_at: string;
  created_at: string;
  updated_at: string;
  edu_courses?: EduCourse | null;
}

export interface EduStudentFormData {
  name: string;
  phone: string;
  education_level: EducationLevel | '';
  major: string;
  desired_degree: DesiredDegree | '';
  status: EduStudentStatus;
  course_id: number | '';
  manager_name: string;
  cost: string;
  class_start: string;
  target_completion_date: string;
  education_center_name: string;
  all_care: boolean;
  notes: string;
}

export interface EduMonthlyEnrollment {
  month: string;
  count: number;
}
