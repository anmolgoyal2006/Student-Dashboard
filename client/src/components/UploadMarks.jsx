/**
 * UploadMarks.jsx — dynamic multi-PDF leaderboard
 *
 * Flow:
 *   1. Select one or more PDFs → parse via POST /marks/parse-pdfs
 *   2. Set label + per-score weights (file weight is auto sum of column weights)
 *   3. Generate leaderboard → POST /marks/generate-leaderboard
 */
import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import Leaderboard from './Leaderboard';
import MarksFilter from './MarksFilter';
import WeightInput from './WeightInput';
import OcrReviewPanel from './OcrReviewPanel';
import { marksService } from '../services/apiServices';

/** Sum of selected column weights for one PDF (drives file-level weight in merge). */
function getSourceFileWeight(src) {
  const selected = src.selectedColumns || [];
  const weights = src.columnWeights || {};
  const maxByCol = Object.fromEntries((src.columns || []).map((c) => [c.name, c.max]));
  return selected.reduce((sum, col) => {
    const w = weights[col];
    const effective = w !== undefined && w !== '' ? Number(w) : (maxByCol[col] || 0);
    return sum + (Number.isFinite(effective) ? effective : 0);
  }, 0);
}

export default function UploadMarks({ onResult }) {
  const [sources, setSources]       = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading]       = useState(false);

  const [bestOfGroups, setBestOfGroups] = useState([]);
  const [relativeGradingEnabled, setRelativeGradingEnabled] = useState(false);
  const [gradeCounts, setGradeCounts] = useState({
    'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C+': 0, 'C': 0, 'D': 0, 'F': 0
  });

  const [showOcrReview, setShowOcrReview] = useState(false);
  const [sgpaLeaderboard, setSgpaLeaderboard] = useState(null);
  const [sgpaLoading, setSgpaLoading] = useState(false);
  const [ocrCorrectedGrades, setOcrCorrectedGrades] = useState(null);
  const [rawFiles, setRawFiles] = useState({});
  const [pdfSavingStates, setPdfSavingStates] = useState({});
  const [sgpaSearch, setSgpaSearch] = useState('');
  const [showSavePromptModal, setShowSavePromptModal] = useState(false);
  const [pendingGenerateAction, setPendingGenerateAction] = useState(null);
  const [savePromptFiles, setSavePromptFiles] = useState([]);
  const [showSavedPdfsSelectorModal, setShowSavedPdfsSelectorModal] = useState(false);
  const [availableSavedPdfs, setAvailableSavedPdfs] = useState([]);
  const [savedPdfsSelectorLoading, setSavedPdfsSelectorLoading] = useState(false);

  const hasOcrSources = useMemo(
    () => sources.some((src) =>
      (src.studentRows || []).some((row) => row.source === 'ocr' || row.ocrGradeRaw)
    ),
    [sources]
  );

  const gradedStudents = useMemo(() => {
    const rawStudents = leaderboard?.leaderboard?.[0]?.students || [];
    if (!relativeGradingEnabled) return rawStudents;

    const gradesOrder = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'];
    let idx = 0;
    return rawStudents.map((s) => {
      let grade = 'F';
      let cumulative = 0;
      for (const g of gradesOrder) {
        const quota = parseInt(gradeCounts[g]) || 0;
        cumulative += quota;
        if (idx < cumulative) {
          grade = g;
          break;
        }
      }
      idx++;
      return { ...s, grade };
    });
  }, [leaderboard, relativeGradingEnabled, gradeCounts]);

  const totalWeight = useMemo(
    () => sources.reduce((s, src) => s + getSourceFileWeight(src), 0),
    [sources]
  );

  const normalizedPreview = useMemo(() => {
    if (totalWeight <= 0) return {};
    return Object.fromEntries(
      sources.map((src) => {
        const fw = getSourceFileWeight(src);
        return [src.id, Math.round((fw / totalWeight) * 10000) / 100];
      })
    );
  }, [sources, totalWeight]);

  const formatParsedSource = (s) => {
    const cols = s.columns || [];
    const defaultColWeights = Object.fromEntries(
      cols.map((c) => [c.name, s.columnWeights?.[c.name] ?? c.max])
    );
    return {
      ...s,
      selectedColumns: s.selectedColumns?.length
        ? s.selectedColumns
        : cols.map((c) => c.name),
      columnWeights: { ...defaultColWeights, ...(s.columnWeights || {}) },
      studentLimit: s.studentLimit !== undefined ? s.studentLimit : s.studentCount,
    };
  };

  const handleFilesSelected = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) =>
      f.name.toLowerCase().endsWith('.pdf')
    );
    if (!files.length) {
      toast.error('Please select at least one PDF file.');
      return;
    }

    setLoading(true);

    try {
      const form = new FormData();
      files.forEach((f) => form.append('files', f));

      const res = await marksService.parsePdfs(form);
      const incoming = (res.data.sources || []).map(formatParsedSource);

      setSources((prev) => [...prev, ...incoming]);

      setRawFiles((prev) => {
        const next = { ...prev };
        incoming.forEach((src) => {
          const matchingFile = files.find((f) => f.name === src.fileName);
          if (matchingFile) {
            next[src.id] = matchingFile;
          }
        });
        return next;
      });

      setLeaderboard(null);
      onResult?.(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to parse PDFs.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSavedPdfsSelector = async () => {
    setSavedPdfsSelectorLoading(true);
    setShowSavedPdfsSelectorModal(true);
    try {
      const res = await marksService.getSavedPdfs();
      setAvailableSavedPdfs(res.data.pdfs || []);
    } catch (err) {
      toast.error('Failed to load saved PDFs.');
    } finally {
      setSavedPdfsSelectorLoading(false);
    }
  };

  const handleLoadSavedPdf = async (pdfId) => {
    setLoading(true);
    setShowSavedPdfsSelectorModal(false);
    try {
      const res = await marksService.parseSavedPdf(pdfId);
      const incoming = formatParsedSource(res.data.source);
      
      setSources((prev) => [...prev, incoming]);
      toast.success(`"${incoming.label}" loaded from library!`);
      
      setLeaderboard(null);
      onResult?.(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load saved PDF.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePdf = async (srcId, customName) => {
    const rawFile = rawFiles[srcId];
    if (!rawFile) {
      toast.error('Original PDF file is missing.');
      return;
    }
    if (!customName || !customName.trim()) {
      toast.error('Please enter a name to save the PDF.');
      return;
    }

    setPdfSavingStates(prev => ({ ...prev, [srcId]: true }));
    try {
      const formData = new FormData();
      formData.append('file', rawFile);
      formData.append('name', customName.trim());

      const res = await marksService.savePdf(formData);
      toast.success(`"${customName}" saved to your library!`);
      updateSourceNested(srcId, { isSaved: true, dbId: res.data.pdf.id });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save PDF.');
    } finally {
      setPdfSavingStates(prev => ({ ...prev, [srcId]: false }));
    }
  };

  const handleDeleteSavedPdf = async (srcId, dbId) => {
    if (!dbId) return;
    if (!window.confirm('Are you sure you want to delete this PDF from your saved library?')) return;
    
    setPdfSavingStates(prev => ({ ...prev, [srcId]: true }));
    try {
      await marksService.deleteSavedPdf(dbId);
      toast.success('PDF deleted from your library.');
      updateSourceNested(srcId, { isSaved: false, dbId: null });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete saved PDF.');
    } finally {
      setPdfSavingStates(prev => ({ ...prev, [srcId]: false }));
    }
  };

  const updateSource = (id, field, value) => {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const updateSourceNested = (id, patch) => {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  const removeSource = (id) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
    setBestOfGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: (g.items || []).filter((item) => item.sourceId !== id),
      })).filter((g) => (g.items || []).length > 0)
    );
    setLeaderboard(null);
    onResult?.(null);
  };

  const addBestOfGroup = () => {
    setBestOfGroups((prev) => [
      ...prev,
      { id: `bg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, bestOf: 2, items: [] },
    ]);
  };

  const updateBestOfGroup = (id, patch) => {
    setBestOfGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const removeBestOfGroup = (id) => {
    setBestOfGroups((prev) => prev.filter((g) => g.id !== id));
  };

  const addItemToGroup = (groupId) => {
    const firstSrc = sources[0];
    const firstCol = firstSrc?.columns?.[0]?.name || '';
    setBestOfGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return { ...g, items: [...(g.items || []), { sourceId: firstSrc?.id || '', columnName: firstCol, outOf: '' }] };
      })
    );
  };

  const updateItemInGroup = (groupId, itemIndex, patch) => {
    setBestOfGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const items = (g.items || []).map((item, idx) =>
          idx === itemIndex ? { ...item, ...patch } : item
        );
        return { ...g, items };
      })
    );
  };

  const removeItemFromGroup = (groupId, itemIndex) => {
    setBestOfGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return { ...g, items: (g.items || []).filter((_, idx) => idx !== itemIndex) };
      })
    );
  };

  const runGenerateStandard = async () => {
    // ── Compute best-of column map (used for validations + payload) ──
    const bestOfColsBySource = new Map();
    for (const g of bestOfGroups) {
      for (const item of (g.items || [])) {
        if (!bestOfColsBySource.has(item.sourceId)) {
          bestOfColsBySource.set(item.sourceId, new Set());
        }
        bestOfColsBySource.get(item.sourceId).add(item.columnName);
      }
    }

    const isSourceCoveredByBestOf = (s) => {
      const cols = bestOfColsBySource.get(s.id);
      if (!cols || cols.size === 0) return false;
      const allSourceCols = new Set((s.columns || []).map((c) => c.name));
      return [...cols].every((c) => allSourceCols.has(c));
    };

    setLoading(true);

    try {
      const bestOfConfigs = bestOfGroups
        .filter((g) => (g.items || []).length >= 1)
        .map((g) => ({
          items: (g.items || []).map((item) => {
            const outOf = parseFloat(item.outOf);
            return {
              sourceId: item.sourceId,
              columnName: item.columnName,
              ...(isFinite(outOf) && outOf > 0 ? { outOf } : {}),
            };
          }),
          bestOf: Math.max(1, parseInt(g.bestOf, 10) || 2),
        }));

      const payload = {
        sources: sources.map((s) => {
          // Auto-include best-of columns so breakdown data is available
          const bestOfCols = bestOfColsBySource.get(s.id);
          let selectedColumns = s.selectedColumns || [];
          if (bestOfCols) {
            const merged = new Set(selectedColumns);
            for (const col of bestOfCols) merged.add(col);
            selectedColumns = [...merged];
          }
          return {
            id              : s.id,
            label           : s.label.trim(),
            weight          : isSourceCoveredByBestOf(s) ? 0 : getSourceFileWeight(s),
            columns         : s.columns,
            studentRows     : s.studentLimit ? s.studentRows.slice(0, s.studentLimit) : s.studentRows,
            selectedColumns,
            columnWeights   : s.columnWeights,
            studentLimit    : s.studentLimit || s.studentRows.length,
          };
        }),
        bestOfConfigs,
        relativeGradingEnabled,
        gradeCounts,
      };

      const res = await marksService.generateLeaderboard(payload);

      setLeaderboard(res.data);
      onResult?.(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate leaderboard.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!sources.length) {
      toast.error('Upload at least one PDF first.');
      return;
    }

    // ── Compute best-of column map (used for validations + payload) ──
    const bestOfColsBySource = new Map();
    for (const g of bestOfGroups) {
      for (const item of (g.items || [])) {
        if (!bestOfColsBySource.has(item.sourceId)) {
          bestOfColsBySource.set(item.sourceId, new Set());
        }
        bestOfColsBySource.get(item.sourceId).add(item.columnName);
      }
    }

    const isSourceCoveredByBestOf = (s) => {
      const cols = bestOfColsBySource.get(s.id);
      if (!cols || cols.size === 0) return false;
      const allSourceCols = new Set((s.columns || []).map((c) => c.name));
      return [...cols].every((c) => allSourceCols.has(c));
    };

    if (totalWeight <= 0 && sources.some((s) => !isSourceCoveredByBestOf(s))) {
      toast.error('Total weight must be greater than zero.');
      return;
    }
    if (sources.some((s) => !String(s.label || '').trim())) {
      toast.error('Every PDF must have a label.');
      return;
    }
    // Allow 0 selected columns if source is fully covered by best-of groups
    if (sources.some((s) => {
      if (s.selectedColumns?.length) return false;
      return !isSourceCoveredByBestOf(s);
    })) {
      toast.error('Each PDF must have at least one score column selected.');
      return;
    }
    // Weight check: skip sources fully covered by best-of
    if (sources.some((s) => {
      if (isSourceCoveredByBestOf(s)) return false;
      return getSourceFileWeight(s) <= 0;
    })) {
      toast.error('Each PDF must have at least one score with a weight greater than zero.');
      return;
    }

    // Intercept check for unsaved PDFs
    const unsaved = sources.filter(s => !s.isSaved);
    if (unsaved.length > 0) {
      setSavePromptFiles(unsaved.map(s => ({
        id: s.id,
        fileName: s.fileName,
        label: s.label,
        saveName: s.saveName || s.label || s.fileName.replace(/\.pdf$/i, ''),
        checked: true
      })));
      setPendingGenerateAction('standard');
      setShowSavePromptModal(true);
      return;
    }

    await runGenerateStandard();
  };

  const handleSaveAllSelectedPdfs = async () => {
    const toSave = savePromptFiles.filter(f => f.checked);
    const newSavingStates = { ...pdfSavingStates };
    toSave.forEach(f => { newSavingStates[f.id] = true; });
    setPdfSavingStates(newSavingStates);
    
    let savedCount = 0;
    for (const f of toSave) {
      const rawFile = rawFiles[f.id];
      if (!rawFile) {
        toast.error(`Original PDF file for "${f.fileName}" is missing.`);
        continue;
      }
      if (!f.saveName || !f.saveName.trim()) {
        toast.error(`Please enter a custom name for "${f.fileName}".`);
        continue;
      }
      
      try {
        const formData = new FormData();
        formData.append('file', rawFile);
        formData.append('name', f.saveName.trim());

        const res = await marksService.savePdf(formData);
        updateSourceNested(f.id, { isSaved: true, saveToAccount: true, saveName: f.saveName.trim(), dbId: res.data.pdf.id });
        savedCount++;
      } catch (err) {
        toast.error(`Failed to save "${f.fileName}": ${err.response?.data?.message || err.message}`);
      }
    }
    
    setPdfSavingStates(prev => {
      const copy = { ...prev };
      toSave.forEach(f => { delete copy[f.id]; });
      return copy;
    });

    if (savedCount > 0) {
      toast.success(`Successfully saved ${savedCount} PDF(s) to library.`);
    }
    setShowSavePromptModal(false);
    runPendingGeneration();
  };

  const runPendingGeneration = () => {
    const action = pendingGenerateAction;
    setPendingGenerateAction(null);
    if (action === 'standard') {
      runGenerateStandard();
    } else if (action === 'sgpa') {
      runGenerateSgpaDirect();
    } else if (action === 'sgpa_ocr') {
      runGenerateSgpa();
    }
  };

  const handleSkipSaving = () => {
    const action = pendingGenerateAction;
    setPendingGenerateAction(null);
    setShowSavePromptModal(false);
    if (action === 'standard') {
      runGenerateStandard();
    } else if (action === 'sgpa') {
      runGenerateSgpaDirect();
    } else if (action === 'sgpa_ocr') {
      runGenerateSgpa();
    }
  };

  const handleCancelModal = () => {
    setPendingGenerateAction(null);
    setShowSavePromptModal(false);
  };

  const handleDownloadExcel = () => {
    if (!gradedStudents.length) {
      alert('No leaderboard data to export.');
      return;
    }

    const labels = (leaderboard.sources || sources).map((s) => s.label);
    const bestOfGroupsMeta = leaderboard.bestOfGroups || [];
    const bestOfColLabels = bestOfGroupsMeta.map((g, i) =>
      `Best ${g.bestOf}/${g.itemCount}: ${g.label}`
    );

    const rows = gradedStudents.map((s) => {
      const row = { Rank: s.rank, Name: s.name, Roll: s.roll || '' };

      labels.forEach((label) => {
        row[label] = s.breakdown?.[label]?.raw ?? 0;
      });

      bestOfGroupsMeta.forEach((bg, i) => {
        const key = `🎯 ${bg.label}`;
        const bd = s.breakdown?.[key];
        row[bestOfColLabels[i]] = bd?.score ?? 0;
        if (bd?.bestOf?.selected?.length) {
          row[`Best ${i + 1} selected`] = bd.bestOf.selected.join(', ');
        }
      });

      row['Final Score'] = s.totalScore;
      if (relativeGradingEnabled) {
        row['Grade'] = s.grade || 'F';
      }
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leaderboard');
    XLSX.writeFile(wb, 'leaderboard.xlsx');
  };

  const handleOcrReviewProceed = (correctedGrades) => {
    setOcrCorrectedGrades(correctedGrades);
    setShowOcrReview(false);
  };

  const runGenerateSgpa = async () => {
    setSgpaLoading(true);
    setLeaderboard(null);
    try {
      const payload = {
        sources: sources.map((s) => ({
          id: s.id,
          fileName: s.fileName,
          label: s.label.trim(),
          credits: s.credits || 4,
          studentRows: s.studentLimit
            ? s.studentRows.slice(0, s.studentLimit)
            : s.studentRows,
        })),
        correctedGrades: ocrCorrectedGrades,
      };

      const res = await marksService.ocrReviewGenerate(payload);
      setSgpaLeaderboard(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate SGPA leaderboard.');
    } finally {
      setSgpaLoading(false);
    }
  };

  const handleGenerateSgpa = async () => {
    if (!ocrCorrectedGrades) {
      toast.error('Please review and save OCR corrections first.');
      return;
    }

    const unsaved = sources.filter(s => !s.isSaved);
    if (unsaved.length > 0) {
      setSavePromptFiles(unsaved.map(s => ({
        id: s.id,
        fileName: s.fileName,
        label: s.label,
        saveName: s.saveName || s.label || s.fileName.replace(/\.pdf$/i, ''),
        checked: true
      })));
      setPendingGenerateAction('sgpa_ocr');
      setShowSavePromptModal(true);
      return;
    }

    await runGenerateSgpa();
  };

  const runGenerateSgpaDirect = async () => {
    setSgpaLoading(true);
    setLeaderboard(null);
    try {
      const payload = {
        sources: sources.map((s) => ({
          id: s.id,
          fileName: s.fileName,
          label: s.label.trim(),
          credits: s.credits || 4,
          studentRows: s.studentLimit
            ? s.studentRows.slice(0, s.studentLimit)
            : s.studentRows,
        })),
      };

      const res = await marksService.generateSgpaLeaderboard(payload);
      setSgpaLeaderboard(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate SGPA leaderboard.');
    } finally {
      setSgpaLoading(false);
    }
  };

  const handleGenerateSgpaDirect = async () => {
    const unsaved = sources.filter(s => !s.isSaved);
    if (unsaved.length > 0) {
      setSavePromptFiles(unsaved.map(s => ({
        id: s.id,
        fileName: s.fileName,
        label: s.label,
        saveName: s.saveName || s.label || s.fileName.replace(/\.pdf$/i, ''),
        checked: true
      })));
      setPendingGenerateAction('sgpa');
      setShowSavePromptModal(true);
      return;
    }

    await runGenerateSgpaDirect();
  };

  const handleSgpaDownloadExcel = () => {
    if (!sgpaLeaderboard?.rankedStudents?.length) return;
    const rows = sgpaLeaderboard.rankedStudents.map((s) => ({
      Rank: s.rank,
      SID: s.sid || '',
      'Roll Number': s.roll || '',
      'Student Name': s.name,
      SGPA: s.sgpa,
      'Total Credits': s.totalCredits,
      'Subjects Count': s.subjectsCount,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SGPA Leaderboard');
    XLSX.writeFile(wb, 'sgpa-leaderboard.xlsx');
  };

  const handleReset = () => {
    setSources([]);
    setBestOfGroups([]);
    setLeaderboard(null);
    setSgpaLeaderboard(null);
    setShowOcrReview(false);
    setOcrCorrectedGrades(null);
    onResult?.(null);
  };

  return (
    <>
      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>📄 Upload PDFs & Rank Students</div>

        {/* Visual Guide Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(165,180,252,0.03) 100%)',
          border: '1px solid rgba(129,140,248,0.2)',
          borderRadius: 12,
          padding: '20px 24px',
          marginBottom: 20,
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📊</span> Multi-PDF Student Ranking System
          </h3>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
            Easily merge separate test or exam PDF files to generate a unified leaderboard, compute weighted grades, and track student performance.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ fontSize: 20, marginTop: 2 }}>📂</span>
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>1. Upload PDFs</h4>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                  Drag & drop PDFs containing student marks. They are automatically matched by name.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ fontSize: 20, marginTop: 2 }}>⚙️</span>
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>2. Customize Weights</h4>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                  Set weight multipliers for each score column or group them for "Best N of M" evaluation.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ fontSize: 20, marginTop: 2 }}>🏆</span>
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>3. Rank & Export</h4>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                  Generate ranked leaderboards, configure relative grading limits, and download report Excel.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            border: '2px dashed var(--card-border)',
            borderRadius: 10,
            padding: 24,
            textAlign: 'center',
            marginBottom: 16,
            cursor: 'pointer',
          }}
          onClick={() => document.getElementById('pdf-multi-input').click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFilesSelected(e.dataTransfer.files);
          }}
        >
          <span>🗂 Drag & drop PDFs here, or <u>click to browse</u></span>
          <input
            id="pdf-multi-input"
            type="file"
            accept=".pdf"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleOpenSavedPdfsSelector}
          >
            📂 Choose from Saved PDFs
          </button>
        </div>

        {sources.length > 0 && (
          <>
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--muted)' }}>
              {sources.length} PDF{sources.length > 1 ? 's' : ''} loaded · total weight:{' '}
              <strong style={{ color: 'var(--text)' }}>{totalWeight}</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {sources.map((src) => (
                <div
                  key={src.id}
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>📄 {src.fileName}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {src.studentCount} students · {src.columns?.length || 0} score column(s)
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: 11, flexShrink: 0 }}
                      onClick={() => removeSource(src.id)}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12, marginBottom: 0 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Label</label>
                      <input
                        className="form-input"
                        type="text"
                        value={src.label}
                        placeholder="e.g. Mid Sem, Quiz 1"
                        onChange={(e) => updateSource(src.id, 'label', e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Include first N students</label>
                      <input
                        className="form-input"
                        type="number"
                        min="1"
                        max={src.studentCount}
                        value={src.studentLimit !== undefined ? src.studentLimit : src.studentCount}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Math.max(1, Math.min(src.studentCount, parseInt(e.target.value) || 1));
                          updateSource(src.id, 'studentLimit', val);
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
                    File weight (auto):{' '}
                    <strong style={{ color: '#818cf8' }}>{getSourceFileWeight(src)}</strong>
                    {totalWeight > 0 && (
                      <span style={{ marginLeft: 8, color: '#a5b4fc' }}>
                        · {normalizedPreview[src.id] ?? 0}% of total
                      </span>
                    )}
                  </div>

                  {/* Save PDF section */}
                  <div style={{
                    marginTop: 12,
                    borderTop: '1px solid var(--border)',
                    paddingTop: 12,
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={src.saveToAccount || false}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          updateSourceNested(src.id, {
                            saveToAccount: checked,
                            saveName: src.saveName || src.label || src.fileName.replace(/\.pdf$/i, '')
                          });
                        }}
                      />
                      <span>💾 Save this PDF to my account</span>
                    </label>

                    {src.saveToAccount && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                        <input
                          className="form-input"
                          style={{ flex: 1, fontSize: 12, padding: '7px 12px', margin: 0 }}
                          type="text"
                          placeholder="Enter a custom name for this PDF..."
                          value={src.saveName || ''}
                          disabled={src.isSaved}
                          onChange={(e) => updateSource(src.id, 'saveName', e.target.value)}
                        />
                        {src.isSaved ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>✓</span> Saved
                            </span>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{
                                fontSize: 11,
                                padding: '5px 10px',
                                borderColor: 'rgba(239,68,68,0.3)',
                                color: '#ef4444',
                              }}
                              onClick={() => handleDeleteSavedPdf(src.id, src.dbId)}
                              disabled={pdfSavingStates[src.id]}
                            >
                              {pdfSavingStates[src.id] ? 'Deleting...' : '🗑 Delete from Account'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: 11, padding: '7px 14px' }}
                            onClick={() => handleSavePdf(src.id, src.saveName)}
                            disabled={pdfSavingStates[src.id] || !src.saveName?.trim()}
                          >
                            {pdfSavingStates[src.id] ? 'Saving...' : 'Save PDF'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {src.columns?.length > 0 && (
                    <>
                      <div style={{ marginTop: 14, marginBottom: 4, fontSize: 12, fontWeight: 600 }}>
                        Scores in this PDF
                      </div>
                      <MarksFilter
                        columns={src.columns}
                        selected={src.selectedColumns || []}
                        onChange={(selected) =>
                          updateSourceNested(src.id, { selectedColumns: selected })
                        }
                      />
                      <WeightInput
                        columns={src.columns}
                        selectedColumns={src.selectedColumns || []}
                        weights={src.columnWeights || {}}
                        onChange={(columnWeights) =>
                          updateSourceNested(src.id, { columnWeights })
                        }
                      />
                    </>
                  )}
                </div>
              ))}
            </div>

            {hasOcrSources && !showOcrReview && (
              <div
                style={{
                  marginTop: 8,
                  marginBottom: 12,
                  padding: 14,
                  borderRadius: 10,
                  border: '1px solid rgba(129,140,248,0.3)',
                  background: 'rgba(129,140,248,0.05)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                  🖊 Handwritten Grades Detected
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                  Some sources contain OCR-extracted handwritten grades. Review and correct them
                  before generating the SGPA leaderboard.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowOcrReview(true)}
                  disabled={sgpaLoading}
                >
                  {ocrCorrectedGrades ? '📝 Re-review OCR Grades' : '🔍 Review OCR Grades'}
                </button>
                {ocrCorrectedGrades && (
                  <span style={{ marginLeft: 10, fontSize: 11, color: '#10b981' }}>
                    ✓ {ocrCorrectedGrades.length} corrections saved
                  </span>
                )}
              </div>
            )}

            {showOcrReview && (
              <OcrReviewPanel
                sources={sources}
                onProceed={handleOcrReviewProceed}
              />
            )}

            {sources.length >= 1 && (
              <div
                style={{
                  marginTop: 8,
                  marginBottom: 12,
                  padding: 14,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'rgba(52,211,153,0.04)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                  🎯 Best-Of Groups
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                  Group multiple PDFs so each student&apos;s <strong>top N</strong> scores are used
                  (e.g. best 2 out of 3 midterms). Sources in a group skip weighted averaging.
                </p>

                {bestOfGroups.map((g) => (
                  <div
                    key={g.id}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Best</span>
                        <input
                          className="form-input"
                          type="number"
                          min="1"
                          max={Math.max(1, (g.items || []).length)}
                          value={g.bestOf}
                          onChange={(e) => updateBestOfGroup(g.id, { bestOf: Math.max(1, parseInt(e.target.value) || 1) })}
                          style={{ width: 60, textAlign: 'center' }}
                        />
                        <span style={{ fontSize: 13 }}>of {(g.items || []).length}</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: 11, flexShrink: 0 }}
                        onClick={() => removeBestOfGroup(g.id)}
                      >
                        ✕ Remove group
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(g.items || []).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <select
                            className="form-select"
                            value={item.sourceId}
                            onChange={(e) => {
                              const src = sources.find((s) => s.id === e.target.value);
                              const firstCol = src?.columns?.[0]?.name || '';
                              updateItemInGroup(g.id, idx, { sourceId: e.target.value, columnName: firstCol });
                            }}
                            style={{ flex: 1, fontSize: 12, color: 'var(--text)', background: 'var(--bg-2)' }}
                          >
                            {sources.map((src) => (
                              <option key={src.id} value={src.id}>
                                {src.label}
                              </option>
                            ))}
                          </select>
                          <select
                            className="form-select"
                            value={item.columnName}
                            onChange={(e) => updateItemInGroup(g.id, idx, { columnName: e.target.value })}
                            style={{ flex: 1, fontSize: 12, color: 'var(--text)', background: 'var(--bg-2)' }}
                          >
                            {(sources.find((s) => s.id === item.sourceId)?.columns || []).map((col) => (
                              <option key={col.name} value={col.name}>
                                {col.name} ({col.max})
                              </option>
                            ))}
                          </select>
                          <input
                            className="form-input"
                            type="number"
                            min="0"
                            placeholder="out of"
                            value={item.outOf || ''}
                            onChange={(e) => updateItemInGroup(g.id, idx, { outOf: e.target.value === '' ? '' : parseFloat(e.target.value) || '' })}
                            style={{ width: 70, fontSize: 12, textAlign: 'center' }}
                          />
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: 11, flexShrink: 0 }}
                            onClick={() => removeItemFromGroup(g.id, idx)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      className="btn btn-outline btn-sm"
                      style={{ marginTop: 8 }}
                      onClick={() => addItemToGroup(g.id)}
                    >
                      + Add score
                    </button>
                  </div>
                ))}

                <button className="btn btn-outline btn-sm" onClick={addBestOfGroup}>
                  + Add Group
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={loading || !sources.length}
              >
                {loading ? '⏳ Generating…' : '🏆 Generate Normal Leaderboard'}
              </button>
              {ocrCorrectedGrades && (
                <button
                  className="btn btn-secondary"
                  onClick={handleGenerateSgpa}
                  disabled={sgpaLoading || !sources.length}
                  style={{
                    background: 'rgba(16,185,129,0.15)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: '#10b981',
                  }}
                >
                  {sgpaLoading ? '⏳ Generating…' : '🎓 SGPA from OCR'}
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={handleGenerateSgpaDirect}
                disabled={sgpaLoading || !sources.length}
                style={{
                  background: 'rgba(59,130,246,0.15)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  color: '#3b82f6',
                }}
              >
                {sgpaLoading ? '⏳ Generating…' : '🎓 Generate SGPA Leaderboard'}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => document.getElementById('pdf-multi-input').click()}
                disabled={loading || sgpaLoading}
              >
                + Add more PDFs
              </button>
              <button className="btn btn-outline" onClick={handleReset} disabled={loading || sgpaLoading}>
                ✕ Clear all
              </button>
            </div>
          </>
        )}

        {!sources.length && (
          <button
            className="btn btn-primary"
            disabled={loading}
            onClick={() => document.getElementById('pdf-multi-input').click()}
          >
            {loading ? '⏳ Parsing PDFs…' : '🚀 Select PDFs'}
          </button>
        )}
      </div>

      {leaderboard && (
        <div className="card" style={{ marginTop: 16 }}>
          {leaderboard.sources?.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 14,
                fontSize: 12,
              }}
            >
              {leaderboard.sources.map((s) => {
                const isBestOf = s.isBestOf || s.bestOfGroup;
                const colsInfo = s.bestOfColumns?.length ? ` columns: ${s.bestOfColumns.join(', ')}` : '';
                return (
                  <span
                    key={s.id || s.label}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: isBestOf ? 'rgba(52,211,153,0.1)' : 'rgba(129,140,248,0.1)',
                      border: `1px solid ${isBestOf ? 'rgba(52,211,153,0.25)' : 'rgba(129,140,248,0.25)'}`,
                      color: isBestOf ? '#34d399' : '#a5b4fc',
                    }}
                  >
                    {s.label}{isBestOf
                      ? ` (best ${s.bestOfGroup.bestOf}/${s.bestOfGroup.total}${colsInfo})`
                      : `: w=${s.weight} (${Math.round(s.normalizedWeight * 100)}%)`
                    }
                  </span>
                );
              })}
            </div>
          )}
          <Leaderboard
            data={{
              ...leaderboard,
              leaderboard: leaderboard.leaderboard ? [{
                ...leaderboard.leaderboard[0],
                students: gradedStudents
              }] : []
            }}
            onDownloadExcel={handleDownloadExcel}
            scoreLabel="Final Score"
            relativeGradingEnabled={relativeGradingEnabled}
            setRelativeGradingEnabled={setRelativeGradingEnabled}
            gradeCounts={gradeCounts}
            setGradeCounts={setGradeCounts}
          />
        </div>
      )}

      {sgpaLeaderboard && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div className="card-title" style={{ margin: 0 }}>🎓 SGPA Leaderboard</div>
              <div className="text-muted" style={{ fontSize: 13 }}>
                {sgpaLeaderboard.totalStudents} students ranked by SGPA
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleSgpaDownloadExcel} disabled={sgpaLoading}>
              ⬇ Download Excel
            </button>
          </div>

          {/* Stats */}
          {sgpaLeaderboard.stats && (
            <div style={{
              display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16,
              padding: 12, borderRadius: 10,
              background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 12 }}>🏆 Highest: <strong>{sgpaLeaderboard.stats.highestSGPA}</strong></div>
              <div style={{ fontSize: 12 }}>📉 Lowest: <strong>{sgpaLeaderboard.stats.lowestSGPA}</strong></div>
              <div style={{ fontSize: 12 }}>📊 Average: <strong>{sgpaLeaderboard.stats.averageSGPA}</strong></div>
              <div style={{ fontSize: 12 }}>📈 Median: <strong>{sgpaLeaderboard.stats.medianSGPA}</strong></div>
            </div>
          )}

          {/* Sources */}
          {sgpaLeaderboard.sources?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, fontSize: 12 }}>
              {sgpaLeaderboard.sources.map((s) => (
                <span key={s.id || s.label} style={{
                  padding: '4px 10px', borderRadius: 6,
                  background: 'rgba(129,140,248,0.1)',
                  border: '1px solid rgba(129,140,248,0.25)',
                  color: '#a5b4fc',
                }}>
                  {s.label}: {s.validGradeCount} students, {s.credits}cr
                </span>
              ))}
            </div>
          )}

       {/* Search */}
          <div style={{ marginBottom: 14, position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 12, top: '50%',
              transform: 'translateY(-50%)', fontSize: 15,
              color: 'var(--muted)', pointerEvents: 'none',
            }}>🔍</span>
            <input
              className="form-input"
              placeholder="Search by name or roll number..."
              value={sgpaSearch}
              onChange={(e) => setSgpaSearch(e.target.value)}
              style={{ paddingLeft: 38, fontSize: 13 }}
            />
            {sgpaSearch && (
              <button
                onClick={() => setSgpaSearch('')}
                style={{
                  position: 'absolute', right: 12, top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13,
                }}
              >✕</button>
            )}
          </div>

          {/* Table */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>SID / Roll</th>
                  <th>SGPA</th>
                  <th>Subjects</th>
                  <th>Credits</th>
                </tr>
              </thead>
              <tbody>
               {sgpaLeaderboard.rankedStudents.filter((s) => {
                    const q = sgpaSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      s.name.toLowerCase().includes(q) ||
                      String(s.roll || '').toLowerCase().includes(q) ||
                      String(s.sid || '').toLowerCase().includes(q)
                    );
                  }).map((s, i) => {
                  const medal = s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `#${s.rank}`;
                  return (
                    <tr key={s.sid || s.roll || i} style={{
                      background: s.rank <= 3 ? 'rgba(250,204,21,0.04)' : 'transparent',
                    }}>
                      <td style={{ fontWeight: 700 }}>{medal}</td>
                      <td style={{ fontWeight: s.rank <= 3 ? 600 : 400 }}>{s.name}</td>
                      <td style={{ color: 'var(--muted)', fontSize: 13 }}>{s.roll || s.sid || '—'}</td>
                      <td>
                        <span style={{
                          fontWeight: 700,
                          color: s.sgpa >= 9 ? '#10b981' : s.sgpa >= 7 ? '#3b82f6' : s.sgpa >= 5 ? '#f59e0b' : '#ef4444',
                        }}>
                          {s.sgpa.toFixed(2)}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{s.subjectsCount}</td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{s.totalCredits}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* ── Save PDF Prompt Modal ── */}
      {showSavePromptModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: 'var(--card, #111b27)',
            border: '1px solid var(--card-border, rgba(255,255,255,0.08))',
            borderRadius: '12px',
            padding: 24,
            maxWidth: 550,
            width: '100%',
            maxHeight: '95vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>💾</span> Save PDFs to your account?
                </h3>
                <p className="text-muted" style={{ fontSize: 13, margin: '6px 0 0' }}>
                  You can save these uploaded PDFs to access them at any time from the Saved PDFs Library.
                </p>
              </div>
              <button
                className="btn btn-outline btn-sm"
                style={{ minWidth: 'auto', padding: '4px 8px', height: 28, border: 'none', fontSize: 16 }}
                onClick={handleCancelModal}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              {savePromptFiles.map((file, idx) => (
                <div key={file.id} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 8,
                  padding: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      id={`modal-pdf-chk-${file.id}`}
                      checked={file.checked}
                      style={{ cursor: 'pointer', width: 15, height: 15 }}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSavePromptFiles(prev => prev.map((f, i) => i === idx ? { ...f, checked } : f));
                      }}
                    />
                    <label
                      htmlFor={`modal-pdf-chk-${file.id}`}
                      style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      📄 {file.fileName}
                    </label>
                  </div>
                  {file.checked && (
                    <div style={{ marginLeft: 25 }}>
                      <input
                        className="form-input"
                        type="text"
                        style={{ fontSize: 12, padding: '6px 12px', margin: 0 }}
                        placeholder="Enter custom save name..."
                        value={file.saveName}
                        onChange={(e) => {
                          const saveName = e.target.value;
                          setSavePromptFiles(prev => prev.map((f, i) => i === idx ? { ...f, saveName } : f));
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCancelModal}
                style={{ fontSize: 13, padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-outline"
                style={{
                  fontSize: 13,
                  padding: '8px 16px',
                  borderColor: 'rgba(239,68,68,0.3)',
                  color: '#ef4444',
                }}
                onClick={handleSkipSaving}
              >
                Don't Save & Proceed
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  fontSize: 13,
                  padding: '8px 18px',
                  background: 'linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)',
                }}
                onClick={handleSaveAllSelectedPdfs}
                disabled={savePromptFiles.some(f => f.checked && !f.saveName.trim())}
              >
                Save Selected & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Saved PDFs Selector Modal ── */}
      {showSavedPdfsSelectorModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: 'var(--card, #111b27)',
            border: '1px solid var(--card-border, rgba(255,255,255,0.08))',
            borderRadius: '12px',
            padding: 24,
            maxWidth: 550,
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📂</span> Choose from Saved PDFs
                </h3>
                <p className="text-muted" style={{ fontSize: 13, margin: '6px 0 0' }}>
                  Select a marksheet or grade list PDF saved in your library to load it into the workspace.
                </p>
              </div>
              <button
                className="btn btn-outline btn-sm"
                style={{ minWidth: 'auto', padding: '4px 8px', height: 28, border: 'none', fontSize: 16 }}
                onClick={() => setShowSavedPdfsSelectorModal(false)}
              >
                ✕
              </button>
            </div>

            {savedPdfsSelectorLoading ? (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <div className="spinner" />
                <p style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>Loading your saved library...</p>
              </div>
            ) : availableSavedPdfs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--muted)' }}>
                <span style={{ fontSize: 32 }}>📁</span>
                <p style={{ marginTop: 10, fontSize: 13, fontWeight: 500 }}>No saved PDFs found in your library.</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>Save PDFs from your account after uploading them.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {availableSavedPdfs.map((pdf) => (
                  <div key={pdf._id} style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 8,
                    padding: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pdf.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        File: {pdf.fileName}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: 12, padding: '5px 12px', flexShrink: 0 }}
                      onClick={() => handleLoadSavedPdf(pdf._id)}
                    >
                      ➕ Load PDF
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowSavedPdfsSelectorModal(false)}
                style={{ fontSize: 13, padding: '8px 16px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
  </>
  );
}
