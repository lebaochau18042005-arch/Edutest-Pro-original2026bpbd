import React, { useState, useEffect } from "react";
import {
  QrCode,
  Copy,
  Check,
  CheckCircle2,
  Smartphone,
  ExternalLink,
  Download,
  Maximize2,
  Minimize2,
  X,
  Sparkles,
  ShieldCheck,
  Clock,
  BookOpen,
  Share2,
  Wifi,
  Globe,
  Cloud,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { ExamPackage } from "../../types";
import { buildExamShareLinks } from "../../utils/shareUrlHelper";
import { publishExamToCloud } from "../../utils/cloudExamDatabase";

interface InstantShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: ExamPackage | null;
  onOpenAsStudent?: (examId: string, code: string) => void;
}

export const InstantShareModal: React.FC<InstantShareModalProps> = ({
  isOpen,
  onClose,
  exam,
  onOpenAsStudent,
}) => {
  const [copied, setCopied] = useState(false);
  const [isFullscreenProjector, setIsFullscreenProjector] = useState(false);
  const [lanIp, setLanIp] = useState<string>(() => {
    try {
      return localStorage.getItem("edutest_lan_ip") || "";
    } catch {
      return "";
    }
  });
  const isLocalHost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const [networkMode, setNetworkMode] = useState<"wifi" | "online">("online");
  const [cloudSyncStatus, setCloudSyncStatus] = useState<"syncing" | "synced" | "error">("syncing");
  const [cloudSyncMsg, setCloudSyncMsg] = useState<string>("");

  const [links, setLinks] = useState<{
    directLink: string;
    simpleCodeLink: string;
    qrCodeUrl: string;
    isSelfContained: boolean;
  }>({
    directLink: "",
    simpleCodeLink: "",
    qrCodeUrl: "",
    isSelfContained: false,
  });
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);

  // Discover actual LAN IP from server if available
  useEffect(() => {
    fetch("/api/network-ip")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.lanIp && data.lanIp !== "127.0.0.1") {
          setLanIp(data.lanIp);
          try {
            localStorage.setItem("edutest_lan_ip", data.lanIp);
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  // Sync to Cloud Database on open
  useEffect(() => {
    if (!isOpen || !exam) return;

    let isMounted = true;
    setCloudSyncStatus("syncing");
    setCloudSyncMsg("Đang đồng bộ đề thi lên Cloud Database...");

    publishExamToCloud(exam).then((res) => {
      if (isMounted) {
        if (res.success) {
          setCloudSyncStatus("synced");
          setCloudSyncMsg(res.message);
        } else {
          setCloudSyncStatus("error");
          setCloudSyncMsg(res.message);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, exam]);

  useEffect(() => {
    if (!isOpen || !exam) return;

    let isMounted = true;
    setIsLoadingLinks(true);

    let targetOrigin: string | undefined = undefined;
    if (networkMode === "wifi") {
      const port = typeof window !== "undefined" ? window.location.port || 3000 : 3000;
      if (lanIp && lanIp !== "127.0.0.1" && lanIp !== "localhost") {
        targetOrigin = `http://${lanIp}:${port}`;
      } else {
        targetOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      }
    } else {
      targetOrigin = typeof window !== "undefined" && window.location.origin && !window.location.origin.includes("localhost")
        ? window.location.origin
        : "https://edutest-pro-original2026bpbd.vercel.app";
    }

    buildExamShareLinks(exam, targetOrigin).then((res) => {
      if (isMounted) {
        setLinks(res);
        setIsLoadingLinks(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, exam, networkMode, lanIp]);

  if (!isOpen) return null;

  if (!exam) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto text-xl font-bold">
            ⚠️
          </div>
          <h3 className="text-base font-bold text-slate-900">Chưa có đề thi được xuất bản</h3>
          <p className="text-xs text-slate-600">
            Vui lòng tải câu hỏi hoặc bấm nút <strong>"Trộn Đề & Xuất Bản Ngay"</strong> để hệ thống tạo các mã đề trước khi tạo mã QR phát cho học sinh.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Đã Hiểu & Quay Lại
          </button>
        </div>
      </div>
    );
  }

  const handleOpenExamInNewTab = () => {
    const linkToOpen = links.directLink || links.simpleCodeLink;
    if (linkToOpen) {
      window.open(linkToOpen, "_blank");
    } else if (onOpenAsStudent && exam) {
      onOpenAsStudent(exam.id, exam.accessCode);
      onClose();
    }
  };

  const handleOpenInThisTab = () => {
    if (onOpenAsStudent && exam) {
      onOpenAsStudent(exam.id, exam.accessCode);
      onClose();
    }
  };

  const handleCopyLink = () => {
    const linkToCopy = links.directLink || links.simpleCodeLink;
    navigator.clipboard.writeText(linkToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadQr = () => {
    if (!links.qrCodeUrl) return;
    const a = document.createElement("a");
    a.href = links.qrCodeUrl;
    a.download = `Ma_QR_Thi_${exam.accessCode || "THPT"}.png`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // FULLSCREEN PROJECTOR MODE FOR CLASSROOM
  if (isFullscreenProjector) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col items-center justify-between p-6 sm:p-10 animate-fade-in overflow-y-auto">
        {/* Top Header */}
        <div className="w-full max-w-5xl flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-2xl shadow-lg">
              📱
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Màn Hình Máy Chiếu Lớp Học • Quét Mã Vào Thi Ngay
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white">{exam.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher in Projector */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setNetworkMode("wifi")}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  networkMode === "wifi" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Wi-Fi: {lanIp}
              </button>
              <button
                type="button"
                onClick={() => setNetworkMode("online")}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  networkMode === "online" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Web Vercel
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsFullscreenProjector(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
            >
              <Minimize2 className="w-4 h-4" />
              <span>Thu Nhỏ</span>
            </button>
          </div>
        </div>

        {/* Center Giant QR Code + Guidance */}
        <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 my-auto py-6">
          {/* Big QR Code Card */}
          <div className="bg-white p-6 rounded-3xl shadow-2xl border-4 border-emerald-500/30 flex flex-col items-center">
            {links.qrCodeUrl ? (
              <div
                onClick={handleOpenExamInNewTab}
                className="relative group cursor-pointer overflow-hidden rounded-2xl border-2 border-emerald-300 hover:border-emerald-500 transition-all hover:shadow-xl active:scale-95"
                title="Bấm trực tiếp vào mã QR để mở bài thi thử nghiệm trong tab mới"
              >
                <img
                  src={links.qrCodeUrl}
                  alt="Mã QR phòng thi"
                  className="w-72 h-72 sm:w-96 sm:h-96 object-contain rounded-xl transition-transform group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-emerald-950/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white p-4 text-center">
                  <ExternalLink className="w-10 h-10 text-emerald-300 mb-2 animate-bounce" />
                  <span className="font-black text-lg">BẤM VÀO ĐÂY ĐỂ VÀO THI</span>
                  <span className="text-xs text-emerald-200 mt-1">Mở bài thi trực tiếp trong tab mới</span>
                </div>
              </div>
            ) : (
              <div className="w-72 h-72 sm:w-96 sm:h-96 flex items-center justify-center text-slate-400">
                Đang tạo mã QR...
              </div>
            )}
            <div className="mt-4 text-center space-y-2.5 w-full">
              <button
                type="button"
                onClick={handleOpenExamInNewTab}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-95"
              >
                <ExternalLink className="w-4 h-4" />
                <span>👆 Bấm Vào Mã QR Hoặc Nút Này Để Mở Bài Thi (Tab Mới)</span>
              </button>

              <div className="flex items-center justify-center gap-2">
                <span className="text-xs font-mono font-bold bg-slate-100 text-slate-900 px-3 py-1 rounded-full border border-slate-300 inline-block">
                  Mã Phòng: <strong className="text-emerald-700">{exam.accessCode}</strong>
                </span>
              </div>

              {cloudSyncStatus === "synced" ? (
                <div className="p-2 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-[11px] text-emerald-300 font-bold flex items-center justify-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>🟢 Đã đồng bộ Cloud Database • Học sinh quét 4G/Wi-Fi vào làm bài ngay</span>
                </div>
              ) : (
                <div className="p-2 bg-slate-900 border border-slate-700 rounded-xl text-[11px] text-slate-300 font-medium flex items-center justify-center gap-1.5">
                  <span>🔗 Quét mã QR tự động mở phòng thi</span>
                </div>
              )}
              <p className="text-[11px] text-slate-500">
                {networkMode === "wifi" ? `Mạng nội bộ Wi-Fi (IP: ${lanIp})` : "Web trực tuyến Vercel & Đám mây"}
              </p>
            </div>
          </div>

          {/* 3 Step Student Guidance */}
          <div className="max-w-md space-y-6">
            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                HƯỚNG DẪN HỌC SINH VÀO THI
              </span>
              <h2 className="text-2xl font-extrabold text-white">3 Bước Đơn Giản:</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <p className="font-bold text-sm text-white">Mở Camera hoặc Zalo trên điện thoại</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Hướng camera vào mã QR to trên bảng máy chiếu
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <p className="font-bold text-sm text-white">Điền Họ Tên & Lớp của em</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Hệ thống tự động xáo trộn và bốc ngẫu nhiên mã đề (101 - 104) để chống nhìn bài
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <p className="font-bold text-sm text-white">Bấm 'Bắt Đầu Làm Bài'</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Thời gian: {exam.config.duration} phút • Giám sát chống chuyển tab
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Phòng thi đang mở • Sẵn sàng đón nhận toàn bộ học sinh trong lớp</span>
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="text-emerald-400 hover:text-emerald-300 underline font-semibold cursor-pointer"
          >
            {copied ? "✓ Đã sao chép link 1-chạm" : "Sao chép link gửi qua Zalo nếu không quét được QR"}
          </button>
        </div>
      </div>
    );
  }

  // STANDARD MODAL DIALOG
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center text-xl shadow-md">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Phát Đề 1-Chạm & Mã QR Cho Học Sinh
              </h3>
              <p className="text-xs text-slate-500">
                Học sinh quét mã QR hoặc bấm link là vào thi ngay, không sợ quên mã!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cloud Sync Status Banner */}
        {cloudSyncStatus === "synced" && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-950 flex items-start gap-2.5 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-900">
                🟢 Sẵn sàng phát đề 1-Chạm trực tuyến!
              </p>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Toàn bộ học sinh dùng <strong>4G/5G hoặc Wi-Fi bất kỳ</strong> chỉ cần quét mã QR hoặc bấm link là nhận trọn vẹn đề thi <strong className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-900 font-bold">{exam.accessCode}</strong> và làm bài ngay lập tức.
              </p>
            </div>
          </div>
        )}

        {cloudSyncStatus === "syncing" && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-950 flex items-center gap-2.5">
            <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
            <span className="text-[11px] font-medium text-blue-800">
              Đang chuẩn bị gói đề thi phát trực tuyến 1-chạm...
            </span>
          </div>
        )}

        {/* Environment Switcher: Wi-Fi vs Online Vercel */}
        <div className="p-1.5 bg-slate-100 rounded-2xl flex gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setNetworkMode("online")}
            className={`flex-1 py-2.5 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              networkMode === "online"
                ? "bg-white text-emerald-800 shadow-sm border border-emerald-200 ring-2 ring-emerald-500/10"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            <span>Dành Cho Cả Lớp (Web Online & 4G/Wi-Fi)</span>
          </button>

          <button
            type="button"
            onClick={() => setNetworkMode("wifi")}
            className={`flex-1 py-2.5 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              networkMode === "wifi"
                ? "bg-white text-emerald-800 shadow-sm border border-emerald-200 ring-2 ring-emerald-500/10"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Wifi className="w-3.5 h-3.5 text-slate-600" />
            <span>Thử Mạng Cục Bộ ({lanIp || "LAN IP"})</span>
          </button>
        </div>

        {/* Exam Quick Specs Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="space-y-0.5">
            <span className="font-bold text-slate-900 block line-clamp-1">{exam.title}</span>
            <div className="flex items-center gap-2 text-slate-500 text-[11px]">
              <span className="flex items-center gap-1 font-semibold text-emerald-700">
                <Clock className="w-3 h-3" />
                {exam.config.duration} phút
              </span>
              <span>•</span>
              <span>{exam.originalQuestions.length} câu hỏi</span>
              <span>•</span>
              <span className="font-mono font-bold text-indigo-700">
                Mã: {exam.accessCode}
              </span>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            Tự chia 4 mã đề ngẫu nhiên
          </span>
        </div>

        {/* QR Code Presentation Area */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-5 p-4 rounded-2xl bg-gradient-to-b from-slate-50 to-emerald-50/40 border border-emerald-100">
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm shrink-0 flex flex-col items-center">
            {isLoadingLinks ? (
              <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400">
                Đang chuẩn bị mã QR...
              </div>
            ) : (
              <div
                onClick={handleOpenExamInNewTab}
                className="relative group cursor-pointer overflow-hidden rounded-xl border-2 border-emerald-300 hover:border-emerald-500 transition-all hover:shadow-xl active:scale-95"
                title="Bấm vào mã QR để mở bài thi thử nghiệm ngay (Tab mới)"
              >
                <img
                  src={links.qrCodeUrl}
                  alt="Mã QR phòng thi"
                  className="w-48 h-48 object-contain rounded-lg transition-transform group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-emerald-950/75 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center text-white p-2 text-center">
                  <ExternalLink className="w-7 h-7 text-emerald-300 mb-1 animate-bounce" />
                  <span className="font-extrabold text-xs text-white">BẤM VÀO ĐÂY</span>
                  <span className="text-[10px] text-emerald-200">Mở thi tab mới</span>
                </div>
              </div>
            )}
            <span className="mt-2 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
              👆 Bấm vào mã QR để mở thi
            </span>
          </div>

          <div className="space-y-3 text-center sm:text-left flex-1">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Mã QR Quét & Bấm Vào Thi Ngay
              </h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Thầy/Cô có thể <strong>bấm trực tiếp vào ảnh mã QR</strong> hoặc bấm nút màu xanh dưới đây để mở bài thi kiểm tra ngay.
              </p>
              {links.isSelfContained ? (
                <div className="mt-2 p-2 bg-emerald-50 border border-emerald-300 rounded-xl text-[11px] text-emerald-800 font-bold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>⚡ Đề thi tự động nhúng trọn vẹn trong mã QR (Học sinh quét là nhận đề ngay 100%)</span>
                </div>
              ) : (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-300 rounded-xl text-[11px] text-blue-800 font-medium flex items-center gap-1.5">
                  <span>🔗 Mã QR chia sẻ tự động tải đề theo mã phòng trực tuyến</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleOpenExamInNewTab}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
              >
                <ExternalLink className="w-4 h-4" />
                <span>🚀 Bấm Để Mở Bài Thi Ngay (Tab Mới)</span>
              </button>

              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {onOpenAsStudent && (
                  <button
                    type="button"
                    onClick={handleOpenInThisTab}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Mở bài thi trực tiếp trên trang này với vai trò học sinh"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mở Trên Tab Này</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsFullscreenProjector(true)}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Chiếu Máy Chiếu</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Tải ảnh mã QR về máy"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải Ảnh QR</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 1-Click Shareable Link Section */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>Link 1-Chạm Gửi Zalo / Messenger Nhóm Lớp:</span>
            {copied && (
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 animate-fade-in">
                <Check className="w-3.5 h-3.5" />
                Đã sao chép vào bộ nhớ tạm!
              </span>
            )}
          </label>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={links.directLink || links.simpleCodeLink}
              className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700 select-all"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? "Đã Sao Chép" : "Sao Chép Link"}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            💡 Học sinh bấm vào link này trên điện thoại sẽ tự động mở thẳng bài thi, không cần nhập mã.
          </p>
        </div>

        {/* Smart Anti-Cheat Notice */}
        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-2.5 text-xs text-indigo-950">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Chống nhìn bài tự động:</strong> Mỗi học sinh khi quét mã QR hoặc bấm link sẽ được hệ thống phân ngẫu nhiên 1 trong 4 mã đề (101, 102, 103, 104) với thứ tự câu hỏi và đáp án đảo nhau.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
          >
            Đóng
          </button>

          {onOpenAsStudent && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAsStudent(exam.id, exam.variants[0]?.examCode || "101");
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-slate-700" />
              <span>Thi Thử Ngay (Giao Diện Học Sinh)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
