// public/js/auth.js
// ระบบยืนยันตัวตนพนักงาน (Supabase Authentication & Session Management)

let supabaseClient = null;
let emailInterval = null;

// Helper: ทำการนับเวลาถอยหลัง 60 วินาทีสำหรับปุ่มส่ง OTP อีเมล
function startEmailCooldown(seconds) {
    const btn = document.getElementById('btn-send-email-otp');
    if (!btn) return;
    
    let timeLeft = seconds;
    btn.disabled = true;
    
    if (emailInterval) clearInterval(emailInterval);
    
    emailInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(emailInterval);
            btn.disabled = false;
            btn.textContent = 'ขอรหัส OTP ทางอีเมล';
        } else {
            btn.disabled = true;
            btn.textContent = `ขอรหัสอีกครั้งใน (${timeLeft} วินาที)`;
        }
    }, 1000);
}

// ดึงการตั้งค่า Supabase Anon Credentials จากเซิร์ฟเวอร์หลังบ้าน
async function initSupabase() {
    try {
        const res = await fetch('/api/config/supabase-anon');
        if (!res.ok) throw new Error('Failed to fetch Supabase config');
        const cfg = await res.json();
        
        // เริ่มต้น Supabase Client
        supabaseClient = supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
        console.log('Supabase Auth Client initialized successfully.');
        
        // ติดตั้งตัวรับฟังสถานะล็อกอิน (Auth State Listener)
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log(`Auth state event: ${event}`);
            handleAuthState(session);
        });

        // เช็ค Session ปัจจุบันทันทีที่เปิดเว็บ
        const { data: { session } } = await supabaseClient.auth.getSession();
        handleAuthState(session);

    } catch (err) {
        console.error('Supabase initialization error:', err);
        showAuthToast('ไม่สามารถเปิดใช้งานระบบความปลอดภัยได้ กรุณารีเฟรชหน้าเว็บ', 'error');
    }
}

// จัดการการแสดงผลหน้าจอตามสถานะล็อกอิน
function handleAuthState(session) {
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');

    if (session) {
        // ล็อกอินแล้ว -> ซ่อนฟอร์มล็อกอิน, แสดงแผงควบคุม QR
        if (loginContainer) loginContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';

        // โหลดข้อมูลรายชื่อพนักงานทันทีหลังจากล็อกอินสำเร็จ
        if (window.loadEmployeeData) {
            window.loadEmployeeData();
        }
    } else {
        // ยังไม่ได้ล็อกอิน -> แสดงฟอร์มล็อกอิน, ซ่อนหน้า QR
        if (loginContainer) loginContainer.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
        
        // เคลียร์ค่าฟอร์มสร้าง QR เดิม
        if (window.cleanupQrSection) {
            window.cleanupQrSection();
        }
    }
}

// ฟังก์ชันดึง Access Token ปัจจุบันสำหรับแนบกับ Header ไปหลังบ้าน
async function getAuthToken() {
    if (!supabaseClient) return null;
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session ? session.access_token : null;
}

// ฟังก์ชันแสดง Toast แจ้งเตือนเฉพาะเรื่อง Auth
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
    setTimeout(() => {
        toast.className = 'toast-container';
    }, 3000);
}

// ==========================================
// 🔐 ระบบเข้าสู่ระบบ (SIGN IN METHODS)
// ==========================================

// 1. ขอรหัส OTP ไปยังอีเมล (Request Email OTP)
async function requestEmailOtp(email) {
    if (!supabaseClient) return;

    const btn = document.getElementById('btn-send-email-otp');
    btn.disabled = true;
    btn.textContent = 'กำลังส่ง OTP...';

    const cleanEmail = email.trim();

    // ตรวจสอบรูปแบบอีเมล (Email Regex Validation)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
        showAuthToast('กรุณากรอกอีเมลให้ถูกต้อง (เช่น name@example.com)', 'error');
        btn.disabled = false;
        btn.textContent = 'ขอรหัส OTP ทางอีเมล';
        return;
    }

    // เริ่ม cooldown ทันทีที่กดปุ่ม ป้องกันกด spam ก่อน API ตอบกลับ
    startEmailCooldown(60);

    try {
        const { error } = await supabaseClient.auth.signInWithOtp({
            email: cleanEmail,
            options: {
                shouldCreateUser: true
            }
        });

        if (error) throw error;

        // สลับแสดงช่องกรอกรหัส OTP
        document.getElementById('email-request-section').style.display = 'none';
        document.getElementById('email-verify-section').style.display = 'block';
        document.getElementById('email-verify-target').textContent = cleanEmail;

        showAuthToast('ส่งรหัส OTP ไปยังอีเมลเรียบร้อยแล้ว! กรุณาตรวจสอบกล่องจดหมาย');
    } catch (err) {
        console.error('Email OTP request failed:', err);
        const isRateLimit = err.message && err.message.toLowerCase().includes('rate');
        showAuthToast(
            isRateLimit
                ? 'ส่ง OTP ถี่เกินไป กรุณารอสักครู่แล้วลองใหม่'
                : 'ขอรหัส OTP ล้มเหลว กรุณาตรวจสอบความถูกต้องของอีเมล',
            'error'
        );
    }
}

// 2. ยืนยันรหัส OTP อีเมล (Verify Email OTP)
async function verifyEmailOtp(email, otpCode) {
    if (!supabaseClient) return;

    const btn = document.getElementById('btn-verify-email-otp');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'กำลังยืนยัน...';

    try {
        const { error } = await supabaseClient.auth.verifyOtp({
            email: email,
            token: otpCode,
            type: 'email'
        });

        if (error) throw error;
        showAuthToast('ยืนยันรหัส OTP อีเมลสำเร็จ ยินดีต้อนรับ!');
    } catch (err) {
        console.error('Email OTP verification failed:', err);
        showAuthToast('รหัส OTP ไม่ถูกต้องหรือหมดอายุ', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = origText;
    }
}
// 5. ออกจากระบบ (Log Out)
async function handleLogout() {
    if (!supabaseClient) return;
    try {
        await supabaseClient.auth.signOut();
        showAuthToast('ออกจากระบบเรียบร้อยแล้ว');
        // หน่วงเวลาเล็กน้อยเพื่อให้ข้อความแจ้งเตือนแสดงผล จากนั้นรีโหลดหน้าเว็บใหม่แบบสะอาด
        setTimeout(() => {
            window.location.reload();
        }, 600);
    } catch (err) {
        console.error('Logout failed:', err);
        showAuthToast('เกิดข้อผิดพลาดในการออกจากระบบ', 'error');
    }
}

// Helper: ตั้งค่ากล่องกรอก OTP แบบ 6 ช่องแยกกัน
function setupOtpInputs(wrapperId) {
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;
    const inputs = wrapper.querySelectorAll('.otp-box');

    inputs.forEach((input, index) => {
        // จำกัดให้กรอกเฉพาะตัวเลข
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            // ลบตัวอักษรที่ไม่ใช่ตัวเลขออก
            e.target.value = val.replace(/[^0-9]/g, '');
            
            if (e.target.value.length === 1) {
                if (index < inputs.length - 1) {
                    inputs[index + 1].focus();
                } else {
                    // กรอกครบ 6 หลักแล้ว -> กดปุ่มยืนยันโดยอัตโนมัติ (Auto-Submit)
                    const verifyBtn = wrapperId === 'email-otp-wrapper' 
                        ? document.getElementById('btn-verify-email-otp')
                        : document.getElementById('btn-verify-phone-otp');
                    if (verifyBtn) {
                        verifyBtn.focus(); // ย้ายโฟกัสไปปุ่มเพื่อลดแป้นพิมพ์บนมือถือลง
                        verifyBtn.click();
                    }
                }
            }
        });

        // จัดการปุ่ม Backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
                // เคลียร์ค่าตัวกล่องก่อนหน้าด้วย
                inputs[index - 1].value = '';
            }
        });

        // จัดการการวางข้อมูล (Paste)
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = (e.clipboardData || window.clipboardData).getData('text').trim();
            if (/^\d{6}$/.test(pastedData)) {
                for (let i = 0; i < inputs.length; i++) {
                    inputs[i].value = pastedData[i] || '';
                }
                
                // กรอกครบ 6 หลักผ่านการวาง -> กดปุ่มยืนยันอัตโนมัติทันที
                const verifyBtn = wrapperId === 'email-otp-wrapper' 
                    ? document.getElementById('btn-verify-email-otp')
                    : document.getElementById('btn-verify-phone-otp');
                if (verifyBtn) {
                    verifyBtn.focus();
                    verifyBtn.click();
                }
            }
        });
    });
}

// ==========================================
// 🖥️ UI EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // โหลดฐานข้อมูล Supabase
    initSupabase();

    // เริ่มต้นตัวช่วยจัดการกล่องกรอก OTP แยกช่อง
    setupOtpInputs('email-otp-wrapper');

    // 2. ขอรหัส OTP อีเมล Submit
    const btnSendEmailOtp = document.getElementById('btn-send-email-otp');
    if (btnSendEmailOtp) {
        btnSendEmailOtp.addEventListener('click', () => {
            const email = document.getElementById('email-otp-input').value;
            if (!email) {
                showAuthToast('กรุณากรอกอีเมลของคุณ', 'error');
                return;
            }
            requestEmailOtp(email);
        });
    }

    // รองรับการกด Enter บนช่องกรอกอีเมล
    const emailOtpInput = document.getElementById('email-otp-input');
    if (emailOtpInput && btnSendEmailOtp) {
        emailOtpInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btnSendEmailOtp.click();
            }
        });
    }

    // 3. ยืนยันรหัส OTP อีเมล Submit
    const btnVerifyEmailOtp = document.getElementById('btn-verify-email-otp');
    if (btnVerifyEmailOtp) {
        btnVerifyEmailOtp.addEventListener('click', () => {
            const email = document.getElementById('email-verify-target').textContent;
            
            // ดึงรหัสผ่าน 6 ช่องมารวมกัน
            const inputs = document.querySelectorAll('#email-otp-wrapper .otp-box');
            let code = '';
            inputs.forEach(input => code += input.value.trim());

            if (!code || code.length !== 6) {
                showAuthToast('กรุณากรอกรหัส OTP 6 หลักให้ครบถ้วน', 'error');
                return;
            }
            verifyEmailOtp(email, code);
        });
    }

    // 4. ปุ่มย้อนกลับจากหน้ากรอกรหัส OTP อีเมล
    const btnBackEmailOtp = document.getElementById('btn-back-email-otp');
    if (btnBackEmailOtp) {
        btnBackEmailOtp.addEventListener('click', () => {
            document.getElementById('email-verify-section').style.display = 'none';
            document.getElementById('email-request-section').style.display = 'block';
            // เคลียร์ช่องกรอกทั้ง 6 ช่อง
            document.querySelectorAll('#email-otp-wrapper .otp-box').forEach(input => input.value = '');
        });
    }

    // 8. ปุ่มออกจากระบบ (Log Out)
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }
});

// ส่งออกฟังก์ชันเพื่อให้ script อื่นสามารถเรียกใช้งานได้
window.getAuthToken = getAuthToken;
window.handleLogout = handleLogout;
