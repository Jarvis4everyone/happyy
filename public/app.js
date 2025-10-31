// Authentication
const LOGIN_USERNAME = 'admin';
const LOGIN_PASSWORD = 'harry';

let currentCallSid = null;
let logsWebSocket = null;
let isLoggedIn = false;

// Check if user is already logged in
window.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        showDashboard();
    } else {
        showLogin();
    }
});

// Login functionality
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');

    if (username === LOGIN_USERNAME && password === LOGIN_PASSWORD) {
        sessionStorage.setItem('isLoggedIn', 'true');
        isLoggedIn = true;
        showDashboard();
        errorDiv.textContent = '';
    } else {
        errorDiv.textContent = 'Invalid username or password';
    }
});

// Logout functionality
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    sessionStorage.removeItem('isLoggedIn');
    isLoggedIn = false;
    if (currentCallSid) {
        stopCall();
    }
    if (logsWebSocket) {
        logsWebSocket.close();
    }
    showLogin();
});

function showLogin() {
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('dashboardPage').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.remove('hidden');
    connectLogsWebSocket();
}

// Phone number input - only allow numbers
document.getElementById('phoneNumber')?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
});

// Make call
document.getElementById('callBtn')?.addEventListener('click', async () => {
    const phoneNumber = document.getElementById('phoneNumber').value;
    const callStatus = document.getElementById('callStatus');
    const callBtn = document.getElementById('callBtn');
    const stopCallBtn = document.getElementById('stopCallBtn');

    if (!phoneNumber || phoneNumber.length !== 10) {
        callStatus.textContent = 'Please enter a valid 10-digit phone number';
        callStatus.className = 'call-status error';
        return;
    }

    try {
        callBtn.disabled = true;
        callStatus.textContent = 'Initiating call...';
        callStatus.className = 'call-status';

        const fullNumber = `+91${phoneNumber}`;
        const response = await fetch('/api/call', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phoneNumber: fullNumber }),
        });

        const data = await response.json();

        if (response.ok) {
            currentCallSid = data.callSid;
            callStatus.textContent = `Calling ${fullNumber}...`;
            callStatus.className = 'call-status active';
            callBtn.disabled = true;
            stopCallBtn.disabled = false;
            document.getElementById('newCallBtn').classList.add('hidden');
            updateCallInfo(fullNumber);
            addLog(`Call initiated to ${fullNumber}`, 'success');
            addLog(`Call SID: ${data.callSid}`, 'info');
        } else {
            callStatus.textContent = `Error: ${data.error || 'Failed to initiate call'}`;
            callStatus.className = 'call-status error';
            callBtn.disabled = false;
            addLog(`Call failed: ${data.error}`, 'error');
        }
    } catch (error) {
        callStatus.textContent = `Error: ${error.message}`;
        callStatus.className = 'call-status error';
        callBtn.disabled = false;
        addLog(`Call error: ${error.message}`, 'error');
    }
});

// Stop call
document.getElementById('stopCallBtn')?.addEventListener('click', stopCall);

async function stopCall() {
    if (!currentCallSid) return;

    try {
        const response = await fetch(`/api/call/${currentCallSid}`, {
            method: 'DELETE',
        });

        const data = await response.json();

        if (response.ok) {
            addLog('Call stopped successfully', 'warning');
            resetCallUI();
        } else {
            addLog(`Error stopping call: ${data.error}`, 'error');
        }
    } catch (error) {
        addLog(`Error stopping call: ${error.message}`, 'error');
    }

    currentCallSid = null;
}

// New call
document.getElementById('newCallBtn')?.addEventListener('click', () => {
    resetCallUI();
    document.getElementById('phoneNumber').value = '';
    addLog('Ready for new call', 'info');
});

function resetCallUI() {
    document.getElementById('callBtn').disabled = false;
    document.getElementById('stopCallBtn').disabled = true;
    document.getElementById('newCallBtn').classList.remove('hidden');
    document.getElementById('callStatus').textContent = 'Call ended. Ready for new call.';
    document.getElementById('callStatus').className = 'call-status';
    currentCallSid = null;
    resetCallInfo();
}


// Logs WebSocket connection
function connectLogsWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/logs`;
    
    logsWebSocket = new WebSocket(wsUrl);

    logsWebSocket.onopen = () => {
        addLog('Connected to live logs', 'success');
    };

    logsWebSocket.onmessage = (event) => {
        try {
            const logData = JSON.parse(event.data);
            addLog(logData.message, logData.type || 'info', logData.time);
            
            // Check if call ended
            if (logData.message.includes('Media stream') && logData.message.includes('ended')) {
                if (currentCallSid === logData.callSid) {
                    resetCallUI();
                }
            }
        } catch (error) {
            addLog(event.data, 'info');
        }
    };

    logsWebSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    logsWebSocket.onclose = () => {
        addLog('Disconnected from live logs. Reconnecting...', 'warning');
        setTimeout(connectLogsWebSocket, 3000);
    };
}

// Add log entry
let logCount = 0;
function addLog(message, type = 'info', time = null) {
    const logsContainer = document.getElementById('logsContainer');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    
    logCount++;
    const timestamp = time || new Date().toLocaleTimeString();
    logEntry.innerHTML = `<span class="log-time">[${timestamp}]</span>${escapeHtml(message)}`;
    
    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
    
    // Update log count badge
    document.getElementById('logsCount').textContent = `${logCount} logs`;
}

// Clear logs
document.getElementById('clearLogsBtn')?.addEventListener('click', () => {
    document.getElementById('logsContainer').innerHTML = '';
    logCount = 0;
    document.getElementById('logsCount').textContent = '0 logs';
    addLog('Logs cleared', 'info');
});

// Update call info
function updateCallInfo(phoneNumber) {
    const callInfo = document.getElementById('callInfo');
    const callInfoNumber = document.getElementById('callInfoNumber');
    const callInfoStatus = document.getElementById('callInfoStatus');
    
    callInfo.classList.remove('hidden');
    callInfoNumber.textContent = phoneNumber || '-';
    callInfoStatus.textContent = 'Active';
    callInfoStatus.style.color = 'var(--success-color)';
    
    // Start duration timer
    let duration = 0;
    const durationInterval = setInterval(() => {
        duration++;
        const minutes = Math.floor(duration / 60).toString().padStart(2, '0');
        const seconds = (duration % 60).toString().padStart(2, '0');
        document.getElementById('callInfoDuration').textContent = `${minutes}:${seconds}`;
        
        if (!currentCallSid) {
            clearInterval(durationInterval);
        }
    }, 1000);
}

function resetCallInfo() {
    document.getElementById('callInfo').classList.add('hidden');
    document.getElementById('callInfoDuration').textContent = '00:00';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

