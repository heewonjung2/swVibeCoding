import { useEffect, useMemo, useState } from 'react'
import './App.css'

// 💡 1-Depth에 따른 2-Depth 세부 증상 매핑 (요구사항 1, 2 반영)
const SYMPTOMS_MAP = {
  '두통': ['편두통', '긴장성 두통', '어지럼증', '직접입력'],
  '소화불량': ['체함', '복통', '메스꺼움/구토', '직접입력'],
  '감기': ['목감기', '코감기', '몸살/발열', '직접입력'],
  '외상/상처': ['찰과상(까짐)', '타박상(멍)', '화상', '직접입력'],
  '생리통': ['복통', '요통', '직접입력'],
  '기타': ['직접입력']
}
const SYMPTOMS = Object.keys(SYMPTOMS_MAP)
const OTHER_SYMPTOM = '기타'
const STORAGE_KEY = 'hongik-health-registrations'
const RETENTION_DAYS = 30

function getTodayDate() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatTime(date) {
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function parseDateString(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function isWithinRetention(dateStr) {
  const recordDate = parseDateString(dateStr)
  const cutoff = new Date()

  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)
  recordDate.setHours(0, 0, 0, 0)

  return recordDate >= cutoff
}

function cleanupOldRegistrations(data) {
  if (!Array.isArray(data)) return []
  return data.filter((record) => record?.date && isWithinRetention(record.date))
}

function loadRegistrationsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return cleanupOldRegistrations(parsed)
  } catch {
    return []
  }
}

const maskName = (name) => {
  if (!name) return ''
  if (name.length === 1) return name
  if (name.length === 2) return name[0] + '*'
  if (name.length === 3) return name[0] + '*' + name[2]

  if (name.length > 3) {
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
  }
  return name
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'

  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function App() {
  const [activeTab, setActiveTab] = useState('visitor')
  const [menuOpen, setMenuOpen] = useState(false)

  const [studentId, setStudentId] = useState('')
  const [name, setName] = useState('')
  const [temperature, setTemperature] = useState('') // 💡 체온 상태 추가
  const [symptom, setSymptom] = useState('')
  const [subSymptom, setSubSymptom] = useState('') // 💡 2-Depth 상태 추가
  const [otherSymptom, setOtherSymptom] = useState('')

  const [registrations, setRegistrations] = useState(loadRegistrationsFromStorage)
  const [selectedDate, setSelectedDate] = useState(() => getTodayDate())
  const [toast, setToast] = useState('')

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(''), 2000)
  }

  useEffect(() => {
    const cleaned = cleanupOldRegistrations(registrations)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
    } catch {
      console.error('localStorage 저장 실패')
      return
    }
    if (cleaned.length !== registrations.length) {
      setRegistrations(cleaned)
    }
  }, [registrations])

  const filteredRegistrations = useMemo(() => {
    return registrations
      .filter((r) => r.date === selectedDate)
      .sort((a, b) => b.time.localeCompare(a.time))
  }, [registrations, selectedDate])

  const waitingList = useMemo(() => {
    const today = getTodayDate()
    return registrations
      .filter((r) => r.status === '대기중' && r.date === today)
      .sort((a, b) => a.time.localeCompare(b.time))
  }, [registrations])

  // 1-Depth 증상 선택 핸들러
  const handleSymptomSelect = (item) => {
    setSymptom(item)
    setSubSymptom('') // 상위 증상이 바뀌면 하위 증상 초기화
    setOtherSymptom('')
  }

  // 2-Depth 세부 증상 선택 핸들러
  const handleSubSymptomSelect = (subItem) => {
    setSubSymptom(subItem)
    if (subItem !== '직접입력') {
      setOtherSymptom('')
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    const trimmedId = studentId.trim()
    const trimmedName = name.trim()
    const trimmedOther = otherSymptom.trim()
    const tempValue = parseFloat(temperature)

    // 1. 기본 필수값 검증
    if (!trimmedId || !trimmedName || !temperature || !symptom) {
      showToast('학번/종번, 이름, 체온, 방문 목적을 모두 입력해 주세요.')
      return
    }

    // 2. 체온 유효성 검사 (34.0 ~ 42.0)
    if (isNaN(tempValue) || tempValue < 34.0 || tempValue > 42.0) {
      showToast('체온은 34.0도에서 42.0도 사이로 정확히 입력해 주세요.')
      return
    }

    // 3. 증상 문자열 조합 로직 (요구사항 2 반영)
    let displaySymptom = symptom

    if (symptom === OTHER_SYMPTOM) {
      if (!trimmedOther) {
        showToast('기타 증상을 직접 입력해 주세요.')
        return
      }
      displaySymptom = `기타 - ${trimmedOther}`
    } else {
      if (!subSymptom) {
        showToast('세부 증상을 선택해 주세요.')
        return
      }
      if (subSymptom === '직접입력') {
        if (!trimmedOther) {
          showToast('세부 증상을 직접 입력해 주세요.')
          return
        }
        displaySymptom = `${symptom} - ${trimmedOther}(직접입력)`
      } else {
        displaySymptom = `${symptom} - ${subSymptom}`
      }
    }

    const now = new Date()

    setRegistrations((prev) => [
      {
        id: crypto.randomUUID(),
        date: getTodayDate(),
        time: formatTime(now),
        studentId: trimmedId,
        name: trimmedName,
        temperature: tempValue.toFixed(1), // 체온 데이터 저장
        symptom: displaySymptom,
        status: '대기중',
        medication: '',
        treatment: '',
      },
      ...prev,
    ])

    // 폼 초기화
    setStudentId('')
    setName('')
    setTemperature('')
    setSymptom('')
    setSubSymptom('')
    setOtherSymptom('')

    showToast('접수가 완료되었습니다.')
  }

  const updateRegistration = (id, updates) => {
    setRegistrations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    )
  }

  const handleCompleteTreatment = (record) => {
    updateRegistration(record.id, {
      medication: record.medication.trim(),
      treatment: record.treatment.trim(),
      status: '진료완료',
    })
    showToast('진료 기록이 저장되었습니다.')
  }

  const handleCopyId = async (id) => {
    try {
      await copyText(id)
      showToast('학번이 복사되었습니다.')
    } catch {
      showToast('복사에 실패했습니다.')
    }
  }

  const handleCopyAll = async (record) => {
    try {
      await copyText(`${record.studentId} ${record.name} ${record.temperature}도 ${record.symptom}`)
      showToast('전체 정보가 복사되었습니다.')
    } catch {
      showToast('복사에 실패했습니다.')
    }
  }

  // CSV 다운로드 (체온 컬럼 추가)
  const downloadCSV = () => {
    const today = new Date().toISOString().split('T')[0]
    let csvContent = '접수시간,학번/종번,이름,체온,방문목적,투약약품,처치/진료내용,상태\n'

    filteredRegistrations.forEach((row) => {
      const rowData = [
        row.time || '',
        row.studentId || '',
        row.name || '',
        row.temperature ? `${row.temperature}도` : '',
        row.symptom || '',
        row.medication || '',
        row.treatment || '',
        row.status || '',
      ]
        .map((item) => `"${item}"`)
        .join(',')

      csvContent += rowData + '\n'
    })

    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `건강진료센터_진료기록_${today}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const openAdminPage = () => {
    setActiveTab('admin')
    setMenuOpen(false)
  }

  const goToVisitorPage = () => {
    setActiveTab('visitor')
    setMenuOpen(false)
  }

  return (
    <div className="app">
      <header className="app-header">
        <button
          type="button"
          className="menu-btn"
          aria-label="메뉴 열기"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          ☰
        </button>
        <p className="app-badge">홍익대학교 건강진료센터</p>
        <h1>방문자 셀프 접수</h1>
      </header>

      {menuOpen && (
        <>
          <button
            type="button"
            className="drawer-overlay"
            aria-label="메뉴 닫기"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="drawer" aria-label="내비게이션 메뉴">
            <button
              type="button"
              className="drawer-close"
              aria-label="메뉴 닫기"
              onClick={() => setMenuOpen(false)}
            >
              ×
            </button>
            <nav className="drawer-nav">
              {activeTab === 'visitor' ? (
                <button type="button" className="drawer-link" onClick={openAdminPage}>
                  관리자 페이지 이동
                </button>
              ) : (
                <button type="button" className="drawer-link" onClick={goToVisitorPage}>
                  방문자 접수로 돌아가기
                </button>
              )}
            </nav>
          </aside>
        </>
      )}

      {activeTab === 'visitor' ? (
        <section className="card form-section card--highlight">
          <h2 className="section-title">방문자 접수</h2>

          <form onSubmit={handleSubmit} className="register-form">
            <div className="field">
              <label htmlFor="studentId">학번/종번</label>
              <input
                id="studentId"
                type="text"
                placeholder="예: C123456"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="field">
              <label htmlFor="name">이름</label>
              <input
                id="name"
                type="text"
                placeholder="예: 홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>

            {/* 💡 체온 입력 필드 추가 */}
            <div className="field">
              <label htmlFor="temperature">체온 (도)</label>
              <input
                id="temperature"
                type="number"
                step="0.1"
                placeholder="예: 36.5"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                autoComplete="off"
              />
            </div>

            <fieldset className="symptom-fieldset">
              <legend>방문 목적 (증상)</legend>

              {/* 1-Depth 증상 선택 */}
              <div className="symptom-grid">
                {SYMPTOMS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`symptom-btn ${symptom === item ? 'selected' : ''}`}
                    onClick={() => handleSymptomSelect(item)}
                    aria-pressed={symptom === item}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {/* 2-Depth 세부 증상 조건부 렌더링 */}
              {symptom && symptom !== OTHER_SYMPTOM && (
                <div className="sub-symptom-section" style={{ marginTop: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 'bold', color: '#555' }}>
                    세부 증상 선택
                  </p>
                  <div className="symptom-grid">
                    {SYMPTOMS_MAP[symptom].map((subItem) => (
                      <button
                        key={subItem}
                        type="button"
                        className={`symptom-btn ${subSymptom === subItem ? 'selected' : ''}`}
                        onClick={() => handleSubSymptomSelect(subItem)}
                        aria-pressed={subSymptom === subItem}
                        style={{ padding: '8px', fontSize: '0.9rem' }}
                      >
                        {subItem}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 직접 입력 텍스트 필드 조건부 렌더링 */}
              <div
                className={`other-symptom-wrap ${
                  symptom === OTHER_SYMPTOM || subSymptom === '직접입력' ? 'visible' : ''
                }`}
                style={{ marginTop: '12px' }}
              >
                <label htmlFor="otherSymptom" className="sr-only">기타 증상 직접 입력</label>
                <input
                  id="otherSymptom"
                  type="text"
                  className="other-symptom-input"
                  placeholder="증상을 직접 입력해주세요"
                  value={otherSymptom}
                  onChange={(e) => setOtherSymptom(e.target.value)}
                />
              </div>
            </fieldset>

            <button type="submit" className="submit-btn">
              접수하기
            </button>
          </form>

          <div className="waiting-board" aria-live="polite" aria-atomic="true">
            <p className="waiting-count">
              현재 대기 인원: <strong>{waitingList.length}</strong>명
            </p>

            {waitingList.length > 0 ? (
              <ul className="waiting-list">
                {waitingList.map((record, index) => (
                  <li key={record.id} className="waiting-list-item">
                    <span className="waiting-order">{index + 1}</span>
                    <span className="waiting-name">
                      {maskName(record.name)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="waiting-empty">현재 대기 중인 방문자가 없습니다.</p>
            )}
          </div>
        </section>
      ) : (
        <section className="card admin-section">
          <button type="button" className="back-btn" onClick={goToVisitorPage}>
            ← 방문자 접수로 돌아가기
          </button>

          <div className="section-header">
            <h2 className="section-title">접수 현황</h2>
            <span className="count-badge">{filteredRegistrations.length}건</span>
          </div>

          <button
            onClick={downloadCSV}
            style={{
              backgroundColor: '#1833DB',
              color: 'white',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '16px',
              fontWeight: 'bold',
            }}
          >
            오늘의 진료기록 다운로드 (CSV)
          </button>

          <div className="date-filter">
            <label htmlFor="admin-date-picker" className="date-filter-label">
              접수 일자 선택
            </label>
            <div className="date-picker-row">
              <input
                id="admin-date-picker"
                type="date"
                className="date-picker"
                value={selectedDate}
                max={getTodayDate()}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              {selectedDate === getTodayDate() && (
                <span className="date-picker-badge">오늘</span>
              )}
            </div>
          </div>

          {filteredRegistrations.length === 0 ? (
            <p className="empty-message">{selectedDate} 접수 내역이 없습니다.</p>
          ) : (
            <div className="admin-list">
              {filteredRegistrations.map((record) => (
                <article
                  key={record.id}
                  className={`admin-card ${record.status === '진료완료' ? 'admin-card--done' : ''}`}
                >
                  <div className="admin-card-top">
                    <span
                      className={`status-badge ${
                        record.status === '진료완료' ? 'status-badge--done' : ''
                      }`}
                    >
                      {record.status}
                    </span>
                    <span className="admin-card-time">{record.time}</span>
                  </div>

                  <dl className="admin-card-info">
                    <div>
                      <dt>학번/종번</dt>
                      <dd>{record.studentId}</dd>
                    </div>
                    <div>
                      <dt>이름</dt>
                      <dd>{record.name}</dd>
                    </div>
                    {/* 💡 체온 정보 관리자 뷰에 추가 */}
                    <div>
                      <dt>체온</dt>
                      <dd>{record.temperature}도</dd>
                    </div>
                    <div>
                      <dt>증상</dt>
                      <dd>
                        <span className="symptom-tag">{record.symptom}</span>
                      </dd>
                    </div>
                  </dl>

                  <div className="admin-card-fields">
                    <div className="admin-field">
                      <label htmlFor={`med-${record.id}`}>투약 약품</label>
                      <input
                        id={`med-${record.id}`}
                        type="text"
                        placeholder="예: 타이레놀"
                        value={record.medication}
                        disabled={record.status === '진료완료'}
                        onChange={(e) =>
                          updateRegistration(record.id, { medication: e.target.value })
                        }
                      />
                    </div>
                    <div className="admin-field">
                      <label htmlFor={`treat-${record.id}`}>처치/진료 내용</label>
                      <textarea
                        id={`treat-${record.id}`}
                        placeholder="처치 및 진료 내용을 입력하세요"
                        rows={2}
                        value={record.treatment}
                        disabled={record.status === '진료완료'}
                        onChange={(e) =>
                          updateRegistration(record.id, { treatment: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="admin-card-actions">
                    {record.status === '대기중' && (
                      <button
                        type="button"
                        className="save-treatment-btn"
                        onClick={() => handleCompleteTreatment(record)}
                      >
                        진료 완료 저장
                      </button>
                    )}
                    <div className="action-buttons">
                      <button
                        type="button"
                        className="action-btn action-btn--id"
                        onClick={() => handleCopyId(record.studentId)}
                      >
                        학번 복사
                      </button>
                      <button
                        type="button"
                        className="action-btn action-btn--all"
                        onClick={() => handleCopyAll(record)}
                      >
                        전체 복사
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

export default App
