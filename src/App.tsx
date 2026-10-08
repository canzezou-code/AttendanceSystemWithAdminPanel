import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Download,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  PenLine,
  Plus,
  RefreshCw,
  ScanFace,
  Search,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react";

const MODEL_URL = "https://teachablemachine.withgoogle.com/models/oElomHH3X/";
type AttendanceStatus = "normal" | "late" | "pending";
type AttendanceRecord = {
  name: string;
  time: string;
  status: AttendanceStatus;
  confidence?: number;
  source?: "face" | "manual" | "auto";
  note?: string;
};

const initialRecords: AttendanceRecord[] = [
  { name: "张子辰", time: "12:47:08", status: "normal", confidence: 98, source: "face" },
  { name: "陈嘉琦", time: "12:49:31", status: "normal", confidence: 97, source: "face" },
  { name: "孙源", time: "12:52:14", status: "normal", confidence: 99, source: "face" },
  { name: "韩雨晋", time: "12:55:42", status: "normal", confidence: 96, source: "face" },
  { name: "刘映汐", time: "12:58:09", status: "normal", confidence: 98, source: "face" },
  { name: "袁诗杰", time: "13:02:17", status: "late", confidence: 95, source: "face" },
  { name: "周高兴", time: "—", status: "pending" },
  { name: "邹璨泽", time: "—", status: "pending" },
  { name: "韩润希", time: "—", status: "pending" },
];

const statusText = {
  normal: "准时",
  late: "迟到",
  pending: "待打卡",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function CameraDialog({
  open,
  onClose,
  onRecognized,
}: {
  open: boolean;
  onClose: () => void;
  onRecognized: (name: string, confidence: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const stableRef = useRef({ name: "", count: 0 });
  const completedRef = useRef(false);
  const [phase, setPhase] = useState<"loading" | "scanning" | "success" | "error">("loading");
  const [message, setMessage] = useState("正在加载人脸识别模型…");
  const [prediction, setPrediction] = useState({ name: "请正对摄像头", confidence: 0 });

  const stopCamera = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    completedRef.current = false;
    stableRef.current = { name: "", count: 0 };
    setPhase("loading");
    setMessage("正在加载人脸识别模型…");

    async function initialize() {
      try {
        const [model, stream] = await Promise.all([
          import("@teachablemachine/image").then((tmImage) =>
            tmImage.load(`${MODEL_URL}model.json`, `${MODEL_URL}metadata.json`),
          ),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
            audio: false,
          }),
        ]);
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          model.dispose();
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setPhase("scanning");
        setMessage("保持正脸清晰，正在实时比对");

        const predict = async () => {
          if (cancelled || completedRef.current || !videoRef.current) return;
          const results = await model.predict(videoRef.current, true);
          const best = results.reduce((a, b) => (a.probability > b.probability ? a : b));
          const confidence = Math.round(best.probability * 100);
          setPrediction({ name: best.className, confidence });

          if (best.probability >= 0.88) {
            if (stableRef.current.name === best.className) stableRef.current.count += 1;
            else stableRef.current = { name: best.className, count: 1 };
          } else {
            stableRef.current = { name: "", count: 0 };
          }

          if (stableRef.current.count >= 6 && !completedRef.current) {
            completedRef.current = true;
            setPhase("success");
            setMessage(`${best.className}，识别成功`);
            onRecognized(best.className, confidence);
            window.setTimeout(onClose, 1400);
            return;
          }
          frameRef.current = requestAnimationFrame(predict);
        };
        frameRef.current = requestAnimationFrame(predict);
      } catch (error) {
        console.error(error);
        setPhase("error");
        setMessage("无法启用摄像头，请检查浏览器权限和网络连接");
      }
    }

    initialize();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [onClose, onRecognized, open, stopCamera]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="camera-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-title">
        <div className="dialog-topbar">
          <div>
            <span className="eyebrow">AI FACE CHECK</span>
            <h2 id="camera-title">人脸打卡登记</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </div>

        <div className={`camera-stage ${phase}`}>
          <video ref={videoRef} muted playsInline />
          <div className="face-guide">
            <span />
            <span />
            <span />
            <span />
          </div>
          {phase === "loading" && (
            <div className="camera-cover">
              <LoaderCircle className="spin" size={34} />
              <span>模型加载中</span>
            </div>
          )}
          {phase === "error" && (
            <div className="camera-cover error-cover">
              <CircleHelp size={36} />
              <span>摄像头暂不可用</span>
            </div>
          )}
          {phase === "success" && (
            <div className="camera-cover success-cover">
              <Check size={38} />
              <span>打卡完成</span>
            </div>
          )}
        </div>

        <div className="prediction-row">
          <div className={`scan-indicator ${phase}`}>
            {phase === "scanning" ? <ScanFace size={22} /> : phase === "success" ? <Check size={22} /> : <LoaderCircle size={22} />}
          </div>
          <div className="prediction-copy">
            <strong>{phase === "scanning" ? prediction.name : message}</strong>
            <span>{phase === "scanning" ? message : "打卡记录将实时同步到管理后台"}</span>
          </div>
          {phase === "scanning" && <strong className="confidence">{prediction.confidence}%</strong>}
        </div>
      </section>
    </div>
  );
}

function ManualRecordDialog({
  open,
  password,
  records,
  onClose,
  onSubmit,
}: {
  open: boolean;
  password: string;
  records: AttendanceRecord[];
  onClose: () => void;
  onSubmit: (name: string, time: string, note: string) => void;
}) {
  const [name, setName] = useState(records.find((record) => record.status === "pending")?.name ?? records[0].name);
  const [time, setTime] = useState("13:00");
  const [note, setNote] = useState("忘记打卡");
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setPasswordInput("");
      setError("");
      setName(records.find((record) => record.status === "pending")?.name ?? records[0].name);
    }
  }, [open, records]);

  if (!open) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError("请先前往系统设置创建后台密码");
      return;
    }
    if (passwordInput !== password) {
      setError("后台密码不正确");
      return;
    }
    onSubmit(name, `${time}:00`, note.trim() || "管理员补录");
    onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="form-dialog" onSubmit={submit}>
        <div className="dialog-topbar">
          <div>
            <span className="eyebrow">ADMIN RECORD</span>
            <h2>手动补录打卡</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={20} /></button>
        </div>
        <div className="security-note"><LockKeyhole size={18} /><span>此操作需要管理员后台密码，并会标记为手动补录。</span></div>
        <label className="field-label">选择成员
          <select value={name} onChange={(event) => setName(event.target.value)}>
            {records.map((record) => <option key={record.name} value={record.name}>{record.name} · {statusText[record.status]}</option>)}
          </select>
        </label>
        <div className="form-row">
          <label className="field-label">补录时间<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
          <label className="field-label">补录原因<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：忘记打卡" /></label>
        </div>
        <label className="field-label">后台密码
          <input type="password" value={passwordInput} onChange={(event) => { setPasswordInput(event.target.value); setError(""); }} placeholder="请输入管理员密码" required />
        </label>
        {error && <div className="form-error">{error}</div>}
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>取消</button>
          <button type="submit" className="primary-button"><Check size={17} />确认补录</button>
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const [now, setNow] = useState(new Date());
  const [mobileNav, setMobileNav] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | AttendanceStatus>("all");
  const [activeNav, setActiveNav] = useState("dashboard");
  const [toast, setToast] = useState("");
  const [adminPassword, setAdminPassword] = useState(() => localStorage.getItem("attendance-admin-password") ?? "");
  const [passwordInput, setPasswordInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [settingsUnlocked, setSettingsUnlocked] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [autoSchedules, setAutoSchedules] = useState<Record<string, string>>(() => {
    const saved = JSON.parse(localStorage.getItem("attendance-auto-members") ?? "{}");
    return Array.isArray(saved)
      ? Object.fromEntries(saved.map((name: string) => [name, "13:00"]))
      : saved;
  });
  const [records, setRecords] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem(`attendance-${new Date().toDateString()}`);
    return saved ? JSON.parse(saved) : initialRecords;
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(`attendance-${now.toDateString()}`, JSON.stringify(records));
  }, [now, records]);

  useEffect(() => {
    localStorage.setItem("attendance-auto-members", JSON.stringify(autoSchedules));
  }, [autoSchedules]);

  useEffect(() => {
    const key = `attendance-${new Date().toDateString()}`;
    const syncAcrossTabs = (event: StorageEvent) => {
      if (event.key === key && event.newValue) setRecords(JSON.parse(event.newValue));
    };
    window.addEventListener("storage", syncAcrossTabs);
    return () => window.removeEventListener("storage", syncAcrossTabs);
  }, []);

  useEffect(() => {
    const today = now.toDateString();
    const runKey = `attendance-auto-runs-${today}`;
    const completed: string[] = JSON.parse(localStorage.getItem(runKey) ?? "[]");
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const dueMembers = Object.entries(autoSchedules)
      .filter(([name, time]) => {
        const [hour, minute] = time.split(":").map(Number);
        return hour * 60 + minute <= currentMinutes && !completed.includes(name);
      })
      .map(([name]) => name);

    if (dueMembers.length) {
      setRecords((current) =>
        current.map((record) =>
          dueMembers.includes(record.name) && record.status === "pending"
            ? {
                ...record,
                time: `${autoSchedules[record.name]}:00`,
                status: Number(autoSchedules[record.name].replace(":", "")) > 1300 ? "late" : "normal",
                source: "auto",
                confidence: undefined,
              }
            : record,
        ),
      );
      localStorage.setItem(runKey, JSON.stringify([...completed, ...dueMembers]));
    }
  }, [autoSchedules, now]);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 3500);
  }, []);

  const onRecognized = useCallback((name: string, confidence: number) => {
    const timestamp = new Date();
    const time = timestamp.toLocaleTimeString("zh-CN", { hour12: false });
    const isLate = timestamp.getHours() > 13 || (timestamp.getHours() === 13 && timestamp.getMinutes() > 0);
    setRecords((current) =>
      current.map((record) =>
        record.name === name ? { ...record, time, status: isLate ? "late" : "normal", confidence, source: "face", note: undefined } : record,
      ),
    );
    showToast(`${name} 人脸打卡成功 · ${time}`);
  }, [showToast]);

  const addManualRecord = (name: string, time: string, note: string) => {
    const [hour, minute] = time.split(":").map(Number);
    const status: AttendanceStatus = hour > 13 || (hour === 13 && minute > 0) ? "late" : "normal";
    setRecords((current) =>
      current.map((record) => record.name === name ? { ...record, time, status, source: "manual", confidence: undefined, note } : record),
    );
    showToast(`${name} 的打卡记录已由管理员补录`);
  };

  const filteredRecords = useMemo(
    () => records.filter((record) =>
      (filter === "all" || record.status === filter) &&
      (!search || record.name.toLowerCase().includes(search.toLowerCase())),
    ),
    [filter, records, search],
  );

  const arrived = records.filter((record) => record.status !== "pending").length;
  const normal = records.filter((record) => record.status === "normal").length;
  const late = records.filter((record) => record.status === "late").length;
  const attendanceRate = Math.round((arrived / records.length) * 100);

  const exportCsv = () => {
    const sourceText = { face: "人脸识别", manual: "手动补录", auto: "自动打卡" };
    const body = records.map((r) => `${r.name},${r.time},${statusText[r.status]},${sourceText[r.source ?? "face"]},${r.note ?? ""}`).join("\n");
    const blob = new Blob([`\ufeff姓名,打卡时间,状态,登记方式,备注\n${body}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `考勤记录-${now.toLocaleDateString("zh-CN").replaceAll("/", "-")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const savePassword = () => {
    if (newPassword.length < 4) {
      setPasswordError("密码至少需要 4 位");
      return;
    }
    localStorage.setItem("attendance-admin-password", newPassword);
    setAdminPassword(newPassword);
    setNewPassword("");
    setSettingsUnlocked(true);
    setPasswordError("");
    showToast(adminPassword ? "后台密码已更新" : "后台密码创建成功");
  };

  const unlockSettings = (event: React.FormEvent) => {
    event.preventDefault();
    if (passwordInput === adminPassword) {
      setSettingsUnlocked(true);
      setPasswordInput("");
      setPasswordError("");
    } else {
      setPasswordError("后台密码不正确");
    }
  };

  const toggleAuto = (name: string) => {
    setAutoSchedules((current) => {
      if (current[name]) {
        const next = { ...current };
        delete next[name];
        return next;
      }
      return { ...current, [name]: "13:00" };
    });
  };

  const updateAutoTime = (name: string, time: string) => {
    if (!time) return;
    setAutoSchedules((current) => ({ ...current, [name]: time }));
  };

  const navItems = [
    { id: "dashboard", label: "工作台", icon: LayoutDashboard },
    { id: "attendance", label: "考勤记录", icon: CalendarDays },
    { id: "team", label: "成员管理", icon: Users },
    { id: "settings", label: "系统设置", icon: Settings },
  ];

  const pageInfo: Record<string, { title: string; description: string }> = {
    dashboard: { title: "下午好，邹管理员", description: "今日打卡正在进行中，所有数据实时更新。" },
    attendance: { title: "考勤记录", description: "查看人脸、自动及管理员手动补录的全部记录。" },
    team: { title: "成员管理", description: "管理模型中已录入的 9 位团队成员。" },
    settings: { title: "系统设置", description: "设置后台密码和每位成员的自动打卡时间。" },
  };

  const renderSource = (record: AttendanceRecord) => {
    if (record.status === "pending") return <span className="muted">—</span>;
    if (record.source === "manual") return <span className="method manual"><PenLine size={15} />手动补录</span>;
    if (record.source === "auto") return <span className="method auto"><Bot size={15} />自动打卡</span>;
    return <span className="method"><ScanFace size={15} />人脸识别</span>;
  };

  const attendanceTable = (items: AttendanceRecord[]) => (
    <div className="table-wrap">
      <table>
        <thead><tr><th>成员</th><th>打卡时间</th><th>登记方式</th><th>详情</th><th>状态</th></tr></thead>
        <tbody>
          {items.map((record) => {
            const memberIndex = records.findIndex((item) => item.name === record.name);
            return (
              <tr key={record.name}>
                <td>
                  <div className="member-cell">
                    <span className={`member-avatar avatar-${memberIndex % 9}`}>{record.name.slice(0, 1)}</span>
                    <div><strong>{record.name}</strong><small>{record.name === "邹璨泽" ? "管理员" : "团队成员"}</small></div>
                  </div>
                </td>
                <td><strong className={record.status === "pending" ? "muted" : ""}>{record.time}</strong></td>
                <td>{renderSource(record)}</td>
                <td>
                  {record.source === "manual" ? <span className="record-note">{record.note}</span> :
                    record.confidence ? <span className="confidence-cell"><i><b style={{ width: `${record.confidence}%` }} /></i>{record.confidence}%</span> :
                    record.source === "auto" ? <span className="record-note">计划时间 {record.time.slice(0, 5)}</span> : <span className="muted">—</span>}
                </td>
                <td><span className={`status-badge ${record.status}`}><i />{statusText[record.status]}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {items.length === 0 && <div className="empty-state">没有找到符合条件的考勤记录</div>}
    </div>
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={20} strokeWidth={2.4} /></div>
          <div><strong>准点</strong><span>智能考勤</span></div>
        </div>
        <nav>
          <span className="nav-label">管理中心</span>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={`nav-item ${activeNav === item.id ? "active" : ""}`} onClick={() => { setActiveNav(item.id); setMobileNav(false); }}>
                <Icon size={19} /><span>{item.label}</span>
                {item.id === "attendance" && <em>{arrived}</em>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-tip">
          <span className="tip-icon"><Clock3 size={18} /></span>
          <strong>每日打卡时间</strong><span>中午 13:00 整</span><small>13:00 后打卡记为迟到</small>
        </div>
        <div className="admin-card">
          <div className="avatar">邹</div>
          <div><strong>邹璨泽</strong><span>系统管理员</span></div>
          <button aria-label="展开账户菜单"><ChevronDown size={16} /></button>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="打开菜单"><Menu size={21} /></button>
          <div className="live-status"><i /><span>系统运行正常</span></div>
          <div className="top-actions">
            <div className="current-time">{now.toLocaleTimeString("zh-CN", { hour12: false })}</div>
            <button className="icon-button notification" aria-label="通知"><Bell size={19} /><i /></button>
            <button className="logout-button"><LogOut size={17} />退出</button>
          </div>
        </header>

        <div className="content">
          <section className="hero-row">
            <div>
              <span className="date-line">{formatDate(now)}</span>
              <h1>{pageInfo[activeNav].title}</h1>
              <p>{pageInfo[activeNav].description}</p>
            </div>
            {(activeNav === "dashboard" || activeNav === "attendance") && (
              <div className="hero-actions">
                {activeNav === "attendance" && <button className="secondary-button tall" onClick={() => setManualOpen(true)}><Plus size={18} />手动补录</button>}
                <button className="primary-button" onClick={() => setCameraOpen(true)}><ScanFace size={20} />开始人脸打卡</button>
              </div>
            )}
          </section>

          {activeNav === "dashboard" && (
            <>
              <section className="metrics-grid" aria-label="今日考勤概览">
                <article className="metric-card featured">
                  <div className="metric-top"><span>今日出勤率</span><div className="metric-icon"><Users size={20} /></div></div>
                  <div className="metric-value">{attendanceRate}<small>%</small></div>
                  <div className="progress"><i style={{ width: `${attendanceRate}%` }} /></div><p>已打卡 {arrived} 人，共 {records.length} 人</p>
                </article>
                <article className="metric-card"><div className="metric-top"><span>准时打卡</span><div className="metric-icon green"><Check size={20} /></div></div><div className="metric-value">{normal}<small>人</small></div><p className="positive">今日 13:00 前完成</p></article>
                <article className="metric-card"><div className="metric-top"><span>迟到人数</span><div className="metric-icon orange"><Clock3 size={20} /></div></div><div className="metric-value">{late}<small>人</small></div><p>13:00 后记为迟到</p></article>
                <article className="metric-card"><div className="metric-top"><span>自动打卡</span><div className="metric-icon gray"><Bot size={19} /></div></div><div className="metric-value">{Object.keys(autoSchedules).length}<small>人</small></div><p>每位成员可设置不同时间</p></article>
              </section>
              <section className="attendance-panel">
                <div className="panel-header"><div><div className="panel-title-row"><h2>今日实时考勤</h2><span className="realtime-pill"><i />实时更新</span></div><p>人脸、补录和自动打卡统一展示</p></div><button className="secondary-button" onClick={() => setActiveNav("attendance")}>查看全部</button></div>
                {attendanceTable(records.slice(0, 6))}
              </section>
            </>
          )}

          {activeNav === "attendance" && (
            <section className="attendance-panel">
              <div className="panel-header">
                <div><div className="panel-title-row"><h2>今日考勤明细</h2><span className="realtime-pill"><i />实时更新</span></div><p>管理员补录操作需要验证后台密码</p></div>
                <button className="secondary-button" onClick={exportCsv}><Download size={17} />导出记录</button>
              </div>
              <div className="table-tools">
                <label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索成员姓名" /></label>
                <div className="filter-tabs">
                  {([["all", "全部"], ["normal", "准时"], ["late", "迟到"], ["pending", "待打卡"]] as const).map(([id, label]) => (
                    <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{label}</button>
                  ))}
                </div>
              </div>
              {attendanceTable(filteredRecords)}
            </section>
          )}

          {activeNav === "team" && (
            <section className="team-grid">
              {records.map((record, index) => (
                <article className="team-card" key={record.name}>
                  <div className={`profile-art profile-${index}`}>
                    <span>{record.name.slice(0, 1)}</span>
                    {record.name === "邹璨泽" && <i><ShieldCheck size={13} /></i>}
                  </div>
                  <div className="team-card-title"><div><h2>{record.name}</h2><p>{record.name === "邹璨泽" ? "系统管理员" : `成员编号 ${String(index + 1).padStart(2, "0")}`}</p></div><span className="model-ready"><i />已录入</span></div>
                  <div className="member-meta"><span><ScanFace size={15} />人脸模型可用</span><span><CalendarDays size={15} />今日 {statusText[record.status]}</span></div>
                </article>
              ))}
            </section>
          )}

          {activeNav === "settings" && (
            !adminPassword ? (
              <section className="access-card">
                <div className="access-icon"><LockKeyhole size={28} /></div>
                <span className="eyebrow">FIRST TIME SETUP</span><h2>创建管理员后台密码</h2>
                <p>密码用于进入系统设置，以及验证每一次手动补录操作。</p>
                <label className="field-label">新后台密码<input type="password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setPasswordError(""); }} placeholder="至少输入 4 位" /></label>
                {passwordError && <div className="form-error">{passwordError}</div>}
                <button className="primary-button full-button" onClick={savePassword}><LockKeyhole size={17} />创建密码并进入后台</button>
              </section>
            ) : !settingsUnlocked ? (
              <form className="access-card" onSubmit={unlockSettings}>
                <div className="access-icon"><LockKeyhole size={28} /></div>
                <span className="eyebrow">ADMIN ACCESS</span><h2>进入管理员后台</h2>
                <p>请输入后台密码后管理成员的自动打卡时间和安全设置。</p>
                <label className="field-label">后台密码<input type="password" value={passwordInput} onChange={(event) => { setPasswordInput(event.target.value); setPasswordError(""); }} placeholder="输入管理员密码" autoFocus /></label>
                {passwordError && <div className="form-error">{passwordError}</div>}
                <button className="primary-button full-button" type="submit"><ShieldCheck size={17} />验证并进入</button>
              </form>
            ) : (
              <div className="settings-layout">
                <section className="settings-panel">
                  <div className="settings-heading"><div className="settings-icon bot"><Bot size={21} /></div><div><h2>定时自动打卡</h2><p>可为每位成员设置任意的每日自动打卡时间。</p></div><span className="setting-count">{Object.keys(autoSchedules).length} 人已开启</span></div>
                  <div className="auto-list">
                    {records.map((record, index) => (
                      <div className="auto-row" key={record.name}>
                        <span className={`member-avatar avatar-${index % 9}`}>{record.name.slice(0, 1)}</span>
                        <div><strong>{record.name}</strong><small>{record.name === "邹璨泽" ? "管理员" : "团队成员"}</small></div>
                        {autoSchedules[record.name] && (
                          <label className="auto-time"><Clock3 size={14} /><input type="time" value={autoSchedules[record.name]} onChange={(event) => updateAutoTime(record.name, event.target.value)} aria-label={`${record.name}自动打卡时间`} /></label>
                        )}
                        <label className="switch"><input type="checkbox" checked={Boolean(autoSchedules[record.name])} onChange={() => toggleAuto(record.name)} /><span /></label>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="settings-panel security-panel">
                  <div className="settings-heading"><div className="settings-icon"><LockKeyhole size={20} /></div><div><h2>后台安全</h2><p>修改管理员后台密码。</p></div></div>
                  <label className="field-label">设置新密码<input type="password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setPasswordError(""); }} placeholder="至少输入 4 位" /></label>
                  {passwordError && <div className="form-error">{passwordError}</div>}
                  <button className="secondary-button save-password" onClick={savePassword}><UserCheck size={17} />更新后台密码</button>
                  <div className="security-foot"><ShieldCheck size={18} /><span>手动补录均需密码验证，并在记录中永久标记来源。</span></div>
                </section>
              </div>
            )
          )}
        </div>
      </main>

      {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} aria-label="关闭菜单" />}
      <CameraDialog open={cameraOpen} onClose={() => setCameraOpen(false)} onRecognized={onRecognized} />
      <ManualRecordDialog open={manualOpen} password={adminPassword} records={records} onClose={() => setManualOpen(false)} onSubmit={addManualRecord} />
      {toast && <div className="toast"><span><Check size={17} /></span>{toast}</div>}
    </div>
  );
}
