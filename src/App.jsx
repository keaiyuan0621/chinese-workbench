import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import RequireRole from './components/shared/RequireRole.jsx'
import StudentLayout from './components/student/StudentLayout.jsx'
import AdminOnly from './components/teacher/AdminOnly.jsx'
import TeacherLayout from './components/teacher/TeacherLayout.jsx'
import Login from './pages/Login.jsx'
import Materials from './pages/student/Materials.jsx'
import PracticeSession from './pages/student/PracticeSession.jsx'
import StudentHome from './pages/student/StudentHome.jsx'
import StudentPractice from './pages/student/StudentPractice.jsx'
import StudentRegister from './pages/student/StudentRegister.jsx'
import WrongBook from './pages/student/WrongBook.jsx'
import TeacherClasses from './pages/teacher/TeacherClasses.jsx'
import TeacherHome from './pages/teacher/TeacherHome.jsx'
import TeacherMaterials from './pages/teacher/TeacherMaterials.jsx'
import TeacherPapers from './pages/teacher/TeacherPapers.jsx'
import TeacherQuestions from './pages/teacher/TeacherQuestions.jsx'
import TeacherReview from './pages/teacher/TeacherReview.jsx'
import TeacherStaff from './pages/teacher/TeacherStaff.jsx'
function JuxingFile() {
  useEffect(() => {
    window.location.replace('/juxing.html')
  }, [])
  return null
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      {/* 学生端 */}
      <Route path="/student/login" element={<Login />} />
      <Route path="/student/register" element={<StudentRegister />} />
      <Route
        path="/student"
        element={
          <RequireRole role="student" loginPath="/student/login">
            <StudentLayout />
          </RequireRole>
        }
      >
        <Route index element={<StudentHome />} />
        <Route path="practice" element={<StudentPractice />} />
        <Route path="practice/session/:id" element={<PracticeSession />} />
        <Route path="wrong-book" element={<WrongBook />} />
        <Route path="materials" element={<Materials />} />
      </Route>

      {/* 教师端 */}
      <Route path="/teacher/login" element={<Login />} />
      <Route
        path="/teacher"
        element={
          <RequireRole role={['teacher', 'super_admin']} loginPath="/teacher/login">
            <TeacherLayout />
          </RequireRole>
        }
      >
        <Route index element={<TeacherHome />} />
        <Route path="classes" element={<AdminOnly><TeacherClasses /></AdminOnly>} />
        <Route path="materials" element={<AdminOnly><TeacherMaterials /></AdminOnly>} />
        <Route path="questions" element={<TeacherQuestions />} />
        <Route path="papers" element={<TeacherPapers />} />
        <Route path="review" element={<AdminOnly><TeacherReview /></AdminOnly>} />
        <Route path="staff" element={<AdminOnly><TeacherStaff /></AdminOnly>} />
      </Route>

      <Route path="/juxing" element={<JuxingFile />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
// 强制更新
