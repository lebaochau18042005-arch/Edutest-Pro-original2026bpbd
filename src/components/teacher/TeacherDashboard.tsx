import React from "react";
import { ExamShuffler } from "./ExamShuffler";
import { QuestionBankView } from "./QuestionBankView";
import { MonitoringAndHistory } from "./MonitoringAndHistory";
import { AIGraderView } from "./AIGraderView";
import { MatrixManagerView } from "./MatrixManagerView";
import { Question, ExamPackage, StudentSubmission, TeacherTab } from "../../types";

interface TeacherDashboardProps {
  currentTab: TeacherTab;
  setTeacherTab: (tab: TeacherTab) => void;
  questionBank: Question[];
  submissions: StudentSubmission[];
  exams?: ExamPackage[];
  onAddQuestion: (q: Question) => void;
  onAddMultipleQuestions: (qList: Question[]) => void;
  onDeleteQuestion: (id: string) => void;
  onPublishExam: (pkg: ExamPackage) => void;
  onUnlockStudent: (submissionId: string) => void;
  onOpenStudentExam: (examId: string, examCode: string) => void;
  onRefreshData: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  currentTab,
  setTeacherTab,
  questionBank,
  submissions,
  exams = [],
  onAddQuestion,
  onAddMultipleQuestions,
  onDeleteQuestion,
  onPublishExam,
  onUnlockStudent,
  onOpenStudentExam,
  onRefreshData,
}) => {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {currentTab === "shuffler" && (
        <ExamShuffler
          questionBank={questionBank}
          onPublishExam={onPublishExam}
          onOpenStudentExam={onOpenStudentExam}
        />
      )}

      {currentTab === "bank" && (
        <QuestionBankView
          questions={questionBank}
          onAddQuestion={onAddQuestion}
          onAddMultipleQuestions={onAddMultipleQuestions}
          onDeleteQuestion={onDeleteQuestion}
          onTransferToShuffler={(selected) => {
            setTeacherTab("shuffler");
          }}
        />
      )}

      {currentTab === "monitoring" && (
        <MonitoringAndHistory
          submissions={submissions}
          exams={exams}
          questionBank={questionBank}
          onUnlockStudent={onUnlockStudent}
          onRefreshData={onRefreshData}
        />
      )}

      {currentTab === "grader" && (
        <AIGraderView
          exams={exams}
          questionBank={questionBank}
          onOpenStudentExam={onOpenStudentExam}
        />
      )}

      {currentTab === "matrix" && (
        <MatrixManagerView questions={questionBank} />
      )}
    </main>
  );
};

