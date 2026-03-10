let ws = null;
let roomCode = null;
let studentId = null;
let studentData = null;
let levels = [];
let totalLevels = 10;
let reconnectAttempts = 0;
let reconnectTimeout = null;

async function joinRoom() {
  const roomCodeInput = document.getElementById('room-code').value.trim().toUpperCase();
  const studentName = document.getElementById('student-name').value.trim();
  
  if (!roomCodeInput) {
    showError('Please enter a room code');
    return;
  }
  
  if (!studentName) {
    showError('Please enter your name');
    return;
  }
  
  try {
    const response = await fetch(`/api/rooms/${roomCodeInput}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: studentName })
    });
    
    const data = await response.json();
    
    if (data.success) {
      roomCode = roomCodeInput;
      studentId = data.studentId;
      studentData = data.student;
      
      document.getElementById('login-container').style.display = 'none';
      document.getElementById('student-container').style.display = 'block';
      document.getElementById('room-code-display').textContent = roomCode;
      document.getElementById('student-name-display').textContent = studentName;
      
      // Load levels configuration
      await loadLevels();
      
      // Connect WebSocket
      connectWebSocket();
      
      // Update UI with initial data
      updateStudentView();
    } else {
      showError(data.error || 'Failed to join room');
    }
  } catch (error) {
    console.error('Error joining room:', error);
    showError('Failed to join room');
  }
}

async function loadLevels() {
  try {
    const response = await fetch(`/api/rooms/${roomCode}/config`);
    const data = await response.json();
    
    if (data.success) {
      levels = data.levels;
      totalLevels = data.totalLevels;
      document.getElementById('total-levels').textContent = totalLevels;
    }
  } catch (error) {
    console.error('Error loading levels:', error);
  }
}

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws?room=${roomCode}&role=student&studentId=${studentId}`;
  
  updateConnectionStatus('connecting');
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    updateConnectionStatus('connected');
    reconnectAttempts = 0;
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
    case 'level_completed':
      handleLevelCompleted(message.data);
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
  if (data.students) {
    const myStudent = data.students.find(s => s.id === studentId);
    if (myStudent) {
      studentData = myStudent;
      updateStudentView();
    }
  }
}

function handleLevelCompleted(data) {
  if (data.studentId === studentId) {
    studentData = data.student;
    updateStudentView();
    animateLevelComplete(data.rewards);
  }
}

function updateStudentView() {
  if (!studentData) return;
  
  const currentLevel = studentData.current_level - 1;
  document.getElementById('current-level').textContent = currentLevel;
  
  // Building visualization removed from student view
  
  // Update level info
  const level = levels.find(l => l.id === studentData.current_level);
  
  if (level) {
    document.getElementById('level-title').textContent = `Level ${level.id}: ${level.title}`;
    document.getElementById('level-description').textContent = level.description;
    document.getElementById('assignment-text').textContent = level.assignmentText;
  } else if (currentLevel >= totalLevels) {
    document.getElementById('level-title').textContent = '🎉 Congratulations!';
    document.getElementById('level-description').textContent = 'You have completed all levels!';
    document.getElementById('assignment-text').textContent = 
      'Amazing work! You\'ve built the tallest building in our city. Your dedication and effort have paid off!';
  }
  
  // Update inventory
  if (studentData.inventory && studentData.inventory.length > 0) {
    document.getElementById('inventory-container').style.display = 'block';
    document.getElementById('inventory-items').innerHTML = 
      studentData.inventory.map(item => 
        `<div class="inventory-item">${escapeHtml(item)}</div>`
      ).join('');
  } else {
    document.getElementById('inventory-container').style.display = 'none';
  }
}

function animateLevelComplete(rewards) {
  // Simple celebration animation
  const levelInfo = document.getElementById('level-info');
  levelInfo.style.transition = 'transform 0.5s ease';
  levelInfo.style.transform = 'scale(1.05)';
  
  setTimeout(() => {
    levelInfo.style.transform = 'scale(1)';
  }, 500);
  
  // Show rewards notification
  if (rewards && rewards.length > 0) {
    const rewardText = rewards.join(', ');
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 8px 16px rgba(0,0,0,0.2);
      z-index: 1000;
      text-align: center;
      min-width: 300px;
    `;
    notification.innerHTML = `
      <h2 style="color: #667eea; margin-bottom: 15px;">🎉 Level Complete!</h2>
      <p style="font-size: 1.1em; margin-bottom: 10px;">You earned:</p>
      <p style="font-weight: bold; color: #52b788;">${escapeHtml(rewardText)}</p>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
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

// Handle Enter key in input fields
document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('#room-code, #student-name');
  inputs.forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        joinRoom();
      }
    });
  });
});

// Heartbeat
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendMessage({ type: 'ping' });
  }
}, 30000);
