let ws = null;
let roomCode = null;
let students = [];
let levels = [];
let totalLevels = 10;
let selectedStudent = null;
let skylineRenderer = null;
let reconnectAttempts = 0;
let reconnectTimeout = null;

async function createRoom() {
  try {
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();
    
    if (data.success) {
      roomCode = data.roomCode;
      document.getElementById('login-container').style.display = 'none';
      document.getElementById('dashboard-container').style.display = 'block';
      document.getElementById('room-code-display').textContent = roomCode;
      
      initializeSkyline();
      connectWebSocket();
    } else {
      showError(data.error || 'Failed to create room');
    }
  } catch (error) {
    console.error('Error creating room:', error);
    showError('Failed to create room');
  }
}

function initializeSkyline() {
  const canvas = document.getElementById('skyline-canvas');
  skylineRenderer = new SkylineRenderer(canvas);
  
  canvas.addEventListener('click', (e) => {
    const student = skylineRenderer.getStudentAtPosition(e.clientX, e.clientY);
    if (student) {
      selectStudent(student.id);
    }
  });
}

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws?room=${roomCode}&role=teacher`;
  
  updateConnectionStatus('connecting');
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
    updateConnectionStatus('connected');
    reconnectAttempts = 0;
    
    // Request initial room state
    sendMessage({ type: 'request_room_state' });
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleMessage(message);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket closed');
    updateConnectionStatus('disconnected');
    attemptReconnect();
  };
}

function attemptReconnect() {
  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
  
  console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
  
  reconnectTimeout = setTimeout(() => {
    connectWebSocket();
  }, delay);
}

function sendMessage(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function handleMessage(message) {
  switch (message.type) {
    case 'room_state':
      handleRoomState(message.data);
      break;
    case 'student_joined':
      handleStudentJoined(message.data);
      break;
    case 'level_completed':
      handleLevelCompleted(message.data);
      break;
    case 'student_disconnected':
      handleStudentDisconnected(message.data);
      break;
    case 'error':
      showError(message.data.message);
      break;
    case 'pong':
      // Heartbeat response
      break;
    default:
      console.warn('Unknown message type:', message.type);
  }
}

function handleRoomState(data) {
  students = data.students || [];
  levels = data.levels || [];
  totalLevels = data.totalLevels || 10;
  
  updateStudentList();
  skylineRenderer.setStudents(students, totalLevels);
}

function handleStudentJoined(data) {
  const existingIndex = students.findIndex(s => s.id === data.student.id);
  if (existingIndex >= 0) {
    students[existingIndex] = data.student;
  } else {
    students.push(data.student);
  }
  
  updateStudentList();
  skylineRenderer.setStudents(students, totalLevels);
}

function handleLevelCompleted(data) {
  const studentIndex = students.findIndex(s => s.id === data.studentId);
  if (studentIndex >= 0) {
    students[studentIndex] = data.student;
  }
  
  updateStudentList();
  skylineRenderer.setStudents(students, totalLevels);
  
  if (selectedStudent && selectedStudent.id === data.studentId) {
    selectedStudent = data.student;
    updateSelectedStudent();
  }
}

function handleStudentDisconnected(data) {
  // Keep student in list but could add visual indicator
  console.log('Student disconnected:', data.studentId);
}

function updateStudentList() {
  const studentList = document.getElementById('student-list');
  const studentCount = document.getElementById('student-count');
  
  studentCount.textContent = students.length;
  
  if (students.length === 0) {
    studentList.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No students yet</p>';
    return;
  }
  
  studentList.innerHTML = students.map(student => `
    <div class="student-item ${selectedStudent && selectedStudent.id === student.id ? 'selected' : ''}" 
         onclick="selectStudent(${student.id})">
      <div class="student-color" style="background: ${student.color};"></div>
      <div class="student-info">
        <div class="student-name">${escapeHtml(student.name)}</div>
        <div class="student-level">Level ${student.current_level - 1}/${totalLevels}</div>
      </div>
    </div>
  `).join('');
}

function selectStudent(studentId) {
  selectedStudent = students.find(s => s.id === studentId);
  
  if (selectedStudent) {
    updateStudentList();
    skylineRenderer.setSelectedStudent(studentId);
    updateSelectedStudent();
  }
}

function updateSelectedStudent() {
  document.getElementById('no-selection').style.display = 'none';
  document.getElementById('student-controls').style.display = 'block';
  
  document.getElementById('selected-student-name').textContent = selectedStudent.name;
  document.getElementById('selected-student-level').textContent = 
    `${selectedStudent.current_level - 1}/${totalLevels}`;
  
  const completeBtn = document.getElementById('complete-level-btn');
  const currentLevel = selectedStudent.current_level;
  
  if (currentLevel > totalLevels) {
    completeBtn.textContent = 'All Levels Complete!';
    completeBtn.disabled = true;
  } else {
    completeBtn.textContent = `Complete Level ${currentLevel}`;
    completeBtn.disabled = false;
  }
  
  // Update inventory
  if (selectedStudent.inventory && selectedStudent.inventory.length > 0) {
    document.getElementById('selected-student-inventory').style.display = 'block';
    document.getElementById('selected-inventory-items').innerHTML = 
      selectedStudent.inventory.map(item => 
        `<div class="inventory-item">${escapeHtml(item)}</div>`
      ).join('');
  } else {
    document.getElementById('selected-student-inventory').style.display = 'none';
  }
}

function completeLevel() {
  if (!selectedStudent) return;
  
  const levelId = selectedStudent.current_level;
  
  if (levelId > totalLevels) return;
  
  sendMessage({
    type: 'complete_level',
    data: {
      studentId: selectedStudent.id,
      levelId: levelId
    }
  });
}

function updateConnectionStatus(status) {
  const indicator = document.getElementById('connection-indicator');
  indicator.className = `connection-status ${status}`;
}

function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Heartbeat
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendMessage({ type: 'ping' });
  }
}, 30000);
