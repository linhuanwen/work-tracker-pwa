import { useState } from 'react';
import { useData } from './DataContext';
import { useToast } from './Toast';
import { ThemeToggle } from './ThemeToggle';
import { ThemePicker } from './ThemePicker';
import { loadAiConfig, saveAiConfig, DEFAULT_AI_CONFIG } from './aiConfig';
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
  const { data, dispatch } = useData();
  const { showToast } = useToast();

  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newCatValue, setNewCatValue] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);

  // AI 配置（存 localStorage，不进 data.json，避免 API Key 同步到云文档）
  const [aiConfig, setAiConfig] = useState(() => loadAiConfig());

  if (!data) return null;

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
      payload: { patch: { categories: newCategories }, oldCategory: editingCat ?? undefined },
    });
    setEditingCat(null);
    showToast('分类已更新');
  };

  const handleDelete = (cat: string) => {
    const count = taskCountByCat[cat] || 0;
    if (count > 0) {
      if (!confirm(`该分类下有 ${count} 个任务，删除后这些任务将变为"其他"分类。确定删除吗？`)) {
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

  const handleDayChange = (field: 'weeklySummaryDay' | 'monthlySummaryDay', value: number) => {
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: { patch: { [field]: value } },
    });
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
            <button className={styles.addConfirmBtn} onClick={handleAddCategory}>
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
            onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
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
            onChange={(e) => setAiConfig({ ...aiConfig, endpoint: e.target.value })}
            placeholder={DEFAULT_AI_CONFIG.endpoint}
          />
        </div>
        <div className={styles.aiField}>
          <label className={styles.aiLabel}>模型</label>
          <input
            className={styles.aiInput}
            type="text"
            value={aiConfig.model}
            onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
            placeholder={DEFAULT_AI_CONFIG.model}
          />
        </div>
        <button className={styles.aiSaveBtn} onClick={handleSaveAiConfig}>
          保存 AI 配置
        </button>
        <p className={styles.aiHint}>
          配置仅保存在本机浏览器存储中，不会写入共享的 data.json。
          留空 API Key 时，将使用 scripts/.env 中的配置。
        </p>
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
