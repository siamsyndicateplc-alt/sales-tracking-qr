// public/js/auth.js
// ระบบยืนยันตัวตนพนักงาน (Employee ID Login)

const SESSION_KEY = 'emp_session';

function getStoredSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}

function saveSession(empId, empName) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ empId, empName }));
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

function showAuthToast(msg, type = 'success') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast-container';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = `toast-container show ${type}`;
    setTimeout(() => { toast.className = 'toast-container'; }, 3000);
}

function handleAuthState(loggedIn) {
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');

    if (loggedIn) {
        if (loginContainer) loginContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';
        if (window.loadEmployeeData) window.loadEmployeeData();
    } else {
        if (loginContainer) loginContainer.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
        if (window.cleanupQrSection) window.cleanupQrSection();
    }
}

async function handleLogout() {
    clearSession();
    showAuthToast('ออกจากระบบเรียบร้อยแล้ว');
    setTimeout(() => { window.location.reload(); }, 600);
}

async function getAuthToken() {
    return null;
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = getStoredSession();
    if (session && session.empId) {
        handleAuthState(true);

        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', (e) => {
                e.preventDefault();
                handleLogout();
            });
        }
        return;
    }

    handleAuthState(false);

    let employeeData = {};
    try {
        const res = await fetch('/api/employees');
        if (res.ok) {
            const data = await res.json();
            // data = { "SST00751": { name: "...", ... }, ... }
            for (const [id, info] of Object.entries(data)) {
                employeeData[id] = info.name || '';
            }
        }
    } catch (e) { /* ignore */ }

    function findEmployee(val) {
        const upper = val.trim().toUpperCase();
        if (!upper) return null;
        if (employeeData[upper]) return { id: upper, name: employeeData[upper] };
        for (const [id, name] of Object.entries(employeeData)) {
            const stripped = id.replace(/^SST0+/i, '');
            if (stripped.toUpperCase() === upper) return { id, name };
        }
        return null;
    }

    const empInput = document.getElementById('login-emp-id');
    const nameDisplay = document.getElementById('login-emp-name');
    const loginBtn = document.getElementById('btn-login');

    const nameText = document.getElementById('login-emp-name-text');

    if (empInput) {
        empInput.addEventListener('input', () => {
            const match = findEmployee(empInput.value);
            if (nameText) {
                if (match) {
                    nameText.textContent = match.name;
                    nameText.style.color = '#0F6E56';
                    nameText.style.fontWeight = '600';
                } else {
                    nameText.textContent = empInput.value.trim() ? 'ไม่พบรหัสพนักงาน' : '';
                    nameText.style.color = empInput.value.trim() ? '#EF4444' : '#9CA3AF';
                    nameText.style.fontWeight = '400';
                }
            }
        });
        empInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); loginBtn && loginBtn.click(); }
        });
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const val = empInput ? empInput.value : '';
            if (!val.trim()) {
                showAuthToast('กรุณากรอกรหัสพนักงาน', 'error');
                return;
            }
            const match = findEmployee(val);
            if (!match) {
                showAuthToast('ไม่พบรหัสพนักงาน กรุณาตรวจสอบอีกครั้ง', 'error');
                return;
            }
            saveSession(match.id, match.name);
            loginBtn.disabled = true;
            loginBtn.textContent = 'กำลังเข้าสู่ระบบ...';
            setTimeout(() => {
                handleAuthState(true);
                const btnLogout = document.getElementById('btn-logout');
                if (btnLogout) {
                    btnLogout.addEventListener('click', (e) => {
                        e.preventDefault();
                        handleLogout();
                    });
                }
            }, 300);
        });
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }
});

window.getAuthToken = getAuthToken;
window.handleLogout = handleLogout;
