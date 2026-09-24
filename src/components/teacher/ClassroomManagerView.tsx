import React, { useState, useRef } from "react";
import {
  Users,
  UserPlus,
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Upload,
  Download,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Search,
  Filter,
  Check,
  X,
  GraduationCap,
  Sparkles,
  ChevronRight,
  Send,
  Eye,
  Unlock,
  ShieldAlert,
  ArrowRight,
  ClipboardList,
  BarChart3,
  UserCheck,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  Classroom,
  StudentInfo,
  ClassAssignment,
  ExamPackage,
  StudentSubmission,
  GradeType,
} from "../../types";

interface ClassroomManagerViewProps {
  classrooms: Classroom[];
  onSaveClassrooms: (classes: Classroom[]) => void;
  assignments: ClassAssignment[];
  onSaveAssignments: (assignments: ClassAssignment[]) => void;
  exams: ExamPackage[];
  submissions: StudentSubmission[];
  onUnlockStudent?: (submissionId: string) => void;
  onOpenStudentExam?: (examId: string, examCode: string) => void;
  defaultSelectedExam?: ExamPackage | null;
}

export const ClassroomManagerView: React.FC<ClassroomManagerViewProps> = ({
  classrooms,
  onSaveClassrooms,
  assignments,
  onSaveAssignments,
  exams,
  submissions,
  onUnlockStudent,
  onOpenStudentExam,
  defaultSelectedExam,
}) => {
  // Navigation tabs: 'classes' | 'assignments' | 'gradebook'
  const [activeTab, setActiveTab] = useState<"classes" | "assignments" | "gradebook">("classes");

  // Selected classroom for viewing students / details
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    return classrooms.length > 0 ? classrooms[0].id : "";
  });

  // Selected assignment for viewing gradebook
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(() => {
    return assignments.length > 0 ? assignments[0].id : "";
  });

  // Modals state
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showPasteStudentsModal, setShowPasteStudentsModal] = useState(false);
  const [showAssignExamModal, setShowAssignExamModal] = useState(Boolean(defaultSelectedExam));
  const [selectedSubmissionForDetail, setSelectedSubmissionForDetail] = useState<StudentSubmission | null>(null);

  // New class form
  const [newClassName, setNewClassName] = useState("");
  const [newClassGrade, setNewClassGrade] = useState<GradeType>("Khối 12");
  const [newClassSchoolYear, setNewClassSchoolYear] = useState("2025-2026");
  const [newClassSubject, setNewClassSubject] = useState("Toán học");
  const [newClassTeacher, setNewClassTeacher] = useState("");

  // Single student form
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentId, setNewStudentId] = useState("");
  const [newStudentGender, setNewStudentGender] = useState<"Nam" | "Nữ">("Nam");
  const [newStudentDob, setNewStudentDob] = useState("");

  // Paste students raw text
  const [rawStudentsText, setRawStudentsText] = useState("");

  // Assign exam form
  const [assignExamId, setAssignExamId] = useState<string>(
    defaultSelectedExam?.id || (exams.length > 0 ? exams[0].id : "")
  );
  const [assignClassroomId, setAssignClassroomId] = useState<string>(
    selectedClassId || (classrooms.length > 0 ? classrooms[0].id : "")
  );
  const [assignDuration, setAssignDuration] = useState<number>(
    defaultSelectedExam?.config?.duration || 45
  );
  const [assignOpenTime, setAssignOpenTime] = useState<string>("");
  const [assignCloseTime, setAssignCloseTime] = useState<string>("");
  const [assignShuffleVariants, setAssignShuffleVariants] = useState<boolean>(true);
  const [assignAllowReview, setAssignAllowReview] = useState<boolean>(true);

  // Search & filter
  const [searchStudentQuery, setSearchStudentQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const currentClass = classrooms.find((c) => c.id === selectedClassId) || classrooms[0];

  // Helper: Create new class
  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) {
      showToast("Vui lòng nhập tên lớp học.");
      return;
    }

    const newClass: Classroom = {
      id: `class_${Date.now()}`,
      name: newClassName.trim().toUpperCase(),
      grade: newClassGrade,
      schoolYear: newClassSchoolYear.trim() || "2025-2026",
      subject: newClassSubject.trim() || "Toán học",
      homeroomTeacher: newClassTeacher.trim() || undefined,
      students: [],
      createdAt: new Date().toISOString(),
    };

    const updated = [newClass, ...classrooms];
    onSaveClassrooms(updated);
    setSelectedClassId(newClass.id);
    setNewClassName("");
    setNewClassTeacher("");
    setShowAddClassModal(false);
    showToast(`Đã tạo lớp ${newClass.name} thành công!`);
  };

  // Helper: Delete class
  const handleDeleteClass = (id: string, name: string) => {
    if (window.confirm(`Thầy/Cô có chắc chắn muốn xóa lớp ${name}? Dữ liệu học sinh của lớp này sẽ bị xóa.`)) {
      const updated = classrooms.filter((c) => c.id !== id);
      onSaveClassrooms(updated);
      if (selectedClassId === id && updated.length > 0) {
        setSelectedClassId(updated[0].id);
      }
      showToast(`Đã xóa lớp ${name}.`);
    }
  };

  // Helper: Add single student to current class
  const handleAddSingleStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClass) return;
    if (!newStudentName.trim()) {
      showToast("Vui lòng nhập họ và tên học sinh.");
      return;
    }

    const nextIdx = currentClass.students.length + 1;
    const generatedSbd = newStudentId.trim() || `HS${String(nextIdx).padStart(2, "0")}`;

    const newStu: StudentInfo = {
      id: `stu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      studentId: generatedSbd,
      name: newStudentName.trim(),
      gender: newStudentGender,
      dob: newStudentDob.trim() || undefined,
    };

    const updatedClasses = classrooms.map((cls) => {
      if (cls.id === currentClass.id) {
        return {
          ...cls,
          students: [...cls.students, newStu],
          updatedAt: new Date().toISOString(),
        };
      }
      return cls;
    });

    onSaveClassrooms(updatedClasses);
    setNewStudentName("");
    setNewStudentId("");
    setNewStudentDob("");
    setShowAddStudentModal(false);
    showToast(`Đã thêm học sinh ${newStu.name} vào lớp ${currentClass.name}.`);
  };

  // Helper: Delete student
  const handleDeleteStudent = (stuId: string, stuName: string) => {
    if (!currentClass) return;
    if (window.confirm(`Xóa học sinh ${stuName} khỏi danh sách lớp?`)) {
      const updatedClasses = classrooms.map((cls) => {
        if (cls.id === currentClass.id) {
          return {
            ...cls,
            students: cls.students.filter((s) => s.id !== stuId),
            updatedAt: new Date().toISOString(),
          };
        }
        return cls;
      });
      onSaveClassrooms(updatedClasses);
      showToast(`Đã xóa học sinh ${stuName}.`);
    }
  };

  // Helper: Parse pasted text (each line is a student)
  const handleParsePastedStudents = () => {
    if (!currentClass || !rawStudentsText.trim()) return;

    const lines = rawStudentsText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const addedStudents: StudentInfo[] = [];

    lines.forEach((line, idx) => {
      // Possible formats:
      // "1. Nguyễn Văn An - SBD01"
      // "HS1201 \t Nguyễn Văn An \t Nam \t 15/04/2008"
      // "Nguyễn Văn An"
      // "1    Nguyễn Văn An"
      let parts = line.split(/[\t,|;]+/).map((p) => p.trim()).filter(Boolean);
      let sbd = "";
      let name = "";
      let gender: "Nam" | "Nữ" | undefined = undefined;
      let dob = "";

      if (parts.length >= 2) {
        // Check if first is number or SBD
        if (/^\d+$/.test(parts[0]) && parts.length >= 3) {
          // Format: STT, SBD, Name...
          sbd = parts[1];
          name = parts[2];
          if (parts[3]) {
            if (parts[3].toLowerCase() === "nam") gender = "Nam";
            else if (parts[3].toLowerCase() === "nữ" || parts[3].toLowerCase() === "nu") gender = "Nữ";
            else dob = parts[3];
          }
        } else if (/^[A-Za-z0-9_-]+$/.test(parts[0])) {
          // Format: SBD, Name
          sbd = parts[0];
          name = parts[1];
        } else {
          name = parts[0];
          sbd = parts[1];
        }
      } else {
        // Single text line: Clean leading "1. " or "1  "
        const cleanLine = line.replace(/^\d+[\.\s\-]+/, "").trim();
        name = cleanLine || line;
      }

      if (name) {
        const studentIndex = currentClass.students.length + addedStudents.length + 1;
        addedStudents.push({
          id: `stu_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          studentId: sbd || `HS${String(studentIndex).padStart(2, "0")}`,
          name,
          gender,
          dob,
        });
      }
    });

    if (addedStudents.length === 0) {
      showToast("Không tìm thấy dữ liệu học sinh hợp lệ.");
      return;
    }

    const updatedClasses = classrooms.map((cls) => {
      if (cls.id === currentClass.id) {
        return {
          ...cls,
          students: [...cls.students, ...addedStudents],
          updatedAt: new Date().toISOString(),
        };
      }
      return cls;
    });

    onSaveClassrooms(updatedClasses);
    setRawStudentsText("");
    setShowPasteStudentsModal(false);
    showToast(`Đã thêm thành công ${addedStudents.length} học sinh vào lớp ${currentClass.name}!`);
  };

  // Helper: Download Excel sample template
  const handleDownloadSampleExcel = () => {
    const sampleData = [
      {
        "STT": 1,
        "Số Báo Danh (Mã HS)": "HS1201",
        "Họ và Tên": "Nguyễn Thành Nam",
        "Giới Tính": "Nam",
        "Ngày Sinh": "15/04/2008",
        "Ghi Chú": "Học sinh giỏi",
      },
      {
        "STT": 2,
        "Số Báo Danh (Mã HS)": "HS1202",
        "Họ và Tên": "Trần Thu Thủy",
        "Giới Tính": "Nữ",
        "Ngày Sinh": "20/08/2008",
        "Ghi Chú": "",
      },
      {
        "STT": 3,
        "Số Báo Danh (Mã HS)": "HS1203",
        "Họ và Tên": "Lê Minh Tâm",
        "Giới Tính": "Nam",
        "Ngày Sinh": "05/11/2008",
        "Ghi Chú": "",
      },
      {
        "STT": 4,
        "Số Báo Danh (Mã HS)": "HS1204",
        "Họ và Tên": "Phạm Hoàng Gia Huy",
        "Giới Tính": "Nam",
        "Ngày Sinh": "12/02/2008",
        "Ghi Chú": "",
      },
      {
        "STT": 5,
        "Số Báo Danh (Mã HS)": "HS1205",
        "Họ và Tên": "Vũ Bảo Châu",
        "Giới Tính": "Nữ",
        "Ngày Sinh": "18/04/2008",
        "Ghi Chú": "",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws["!cols"] = [
      { wch: 8 },
      { wch: 22 },
      { wch: 28 },
      { wch: 12 },
      { wch: 16 },
      { wch: 20 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh_Sach_Lop");
    XLSX.writeFile(wb, "Danh_Sach_Hoc_Sinh_Mau_EdutestPro.xlsx");
    showToast("Đã tải tệp Excel mẫu danh sách học sinh!");
  };

  // Helper: Upload & Parse Excel file
  const handleUploadExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentClass) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (!rawJson || rawJson.length === 0) {
          showToast("Tệp Excel rỗng hoặc không có dữ liệu!");
          return;
        }

        const newStudents: StudentInfo[] = [];

        rawJson.forEach((row, idx) => {
          // Look for name column
          let name =
            row["Họ và Tên"] ||
            row["Họ và tên"] ||
            row["Họ tên"] ||
            row["Họ Tên"] ||
            row["Tên"] ||
            row["FullName"] ||
            row["Name"] ||
            "";

          // If separate Họ đệm and Tên
          if (!name && (row["Họ đệm"] || row["Họ"]) && (row["Tên"] || row["Tên học sinh"])) {
            name = `${row["Họ đệm"] || row["Họ"]} ${row["Tên"] || row["Tên học sinh"]}`.trim();
          }

          if (!name) {
            // Find any column with letters
            for (const key of Object.keys(row)) {
              const val = String(row[key]).trim();
              if (key.toLowerCase().includes("tên") || key.toLowerCase().includes("name")) {
                name = val;
                break;
              }
            }
          }

          // SBD column
          let sbd =
            row["Số Báo Danh (Mã HS)"] ||
            row["Số Báo Danh"] ||
            row["Số báo danh"] ||
            row["SBD"] ||
            row["Mã HS"] ||
            row["Mã học sinh"] ||
            row["Mã định danh"] ||
            row["ID"] ||
            "";

          // Gender column
          let genderVal = row["Giới Tính"] || row["Giới tính"] || row["Gender"] || "";
          let gender: "Nam" | "Nữ" | undefined = undefined;
          if (String(genderVal).toLowerCase().includes("nam")) gender = "Nam";
          else if (String(genderVal).toLowerCase().includes("nữ") || String(genderVal).toLowerCase().includes("nu")) gender = "Nữ";

          // Dob column
          let dob = row["Ngày Sinh"] || row["Ngày sinh"] || row["DOB"] || "";
          if (typeof dob === "number") {
            // Excel serial date format
            try {
              const dateObj = new Date((dob - (25567 + 2)) * 86400 * 1000);
              dob = `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")}/${dateObj.getFullYear()}`;
            } catch {}
          }

          if (name && String(name).trim().length > 1) {
            const nextOrder = currentClass.students.length + newStudents.length + 1;
            newStudents.push({
              id: `stu_xl_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
              studentId: String(sbd).trim() || `HS${String(nextOrder).padStart(2, "0")}`,
              name: String(name).trim(),
              gender,
              dob: String(dob).trim() || undefined,
            });
          }
        });

        if (newStudents.length === 0) {
          showToast("Không nhận diện được cột Họ và Tên trong tệp Excel. Vui lòng kiểm tra lại định dạng.");
          return;
        }

        const updatedClasses = classrooms.map((cls) => {
          if (cls.id === currentClass.id) {
            return {
              ...cls,
              students: [...cls.students, ...newStudents],
              updatedAt: new Date().toISOString(),
            };
          }
          return cls;
        });

        onSaveClassrooms(updatedClasses);
        showToast(`Đã nhập thành công ${newStudents.length} học sinh từ tệp Excel vào lớp ${currentClass.name}!`);
      } catch (err: any) {
        console.error("Error parsing Excel:", err);
        showToast("Lỗi khi đọc file Excel: " + (err?.message || "Định dạng không hợp lệ"));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  // Helper: Create new assignment
  const handleAssignExamToClass = (e: React.FormEvent) => {
    e.preventDefault();
    const targetExam = exams.find((ex) => ex.id === assignExamId);
    const targetClass = classrooms.find((c) => c.id === assignClassroomId);

    if (!targetExam) {
      showToast("Vui lòng chọn đề thi để giao bài.");
      return;
    }
    if (!targetClass) {
      showToast("Vui lòng chọn lớp học nhận đề.");
      return;
    }

    const newAssignment: ClassAssignment = {
      id: `assign_${Date.now()}`,
      examId: targetExam.id,
      examTitle: targetExam.title,
      accessCode: targetExam.accessCode,
      classroomId: targetClass.id,
      classroomName: targetClass.name,
      assignedAt: new Date().toISOString(),
      openTime: assignOpenTime || undefined,
      closeTime: assignCloseTime || undefined,
      duration: Number(assignDuration) || 45,
      shuffleVariants: assignShuffleVariants,
      allowReviewAfterSubmit: assignAllowReview,
      status: "active",
    };

    const updated = [newAssignment, ...assignments];
    onSaveAssignments(updated);
    setSelectedAssignmentId(newAssignment.id);
    setShowAssignExamModal(false);
    setActiveTab("assignments");
    showToast(`Đã giao đề "${targetExam.title}" cho lớp ${targetClass.name} thành công!`);
  };

  // Helper: Delete assignment
  const handleDeleteAssignment = (assignId: string, title: string) => {
    if (window.confirm(`Xóa lượt giao bài "${title}"?`)) {
      const updated = assignments.filter((a) => a.id !== assignId);
      onSaveAssignments(updated);
      showToast(`Đã xóa lượt giao bài.`);
    }
  };

  // Helper: Export Class Gradebook to Excel
  const handleExportClassGradebook = () => {
    const currentAssignment = assignments.find((a) => a.id === selectedAssignmentId);
    if (!currentClass) return;

    const classSubs = submissions.filter(
      (s) =>
        s.studentClass === currentClass.name ||
        s.classroomId === currentClass.id ||
        (currentAssignment && (s.examId === currentAssignment.examId || s.assignmentId === currentAssignment.id))
    );

    // Build row for every student in the class roster
    const rows = currentClass.students.map((stu, idx) => {
      const sub = classSubs.find(
        (s) =>
          (s.studentId && s.studentId.toUpperCase() === stu.studentId.toUpperCase()) ||
          s.studentName.toLowerCase().trim() === stu.name.toLowerCase().trim()
      );

      let statusStr = "Chưa làm bài";
      let scoreStr = "--";
      let variantStr = "--";
      let correctStr = "--";
      let timeSpentStr = "--";
      let violationStr = "0";
      let classification = "Chưa xếp loại";

      if (sub) {
        if (sub.status === "locked" || sub.isLockedDueToCheating) {
          statusStr = "Vi phạm gian lận (Khóa)";
        } else if (sub.status === "in_progress") {
          statusStr = "Đang làm bài";
        } else {
          statusStr = "Đã nộp bài";
        }

        scoreStr = sub.score.toFixed(2);
        variantStr = sub.examCode || "101";
        correctStr = `${sub.correctCount}/${sub.totalQuestions}`;
        timeSpentStr = `${Math.round(sub.durationTakenSeconds / 60)} phút`;
        violationStr = String(sub.tabSwitchCount || 0);

        if (sub.score >= 8.0) classification = "Giỏi";
        else if (sub.score >= 6.5) classification = "Khá";
        else if (sub.score >= 5.0) classification = "Trung bình";
        else classification = "Chưa đạt / Yếu";
      }

      return {
        "STT": idx + 1,
        "Số Báo Danh": stu.studentId,
        "Họ và Tên": stu.name,
        "Giới Tính": stu.gender || "",
        "Mã Đề": variantStr,
        "Điểm Số (Thang 10)": scoreStr,
        "Số Câu Đúng": correctStr,
        "Thời Gian Làm": timeSpentStr,
        "Số Lần Thoát Tab": violationStr,
        "Trạng Thái": statusStr,
        "Xếp Loại": classification,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 26 },
      { wch: 10 },
      { wch: 10 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 18 },
      { wch: 22 },
      { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    const sheetName = `BangDiem_${currentClass.name.replace(/[^A-Za-z0-9]/g, "_")}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const fileName = `Bang_Diem_Lop_${currentClass.name}_${currentAssignment ? currentAssignment.accessCode : "EDUTEST"}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast(`Đã xuất bảng điểm lớp ${currentClass.name} ra file Excel!`);
  };

  // Filtered students in current class
  const filteredStudents = (currentClass?.students || []).filter((stu) => {
    if (!searchStudentQuery.trim()) return true;
    const q = searchStudentQuery.toLowerCase();
    return stu.name.toLowerCase().includes(q) || stu.studentId.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold border border-slate-700 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-teal-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-semibold tracking-wide">
            <GraduationCap className="w-4 h-4 text-blue-200" />
            <span>Hệ Thống Quản Lý Lớp Học & Giao Bài Chuẩn Trường Học</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Quản Lý Lớp Học & Giao Bài Theo Lớp
          </h1>
          <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
            Tạo lớp học, tải lên danh sách học sinh từ file Excel, giao đề kiểm tra trực tiếp cho từng lớp. Học sinh chỉ cần chọn tên mình từ danh sách lớp là làm bài ngay lập tức!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setShowAddClassModal(true)}
            className="flex-1 md:flex-initial px-4 py-2.5 bg-white text-blue-900 hover:bg-blue-50 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 text-blue-600" />
            <span>Tạo Lớp Mới</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (exams.length === 0) {
                showToast("Thầy/Cô chưa có đề thi nào. Hãy sang tab 'Trộn Đề' để xuất bản đề thi trước.");
                return;
              }
              setShowAssignExamModal(true);
            }}
            className="flex-1 md:flex-initial px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span>Giao Bài Cho Lớp</span>
          </button>
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("classes")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === "classes"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Danh Sách Lớp & Học Sinh ({classrooms.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("assignments")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === "assignments"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Bài Tập Đã Giao ({assignments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("gradebook")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === "gradebook"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Bảng Điểm & Báo Cáo Lớp</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: DANH SÁCH LỚP VÀ HỌC SINH */}
      {/* ============================================================== */}
      {activeTab === "classes" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Classes Sidebar List */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Các Lớp Học Hiện Có</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddClassModal(true)}
                  className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                  title="Thêm lớp mới"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tạo Lớp</span>
                </button>
              </div>

              {classrooms.length === 0 ? (
                <div className="text-center py-8 px-4 border-2 border-dashed border-slate-200 rounded-xl space-y-3">
                  <GraduationCap className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500">Chưa có lớp học nào.</p>
                  <button
                    type="button"
                    onClick={() => setShowAddClassModal(true)}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                  >
                    Tạo lớp đầu tiên
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {classrooms.map((cls) => {
                    const isSelected = cls.id === selectedClassId;
                    const assignedForThisClass = assignments.filter((a) => a.classroomId === cls.id);

                    return (
                      <div
                        key={cls.id}
                        onClick={() => setSelectedClassId(cls.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left relative group ${
                          isSelected
                            ? "bg-blue-50/80 border-blue-300 shadow-xs ring-2 ring-blue-500/20"
                            : "bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-slate-900 group-hover:text-blue-700 transition-colors">
                                Lớp {cls.name}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                {cls.grade}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                              <span>Niên khóa: {cls.schoolYear}</span>
                              {cls.subject && <span>• {cls.subject}</span>}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClass(cls.id, cls.name);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                            title="Xóa lớp này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <strong>{cls.students.length}</strong> học sinh
                          </span>

                          <span className="font-semibold text-indigo-700 flex items-center gap-1">
                            <ClipboardList className="w-3.5 h-3.5 text-indigo-500" />
                            {assignedForThisClass.length} bài giao
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Classroom Details & Student Roster */}
          <div className="lg:col-span-8 space-y-4">
            {currentClass ? (
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
                {/* Classroom Header Info */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-black text-slate-900">
                        Danh Sách Học Sinh: Lớp {currentClass.name}
                      </h2>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                        Sĩ số: {currentClass.students.length} HS
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {currentClass.grade} • Năm học: {currentClass.schoolYear}
                      {currentClass.homeroomTeacher && ` • GV: ${currentClass.homeroomTeacher}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {/* Hidden Excel input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleUploadExcel}
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      title="Tải lên tệp Excel danh sách học sinh"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Nhập Từ Excel</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadSampleExcel}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Tải tệp Excel mẫu chuẩn để điền thông tin"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-600" />
                      <span>Tải File Mẫu</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowPasteStudentsModal(true)}
                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Dán nhanh danh sách từ Word hoặc văn bản"
                    >
                      <ClipboardList className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Dán Nhanh (Text)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAddStudentModal(true)}
                      className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                      <span>Thêm 1 HS</span>
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên học sinh hoặc Số Báo Danh..."
                      value={searchStudentQuery}
                      onChange={(e) => setSearchStudentQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAssignClassroomId(currentClass.id);
                      setShowAssignExamModal(true);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Giao Đề Cho Lớp {currentClass.name}</span>
                  </button>
                </div>

                {/* Students Table */}
                {currentClass.students.length === 0 ? (
                  <div className="text-center py-12 px-6 border-2 border-dashed border-slate-200 rounded-2xl space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto text-xl font-bold">
                      👥
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        Chưa có học sinh nào trong lớp {currentClass.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        Thầy/Cô có thể tải lên file Excel (.xlsx), dán văn bản hàng loạt từ Word/Notepad, hoặc thêm từng học sinh thủ công.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Nhập Tệp Excel Ngay</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadSampleExcel}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Tải Mẫu Excel</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto max-h-[460px]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          <tr>
                            <th className="py-3 px-3 text-center w-12">STT</th>
                            <th className="py-3 px-3">Số Báo Danh</th>
                            <th className="py-3 px-4">Họ và Tên</th>
                            <th className="py-3 px-3 text-center">Giới Tính</th>
                            <th className="py-3 px-3">Ngày Sinh</th>
                            <th className="py-3 px-3 text-center">Trạng Thái Thi</th>
                            <th className="py-3 px-3 text-right">Thao Tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredStudents.map((stu, idx) => {
                            // Find student submissions for this class
                            const stuSub = submissions.find(
                              (s) =>
                                (s.studentId && s.studentId.toUpperCase() === stu.studentId.toUpperCase()) ||
                                s.studentName.toLowerCase().trim() === stu.name.toLowerCase().trim()
                            );

                            return (
                              <tr key={stu.id} className="hover:bg-blue-50/40 transition-colors">
                                <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                                  {stu.studentId}
                                </td>
                                <td className="py-2.5 px-4 font-bold text-slate-900">
                                  {stu.name}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {stu.gender ? (
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        stu.gender === "Nam"
                                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                                          : "bg-pink-50 text-pink-700 border border-pink-200"
                                      }`}
                                    >
                                      {stu.gender}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">--</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 font-mono">
                                  {stu.dob || "--"}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {stuSub ? (
                                    stuSub.status === "locked" || stuSub.isLockedDueToCheating ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                        Khóa vi phạm
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        Đã nộp: {stuSub.score.toFixed(1)}đ
                                      </span>
                                    )
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                                      Chưa làm bài
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteStudent(stu.id, stu.name)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Xóa học sinh này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs text-center">
                <p className="text-xs text-slate-500">Vui lòng chọn hoặc tạo lớp học để xem chi tiết.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: QUẢN LÝ BÀI TẬP ĐÃ GIAO */}
      {/* ============================================================== */}
      {activeTab === "assignments" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Danh Sách Bài Thi / Đề Kiểm Tra Đã Giao Cho Các Lớp
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Các bài thi đang mở hoặc đã giao cho từng lớp học. Học sinh lớp đó sẽ tự động nhìn thấy đề để làm bài.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAssignExamModal(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Giao Bài Mới Cho Lớp</span>
            </button>
          </div>

          {assignments.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-xs text-center space-y-4">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-slate-800">Chưa có bài thi nào được giao cho lớp</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Hãy chọn một đề thi đã tạo và giao cho lớp học để các em học sinh có thể truy cập làm bài ngay lập tức.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignExamModal(true)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                Tiến Hành Giao Đề Ngay
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {assignments.map((assign) => {
                const assignedClass = classrooms.find((c) => c.id === assign.classroomId);
                const classTotalStudents = assignedClass?.students.length || 0;

                // Submissions for this assignment
                const subs = submissions.filter(
                  (s) =>
                    s.assignmentId === assign.id ||
                    (s.examId === assign.examId && s.studentClass === assign.classroomName)
                );

                const submittedCount = subs.filter((s) => s.status === "submitted").length;
                const lockedCount = subs.filter((s) => s.status === "locked" || s.isLockedDueToCheating).length;

                return (
                  <div
                    key={assign.id}
                    className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                          Lớp {assign.classroomName}
                        </span>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Đang hoạt động
                        </span>
                      </div>

                      <div>
                        <h3 className="text-sm font-black text-slate-900 line-clamp-2">
                          {assign.examTitle}
                        </h3>
                        <div className="text-xs font-mono font-bold text-indigo-700 mt-1">
                          Mã đề gốc: {assign.accessCode}
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Thời lượng:
                          </span>
                          <span className="font-bold text-slate-800">{assign.duration} phút</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            Sĩ số lớp:
                          </span>
                          <span className="font-bold text-slate-800">{classTotalStudents} học sinh</span>
                        </div>

                        {assign.closeTime && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              Hạn chót:
                            </span>
                            <span className="font-bold text-rose-700">
                              {new Date(assign.closeTime).toLocaleString("vi-VN")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1 pt-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Tiến độ nộp bài:</span>
                          <span className="font-bold text-blue-700">
                            {submittedCount} / {classTotalStudents} ({classTotalStudents > 0 ? Math.round((submittedCount / classTotalStudents) * 100) : 0}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{
                              width: `${classTotalStudents > 0 ? Math.min(100, (submittedCount / classTotalStudents) * 100) : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAssignmentId(assign.id);
                          setSelectedClassId(assign.classroomId);
                          setActiveTab("gradebook");
                        }}
                        className="flex-1 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Xem Bảng Điểm</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteAssignment(assign.id, assign.examTitle)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-all cursor-pointer"
                        title="Xóa lượt giao bài này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: BẢNG ĐIỂM & TIẾN ĐỘ THEO LỚP */}
      {/* ============================================================== */}
      {activeTab === "gradebook" && (
        <div className="space-y-5">
          {/* Controls Header */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                  Chọn Lớp Học:
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {classrooms.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      Lớp {cls.name} ({cls.students.length} HS)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                  Chọn Bài Kiểm Tra:
                </label>
                <select
                  value={selectedAssignmentId}
                  onChange={(e) => setSelectedAssignmentId(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[280px]"
                >
                  <option value="">-- Tất cả bài nộp của lớp --</option>
                  {assignments
                    .filter((a) => a.classroomId === selectedClassId)
                    .map((assign) => (
                      <option key={assign.id} value={assign.id}>
                        {assign.examTitle} (Mã: {assign.accessCode})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={handleExportClassGradebook}
                className="w-full md:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Xuất Bảng Điểm Ra Excel (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics of the Class */}
          {currentClass && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(() => {
                const classSubs = submissions.filter(
                  (s) =>
                    s.studentClass === currentClass.name ||
                    s.classroomId === currentClass.id
                );
                const submittedSubs = classSubs.filter((s) => s.status === "submitted");
                const avgScore =
                  submittedSubs.length > 0
                    ? (submittedSubs.reduce((acc, cur) => acc + cur.score, 0) / submittedSubs.length).toFixed(2)
                    : "0.00";
                const highestScore =
                  submittedSubs.length > 0
                    ? Math.max(...submittedSubs.map((s) => s.score)).toFixed(1)
                    : "--";

                return (
                  <>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Sĩ Số Lớp
                      </div>
                      <div className="text-2xl font-black text-slate-900 mt-1">
                        {currentClass.students.length}
                      </div>
                      <div className="text-[11px] text-blue-600 font-semibold mt-1">
                        Lớp {currentClass.name}
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Đã Hoàn Thành
                      </div>
                      <div className="text-2xl font-black text-emerald-600 mt-1">
                        {submittedSubs.length} / {currentClass.students.length}
                      </div>
                      <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                        Tỷ lệ: {currentClass.students.length > 0 ? Math.round((submittedSubs.length / currentClass.students.length) * 100) : 0}%
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Điểm Trung Bình
                      </div>
                      <div className="text-2xl font-black text-indigo-600 mt-1">
                        {avgScore}
                      </div>
                      <div className="text-[11px] text-indigo-600 font-semibold mt-1">
                        Thang điểm 10.0
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Điểm Cao Nhất
                      </div>
                      <div className="text-2xl font-black text-amber-500 mt-1">
                        {highestScore}
                      </div>
                      <div className="text-[11px] text-amber-600 font-semibold mt-1">
                        Điểm tuyệt đối
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Detailed Gradebook Table */}
          {currentClass ? (
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <span>Bảng Điểm Chi Tiết Từng Học Sinh - Lớp {currentClass.name}</span>
                </h3>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-3 text-center w-12">STT</th>
                        <th className="py-3 px-3">Số Báo Danh</th>
                        <th className="py-3 px-4">Họ và Tên</th>
                        <th className="py-3 px-3 text-center">Trạng Thái</th>
                        <th className="py-3 px-3 text-center">Mã Đề</th>
                        <th className="py-3 px-3 text-center">Điểm Số</th>
                        <th className="py-3 px-3 text-center">Số Câu Đúng</th>
                        <th className="py-3 px-3 text-center">Thời Gian Làm</th>
                        <th className="py-3 px-3 text-center">Vi Phạm Thoát Tab</th>
                        <th className="py-3 px-3 text-right">Chi Tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentClass.students.map((stu, idx) => {
                        const currentAssignment = assignments.find((a) => a.id === selectedAssignmentId);
                        const sub = submissions.find(
                          (s) =>
                            ((s.studentId && s.studentId.toUpperCase() === stu.studentId.toUpperCase()) ||
                              s.studentName.toLowerCase().trim() === stu.name.toLowerCase().trim()) &&
                            (!currentAssignment || s.examId === currentAssignment.examId || s.assignmentId === currentAssignment.id)
                        );

                        return (
                          <tr key={stu.id} className="hover:bg-blue-50/30 transition-colors">
                            <td className="py-3 px-3 text-center font-mono text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-indigo-700">
                              {stu.studentId}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {stu.name}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {sub ? (
                                sub.status === "locked" || sub.isLockedDueToCheating ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                    Khóa vi phạm
                                  </span>
                                ) : sub.status === "in_progress" ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 animate-pulse">
                                    Đang làm bài
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Đã nộp bài
                                  </span>
                                )
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                                  Chưa nộp bài
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                              {sub?.examCode || "--"}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {sub ? (
                                <span
                                  className={`text-sm font-black ${
                                    sub.score >= 8.0
                                      ? "text-emerald-600"
                                      : sub.score >= 5.0
                                      ? "text-blue-600"
                                      : "text-rose-600"
                                  }`}
                                >
                                  {sub.score.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-slate-300 font-bold">--</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center font-semibold text-slate-700">
                              {sub ? `${sub.correctCount}/${sub.totalQuestions}` : "--"}
                            </td>
                            <td className="py-3 px-3 text-center text-slate-600">
                              {sub ? `${Math.round(sub.durationTakenSeconds / 60)} phút` : "--"}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {sub ? (
                                sub.tabSwitchCount > 0 ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    {sub.tabSwitchCount} lần
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 font-bold">0</span>
                                )
                              ) : (
                                <span className="text-slate-300">--</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {sub ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSubmissionForDetail(sub)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="Xem chi tiết bài làm của học sinh"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  {(sub.isLockedDueToCheating || sub.status === "locked") && onUnlockStudent && (
                                    <button
                                      type="button"
                                      onClick={() => onUnlockStudent(sub.id)}
                                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                      title="Mở khóa bài thi cho học sinh này"
                                    >
                                      <Unlock className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300">--</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: TẠO LỚP HỌC MỚI */}
      {/* ============================================================== */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span>Tạo Lớp Học Mới</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddClassModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên Lớp Học <span className="text-rose-500">*</span> (VD: 12A1, 12A2, 10C3):
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: 12A1"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Khối Lớp:</label>
                  <select
                    value={newClassGrade}
                    onChange={(e) => setNewClassGrade(e.target.value as GradeType)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Khối 12">Khối 12</option>
                    <option value="Khối 11">Khối 11</option>
                    <option value="Khối 10">Khối 10</option>
                    <option value="Khối 9">Khối 9</option>
                    <option value="Khối 8">Khối 8</option>
                    <option value="Khối 7">Khối 7</option>
                    <option value="Khối 6">Khối 6</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Năm Học:</label>
                  <input
                    type="text"
                    value={newClassSchoolYear}
                    onChange={(e) => setNewClassSchoolYear(e.target.value)}
                    placeholder="2025-2026"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Môn Học Phụ Trách:</label>
                <input
                  type="text"
                  value={newClassSubject}
                  onChange={(e) => setNewClassSubject(e.target.value)}
                  placeholder="VD: Toán học, Vật lý..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Giáo Viên Phụ Trách / Chủ Nhiệm:</label>
                <input
                  type="text"
                  value={newClassTeacher}
                  onChange={(e) => setNewClassTeacher(e.target.value)}
                  placeholder="VD: Thầy Nguyễn Văn A"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddClassModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Tạo Lớp Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: THÊM 1 HỌC SINH THỦ CÔNG */}
      {/* ============================================================== */}
      {showAddStudentModal && currentClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <span>Thêm Học Sinh Vào Lớp {currentClass.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddStudentModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSingleStudent} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Họ và Tên Học Sinh <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nguyễn Thành Nam"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số Báo Danh / Mã HS:</label>
                  <input
                    type="text"
                    placeholder={`VD: HS${String(currentClass.students.length + 1).padStart(2, "0")}`}
                    value={newStudentId}
                    onChange={(e) => setNewStudentId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Giới Tính:</label>
                  <select
                    value={newStudentGender}
                    onChange={(e) => setNewStudentGender(e.target.value as "Nam" | "Nữ")}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ngày Sinh (DD/MM/YYYY):</label>
                <input
                  type="text"
                  placeholder="15/04/2008"
                  value={newStudentDob}
                  onChange={(e) => setNewStudentDob(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Thêm Vào Lớp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: DÁN NHANH DANH SÁCH HỌC SINH (TEXT) */}
      {/* ============================================================== */}
      {showPasteStudentsModal && currentClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                <span>Dán Nhanh Danh Sách Học Sinh: Lớp {currentClass.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPasteStudentsModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Sao chép danh sách học sinh từ Word, Excel hoặc văn bản bất kỳ và dán vào ô dưới đây (mỗi dòng một học sinh).
              </p>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                <span className="font-bold text-slate-700">Ví dụ các định dạng được hệ thống hỗ trợ:</span>
                <div>1. Nguyễn Văn An</div>
                <div>HS1201	Trần Thu Thủy	Nữ	15/04/2008</div>
                <div>Lê Minh Tâm - SBD03</div>
              </div>

              <textarea
                rows={8}
                value={rawStudentsText}
                onChange={(e) => setRawStudentsText(e.target.value)}
                placeholder="Dán danh sách học sinh tại đây..."
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />

              <div className="pt-2 flex items-center justify-between text-slate-500 text-[11px]">
                <span>
                  Số dòng nhận diện: {rawStudentsText.split(/\r?\n/).filter((l) => l.trim()).length} HS
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasteStudentsModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  onClick={handleParsePastedStudents}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Xác Nhận Thêm Vào Lớp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: GIAO ĐỀ CHO LỚP HỌC */}
      {/* ============================================================== */}
      {showAssignExamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-600" />
                <span>Tiến Hành Giao Bài Cho Lớp Học</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAssignExamModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignExamToClass} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Chọn Đề Thi Cần Giao <span className="text-rose-500">*</span>:
                </label>
                <select
                  required
                  value={assignExamId}
                  onChange={(e) => {
                    setAssignExamId(e.target.value);
                    const chosen = exams.find((x) => x.id === e.target.value);
                    if (chosen?.config?.duration) setAssignDuration(chosen.config.duration);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} (Mã: {ex.accessCode} • {ex.originalQuestions?.length || ex.variants?.[0]?.questions?.length || 40} câu • {ex.config?.duration || 45} phút)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Chọn Lớp Nhận Đề <span className="text-rose-500">*</span>:
                </label>
                <select
                  required
                  value={assignClassroomId}
                  onChange={(e) => setAssignClassroomId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {classrooms.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      Lớp {cls.name} ({cls.grade} • Sĩ số: {cls.students.length} học sinh)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Thời Lượng Làm Bài (phút):</label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={assignDuration}
                    onChange={(e) => setAssignDuration(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hạn Chót Nộp Bài (Tùy chọn):</label>
                  <input
                    type="datetime-local"
                    value={assignCloseTime}
                    onChange={(e) => setAssignCloseTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignShuffleVariants}
                    onChange={(e) => setAssignShuffleVariants(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-slate-800">
                    Tự động chia ngẫu nhiên mã đề cho từng học sinh trong lớp (Chống nhìn bài)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignAllowReview}
                    onChange={(e) => setAssignAllowReview(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-md focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-800">
                    Cho phép học sinh xem lại đáp án và lời giải chi tiết sau khi nộp
                  </span>
                </label>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-[11px] text-emerald-800 font-medium flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Sau khi giao bài, học sinh lớp này chỉ cần mở trang kiểm tra, chọn lớp của mình và chọn tên để vào làm bài ngay lập tức.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAssignExamModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Xác Nhận Giao Bài
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: XEM CHI TIẾT BÀI LÀM HỌC SINH */}
      {/* ============================================================== */}
      {selectedSubmissionForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Chi Tiết Bài Thi: {selectedSubmissionForDetail.studentName}
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  Lớp: {selectedSubmissionForDetail.studentClass} • SBD: {selectedSubmissionForDetail.studentId} • Mã đề: {selectedSubmissionForDetail.examCode}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSubmissionForDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Điểm Số</span>
                <div className="text-xl font-black text-blue-900 mt-0.5">
                  {selectedSubmissionForDetail.score.toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Số Câu Đúng</span>
                <div className="text-xl font-black text-emerald-900 mt-0.5">
                  {selectedSubmissionForDetail.correctCount} / {selectedSubmissionForDetail.totalQuestions}
                </div>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Thoát Tab</span>
                <div className="text-xl font-black text-amber-900 mt-0.5">
                  {selectedSubmissionForDetail.tabSwitchCount} lần
                </div>
              </div>
            </div>

            {selectedSubmissionForDetail.violationLogs && selectedSubmissionForDetail.violationLogs.length > 0 && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-xs">
                <h4 className="font-bold text-rose-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Nhật Ký Vi Phạm Cảnh Báo Gian Lận ({selectedSubmissionForDetail.violationLogs.length} sự kiện):</span>
                </h4>
                <div className="space-y-1 font-mono text-[11px] max-h-36 overflow-y-auto pr-1">
                  {selectedSubmissionForDetail.violationLogs.map((log, lIdx) => (
                    <div key={lIdx} className="p-1.5 bg-white/80 rounded-lg text-rose-800 border border-rose-100 flex items-center justify-between">
                      <span>{log.message}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString("vi-VN")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedSubmissionForDetail(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
