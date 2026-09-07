import { useState, useRef, useEffect } from 'react';
import { useData } from './DataContext';
import { useToast } from './Toast';
import { ThemeToggle } from './ThemeToggle';
import { ThemePicker } from './ThemePicker';
import { loadAiConfig, saveAiConfig, DEFAULT_AI_CONFIG } from './aiConfig';
import { setBackendDataFolder } from './fs/backendApi';
import { useWindowControls } from './useWindowControls';
import {
  createSnapshotText,
  defaultExportFileName,
  parseImportText,
  mergeForImport,
} from './transferUtils';
import styles from './Settings.module.css';

const WEEK_DAYS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
];

const MONTH_DAYS = Array.from({ length: 28 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}号`,
}));

export function Settings() {
  const {
    data,
    dispatch,
    openDirectory,
    loading: folderLoading,
    hasStoredHandle,
    backendMode,
    backendFolderPath,
    lastFolderInfo,
  } = useData();
  const { showToast } = useToast();
  const { isDesktopWindow } = useWindowControls();

  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newCatValue, setNewCatValue] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  // 只允许后端已配置的绝对路径预填输入框；FSA 方式只记录文件夹名，
  // 名字≠路径，预填会让用户把相对名当绝对路径保存回去（后端找不到该目录）。
  const [folderPathInput, setFolderPathInput] = useState(
    backendMode ? (backendFolderPath ?? '') : '',
  );
  const [savingFolder, setSavingFolder] = useState(false);

  // 当后端路径变化时（例如保存成功后），同步输入框显示。
  useEffect(() => {
    if (backendMode) {
      setFolderPathInput(backendFolderPath ?? '');
    }
  }, [backendMode, backendFolderPath]);

  // AI 配置（存 localStorage，不进 data.json，避免 API Key 同步到云文档）
  const [aiConfig, setAiConfig] = useState(() => loadAiConfig());

  // 选择共享文件夹：桌面版走 pywebview 原生目录选择并把绝对路径注册给后端
  // （data.json 与总结文档都保存在所选文件夹）；纯浏览器退回 FSA 句柄方式。
  const chooseDataFolder = async () => {
    const pw = (window as unknown as {
      pywebview?: { api?: { pick_folder?: () => Promise<string | null> } };
    }).pywebview;
    const pickFolder = pw?.api?.pick_folder;

    if (typeof pickFolder === 'function') {
      let path: string | null = null;
      try {
        path = await pickFolder();
      } catch {
        // 桥调用异常：静默，仍可改用下方“保存路径”手动输入绝对路径
      }
      if (!path) return; // 用户取消选择
      const result = await setBackendDataFolder(path);
      if (!result.ok) {
        showToast(result.error || '保存共享文件夹路径失败');
        return;
      }
      showToast('已设置共享文件夹');
      // 重新挂载：让 backendMode / 后端路径 / 数据加载统一走后端。
      window.location.reload();
      return;
    }

    // 纯浏览器环境（无 pywebview 桥）：退回 File System Access 句柄方式
    try {
      await openDirectory();
      showToast('已设置共享文件夹');
    } catch {
      // 用户取消或选择失败时静默处理
    }
  };

  // ---- 数据迁移（导入 / 导出）----
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPending, setImportPending] = useState<{
    name: string;
    data: ReturnType<typeof parseImportText>;
  } | null>(null);

  if (!data) {
    return (
      <div className={styles.container}>
        <h2 className={styles.heading}>设置</h2>
        <section className={styles.section}>
          <p className={styles.folderHint}>
            数据尚未加载。如果这是新电脑，请先选择共享文件夹；也可以直接开始使用本地内存数据。
          </p>
          <div className={styles.folderRow}>
            <button
              className={styles.folderBtn}
              onClick={chooseDataFolder}
              disabled={folderLoading}
            >
              {folderLoading ? '加载中…' : '选择共享文件夹'}
            </button>
          </div>
        </section>
      </div>
    );
  }

  const handleExport = async () => {
    const text = createSnapshotText(data);
    const blob = new Blob([text], { type: 'application/json' });
    const fileName = defaultExportFileName();

    const w = window as unknown as {
      showSaveFilePicker?: (opts: {
        suggestedName?: string;
        types?: { description?: string; accept: Record<string, string[]> }[];
      }) => Promise<{
        createWritable: () => Promise<{
          write: (d: unknown) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    };

    if (typeof w.showSaveFilePicker === 'function') {
      try {
        const handle = await w.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'JSON 数据文件',
              accept: { 'application/json': ['.json'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        showToast('已导出全部数据');
        return;
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return;
        // 降级到下载
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('已导出全部数据');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseImportText(String(reader.result ?? ''));
        setImportPending({ name: file.name, data: imported });
      } catch (err) {
        showToast(err instanceof Error ? err.message : '导入文件无效');
      }
    };
    reader.readAsText(file);
    // 允许重复选择同一文件
    e.target.value = '';
  };

  const handleConfirmOverwrite = () => {
    if (!importPending || !data) return;
    const imported = importPending.data;
    // 导入内容来自其他目录/更早的导出，其 revision 与当前数据往往不一致；
    // 若直接沿用，自动保存的 revision 校验会把导入误判为“其他设备修改”而拒写。
    // 覆盖后 revision 归位到当前基线，内容差异由随后的自动保存正常落盘。
    dispatch({
      type: 'SET_DATA',
      payload: {
        ...imported,
        revision: data.revision ?? 0,
        lastModified: data.lastModified ?? imported.lastModified,
      },
    });
    setImportPending(null);
    showToast(
      `已覆盖导入（含 ${imported.tasks.length} 个任务、${imported.projects.length} 个项目）`,
    );
  };

  const handleConfirmMerge = () => {
    if (!importPending || !data) return;
    const { data: merged, summary } = mergeForImport(data, importPending.data);
    dispatch({ type: 'SET_DATA', payload: merged });
    setImportPending(null);
    const parts = [
      `合并结果：${merged.tasks.length} 个任务`,
      `${merged.projects.length} 个项目`,
    ];
    if (summary.remappedTaskIds > 0)
      parts.push(`${summary.remappedTaskIds} 个任务 id 冲突已重命名`);
    if (summary.remappedProjectIds > 0)
      parts.push(`${summary.remappedProjectIds} 个项目 id 冲突已重命名`);
    showToast(parts.join('、'));
  };

  const categories = data.settings.categories;
  const weeklyDay = data.settings.weeklySummaryDay;
  const monthlyDay = data.settings.monthlySummaryDay;

  // Count tasks per category
  const taskCountByCat: Record<string, number> = {};
  for (const t of data.tasks) {
    taskCountByCat[t.category] = (taskCountByCat[t.category] || 0) + 1;
  }

  const handleStartEdit = (cat: string) => {
    setEditingCat(cat);
    setEditValue(cat);
  };

  const handleSaveEdit = () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === editingCat) {
      setEditingCat(null);
      return;
    }
    if (categories.includes(trimmed)) {
      showToast('分类名称已存在');
      return;
    }
    const newCategories = categories.map((c) =>
      c === editingCat ? trimmed : c,
    );
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: {
        patch: { categories: newCategories },
        oldCategory: editingCat ?? undefined,
      },
    });
    setEditingCat(null);
    showToast('分类已更新');
  };

  const handleDelete = (cat: string) => {
    const count = taskCountByCat[cat] || 0;
    if (count > 0) {
      if (
        !confirm(
          `该分类下有 ${count} 个任务，删除后这些任务将变为"其他"分类。确定删除吗？`,
        )
      ) {
        return;
      }
    }
    const newCategories = categories.filter((c) => c !== cat);
    // Reassign tasks from deleted category to '其他'
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: { patch: { categories: newCategories }, oldCategory: cat },
    });
    // When a category is deleted, update all its tasks to '其他'
    for (const t of data.tasks) {
      if (t.category === cat) {
        dispatch({
          type: 'UPDATE_TASK',
          payload: { taskId: t.id, patch: { category: '其他' } },
        });
      }
    }
    showToast('分类已删除');
  };

  const handleAddCategory = () => {
    const trimmed = newCatValue.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      showToast('分类名称已存在');
      return;
    }
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: { patch: { categories: [...categories, trimmed] } },
    });
    setNewCatValue('');
    setShowAddInput(false);
    showToast('分类已添加');
  };

  const handleDayChange = (
    field: 'weeklySummaryDay' | 'monthlySummaryDay',
    value: number,
  ) => {
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: { patch: { [field]: value } },
    });
  };

  const handleSaveFolderPath = async () => {
    const path = folderPathInput.trim();
    if (!path) return;
    setSavingFolder(true);
    try {
      const result = await setBackendDataFolder(path);
      if (!result.ok) {
        showToast(result.error || '保存共享文件夹路径失败');
        return;
      }
      showToast('已设置共享文件夹');
      // 重新挂载：backendMode / 数据加载统一走后端，避免残留 FSA 句柄状态。
      window.location.reload();
    } catch {
      showToast('保存共享文件夹路径失败');
    } finally {
      setSavingFolder(false);
    }
  };

  const handleSaveAiConfig = () => {
    saveAiConfig({
      apiKey: aiConfig.apiKey.trim(),
      endpoint: aiConfig.endpoint.trim() || DEFAULT_AI_CONFIG.endpoint,
      model: aiConfig.model.trim() || DEFAULT_AI_CONFIG.model,
    });
    showToast('AI 配置已保存');
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>设置</h2>

      {/* ---- 共享文件夹 ---- */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>共享文件夹</h3>
        <p className={styles.folderHint}>
          {hasStoredHandle || backendMode
            ? '已设置共享文件夹，报表功能可用。数据将保存到所选云同步文件夹的 data.json。'
            : '未设置共享文件夹，报表功能暂不启用。请选择一个云同步文件夹（如 WPS 云文档、OneDrive、坚果云），应用会在该文件夹中保存 data.json，实现多设备同步。'}
          {isDesktopWindow && (
            <>
              <br />
              桌面版点“选择共享文件夹”会打开系统目录选择框并<strong>自动保存绝对路径</strong>；data.json 与生成的总结文档（周报/月报/年报 子目录）都保存在所选文件夹。
            </>
          )}
        </p>

        <div className={styles.folderRow}>
          <span className={styles.folderPath}>
            {backendMode
              ? backendFolderPath ?? '已配置'
              : lastFolderInfo?.folderName
                ? `已选择：${lastFolderInfo.folderName}`
                : '尚未设置'}
          </span>
          <button
            className={styles.folderBtn}
            onClick={chooseDataFolder}
            disabled={folderLoading}
          >
            {folderLoading ? '加载中…' : hasStoredHandle || backendMode ? '更改共享文件夹' : '选择共享文件夹'}
          </button>
        </div>

        {(backendMode || isDesktopWindow) && (
          <div className={styles.folderPathRow}>
            <input
              className={styles.folderInput}
              type="text"
              value={folderPathInput}
              onChange={(e) => setFolderPathInput(e.target.value)}
              placeholder="输入共享文件夹绝对路径（如 D:\\文档\\WPS云文档\\工作清单）"
            />
            <button
              className={styles.folderSaveBtn}
              onClick={handleSaveFolderPath}
              disabled={savingFolder || !folderPathInput.trim()}
            >
              {savingFolder ? '保存中…' : '保存路径'}
            </button>
          </div>
        )}
      </section>

      {/* ---- 分类管理 ---- */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>分类管理</h3>
        <ul className={styles.catList}>
          {categories.map((cat) => (
            <li key={cat} className={styles.catItem}>
              {editingCat === cat ? (
                <input
                  className={styles.catInput}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') setEditingCat(null);
                  }}
                  autoFocus
                />
              ) : (
                <span
                  className={styles.catName}
                  onClick={() => handleStartEdit(cat)}
                  title="点击编辑"
                >
                  {cat}
                </span>
              )}
              <span className={styles.catCount}>
                {taskCountByCat[cat] || 0} 个任务
              </span>
              <div className={styles.catActions}>
                <button
                  className={styles.catEditBtn}
                  onClick={() => handleStartEdit(cat)}
                  title="编辑"
                >
                  编辑
                </button>
                <button
                  className={styles.catDelBtn}
                  onClick={() => handleDelete(cat)}
                  title="删除"
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>

        {showAddInput ? (
          <div className={styles.addRow}>
            <input
              className={styles.catInput}
              value={newCatValue}
              onChange={(e) => setNewCatValue(e.target.value)}
              onBlur={() => {
                if (!newCatValue.trim()) setShowAddInput(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCategory();
                if (e.key === 'Escape') {
                  setNewCatValue('');
                  setShowAddInput(false);
                }
              }}
              placeholder="新分类名称"
              autoFocus
            />
            <button
              className={styles.addConfirmBtn}
              onClick={handleAddCategory}
            >
              确认
            </button>
          </div>
        ) : (
          <button
            className={styles.addBtn}
            onClick={() => setShowAddInput(true)}
          >
            + 添加分类
          </button>
        )}
      </section>

      {/* ---- 结日配置 ---- */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>结日配置</h3>
        <div className={styles.dayRow}>
          <label className={styles.dayLabel}>周结日</label>
          <select
            className={styles.daySelect}
            value={weeklyDay}
            onChange={(e) =>
              handleDayChange('weeklySummaryDay', Number(e.target.value))
            }
          >
            {WEEK_DAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.dayRow}>
          <label className={styles.dayLabel}>月结日</label>
          <select
            className={styles.daySelect}
            value={monthlyDay}
            onChange={(e) =>
              handleDayChange('monthlySummaryDay', Number(e.target.value))
            }
          >
            {MONTH_DAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* ---- AI 配置 ---- */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>AI 配置</h3>
        <div className={styles.aiField}>
          <label className={styles.aiLabel}>API Key</label>
          <input
            className={styles.aiInput}
            type="password"
            value={aiConfig.apiKey}
            onChange={(e) =>
              setAiConfig({ ...aiConfig, apiKey: e.target.value })
            }
            placeholder="sk-…"
            autoComplete="off"
          />
        </div>
        <div className={styles.aiField}>
          <label className={styles.aiLabel}>接口地址</label>
          <input
            className={styles.aiInput}
            type="text"
            value={aiConfig.endpoint}
            onChange={(e) =>
              setAiConfig({ ...aiConfig, endpoint: e.target.value })
            }
            placeholder={DEFAULT_AI_CONFIG.endpoint}
          />
        </div>
        <div className={styles.aiField}>
          <label className={styles.aiLabel}>模型</label>
          <input
            className={styles.aiInput}
            type="text"
            value={aiConfig.model}
            onChange={(e) =>
              setAiConfig({ ...aiConfig, model: e.target.value })
            }
            placeholder={DEFAULT_AI_CONFIG.model}
          />
        </div>
        <button className={styles.aiSaveBtn} onClick={handleSaveAiConfig}>
          保存 AI 配置
        </button>
        <p className={styles.aiHint}>
          配置仅保存在本机浏览器存储中，不会写入共享的 data.json。
          保存后立即生效：桌面端与浏览器端的「AI 润色」和「生成总结文档」都会使用此处配置。
          若未填写 API Key，则回退读取可执行文件旁的 scripts/.env。
        </p>
      </section>

      {/* ---- 数据迁移 ---- */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>数据迁移</h3>
        <p className={styles.migrationHint}>
          导出全部数据为单个 JSON 文件，可在新电脑上导入，用于迁移或备份。
        </p>
        <div className={styles.migrationRow}>
          <button className={styles.migrationBtn} onClick={handleExport}>
            导出全部数据
          </button>
          <button
            className={styles.migrationBtn}
            onClick={() => fileInputRef.current?.click()}
          >
            导入数据文件…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {importPending && (
          <div className={styles.importPreview}>
            <p>
              文件 <strong>{importPending.name}</strong> 包含{' '}
              {importPending.data.tasks.length} 个任务、{' '}
              {importPending.data.projects.length} 个项目。请选择导入方式：
            </p>
            <div className={styles.migrationRow}>
              <button
                className={styles.migrationBtn}
                onClick={handleConfirmMerge}
              >
                合并导入
              </button>
              <button
                className={styles.migrationBtnDanger}
                onClick={handleConfirmOverwrite}
              >
                覆盖导入
              </button>
              <button
                className={styles.migrationBtnGhost}
                onClick={() => setImportPending(null)}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ---- 主题色 ---- */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>主题色</h3>
        <ThemePicker />
      </section>

      {/* ---- 主题模式 ---- */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>主题模式</h3>
        <ThemeToggle />
      </section>
    </div>
  );
}
