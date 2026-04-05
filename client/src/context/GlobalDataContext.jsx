import { createContext, useContext, useState, useCallback } from 'react';
import { subjectService, attendanceService, marksService, taskService } from '../services/apiServices';

const GlobalDataContext = createContext();

export function GlobalDataProvider({ children }) {
  const [subjects,   setSubjects]   = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [marks,      setMarks]      = useState([]);
  const [tasks,      setTasks]      = useState([]);

  const refreshSubjects   = useCallback(async () => {
    const { data } = await subjectService.getAll();
    setSubjects(data.subjects || []);
  }, []);

  const refreshAttendance = useCallback(async () => {
    const { data } = await attendanceService.getSummary();
    setAttendance(data.summary || []);
  }, []);

  const refreshMarks = useCallback(async () => {
    const { data } = await marksService.getAll();
    setMarks(data.marks || []);
  }, []);

  const refreshTasks = useCallback(async () => {
    const { data } = await taskService.getAll();
    setTasks(data.tasks || []);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshSubjects(), refreshAttendance(), refreshMarks(), refreshTasks()]);
  }, [refreshSubjects, refreshAttendance, refreshMarks, refreshTasks]);

  // Called after any AI command succeeds — refreshes only what changed
  const refreshByEntity = useCallback((entity) => {
    const map = {
      subject:    refreshSubjects,
      attendance: refreshAttendance,
      marks:      refreshMarks,
      task:       refreshTasks,
      semester:   refreshMarks,
    };
    map[entity]?.();
  }, [refreshSubjects, refreshAttendance, refreshMarks, refreshTasks]);

  return (
    <GlobalDataContext.Provider value={{
      subjects, attendance, marks, tasks,
      refreshSubjects, refreshAttendance, refreshMarks, refreshTasks,
      refreshAll, refreshByEntity,
    }}>
      {children}
    </GlobalDataContext.Provider>
  );
}

export const useGlobalData = () => useContext(GlobalDataContext);