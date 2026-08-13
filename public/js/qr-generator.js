// public/js/qr-generator.js

let employeeData = {};
let selectedCustomer = '';
let generatedSurveyUrl = '';

async function loadEmployeeData() {
    try {
        const token = window.getAuthToken ? await window.getAuthToken() : null;
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch('/api/employees', { headers });
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        employeeData = await res.json();
        
        // Merge custom jobs from LocalStorage for existing server employees only
        const saved = JSON.parse(localStorage.getItem('customEmployees') || '{}');
        for (const [empId, localEmp] of Object.entries(saved)) {
            if (employeeData[empId] && localEmp.jobs) {
                localEmp.jobs.forEach(localJob => {
                    const existsInServer = employeeData[empId].jobs.find(j => j.jobNumber === localJob.jobNumber);
                    if (!existsInServer) {
                        employeeData[empId].jobs.push(localJob);
                    }
                });
            }
        }
        
        console.log('Loaded', Object.keys(employeeData).length, 'employees (including custom)');

        // Pre-fill employee from localStorage only after data is loaded
        const savedEmp = localStorage.getItem('sst_employee');
        if (savedEmp) {
            try {
                const emp = JSON.parse(savedEmp);
                if (emp.empId && employeeData[emp.empId]) {
                    const empIdInput = document.getElementById('empId');
                    if (empIdInput) {
                        empIdInput.value = emp.empId;
                        empIdInput.dispatchEvent(new Event('input'));
                    }
                } else {
                    localStorage.removeItem('sst_employee');
                }
            } catch {}
        }
    } catch (err) {
        console.warn('Could not load employee data:', err);
        employeeData = {};
    }
}

function setupAutoFill() {
    const empListDiv = document.getElementById('empAutocompleteList');
    const jobListDiv = document.getElementById('jobAutocompleteList');
    
    const yearFilterContainer = document.getElementById('yearFilterContainer');
    const jobSearchContainer = document.getElementById('jobSearchContainer');
    const jobSearchInput = document.getElementById('jobSearchInput');
    const jobSelectWrapper = document.getElementById('jobSelectWrapper');
    const jobSelect = document.getElementById('jobSelect');
    const yearTrigger = document.getElementById('yearTrigger');
    const yearTriggerText = document.getElementById('yearTriggerText');
    const yearPickerModal = document.getElementById('yearPickerModal');
    const yearPickBtns = document.querySelectorAll('.year-pick-btn');

    function closeAllLists(elmnt) {
        if (empListDiv && elmnt !== document.getElementById('empId')) {
            empListDiv.innerHTML = '';
        }
        if (jobListDiv && elmnt !== document.getElementById('jobNumberInput')) {
            jobListDiv.innerHTML = '';
        }
    }
    
    document.addEventListener('click', function(e) {
        closeAllLists(e.target);
    });
    
    const empIdInput = document.getElementById('empId');
    const empNameInput = document.getElementById('empName');
    const jobInput = document.getElementById('jobNumberInput');
    const customerInfo = document.getElementById('customerInfo');
    const customerDisplay = document.getElementById('customerDisplay');

    if (!empIdInput) return;

    let allEmployeeJobs = [];
    let activeYear = 'all';
    let jobSearchText = '';

    // Populate the unified job select dropdown
    function populateJobSelect() {
        if (!jobSelect) return;
        
        const currentSelection = jobSelect.value;
        jobSelect.innerHTML = '<option value="">-- เลือก JOB-Number / โครงการ --</option>';
        
        const filteredJobs = allEmployeeJobs.filter(job => {
            if (job.isCompleted) return false;
            if (activeYear !== 'all' && job.year !== activeYear) return false;
            if (jobSearchText) {
                const q = jobSearchText.toLowerCase();
                return job.jobNumber.toLowerCase().includes(q) || (job.customer || '').toLowerCase().includes(q);
            }
            return true;
        });
        
        filteredJobs.forEach(job => {
            const opt = document.createElement('option');
            opt.value = job.jobNumber;
            opt.textContent = `${job.jobNumber} | ${job.customer || ''}`;
            opt.setAttribute('data-customer', job.customer || '');
            jobSelect.appendChild(opt);
        });
        
        // Add custom option
        const customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = '-- กรอกรหัส JOB อื่นๆ --';
        jobSelect.appendChild(customOpt);
        
        // Restore selection if still valid
        const isValid = Array.from(jobSelect.options).some(o => o.value === currentSelection);
        if (currentSelection && isValid) {
            jobSelect.value = currentSelection;
            const selectedOpt = Array.from(jobSelect.options).find(o => o.value === currentSelection);
            const triggerText = document.getElementById('jobSelectTriggerText');
            if (triggerText && selectedOpt) {
                if (currentSelection === 'custom') {
                    triggerText.textContent = '-- กรอกรหัส JOB อื่นๆ --';
                } else {
                    const custAttr = selectedOpt.getAttribute('data-customer') || '';
                    triggerText.textContent = `${currentSelection} | ${custAttr}`;
                }
            }
        } else {
            jobSelect.value = '';
            if (jobInput) {
                jobInput.value = '';
                jobInput.style.display = 'none';
                jobInput.required = false;
            }
            selectedCustomer = '';
            if (customerInfo) customerInfo.hidden = true;
            
            const triggerText = document.getElementById('jobSelectTriggerText');
            if (triggerText) {
                triggerText.textContent = '-- เลือก JOB-Number / โครงการ --';
            }
        }
    }

    empIdInput.addEventListener('input', function() {
        let val = this.value.trim();
        
        // Autocomplete Logic for Employee ID
        if (empListDiv) {
            empListDiv.innerHTML = '';
            if (val) {
                const matches = [];
                for (const [id, emp] of Object.entries(employeeData)) {
                    const displayId = emp.sst_id || id;
                    if (displayId.toLowerCase().includes(val.toLowerCase()) || emp.name.toLowerCase().includes(val.toLowerCase())) {
                        matches.push({ id, displayId, name: emp.name });
                    }
                }
                matches.forEach(match => {
                    const item = document.createElement('button');
                    item.type = 'button';
                    item.className = 'autocomplete-item';
                    item.innerHTML = `<strong>${match.displayId}</strong> - ${match.name}`;
                    item.addEventListener('click', function() {
                        empIdInput.value = match.id;
                        closeAllLists();
                        empIdInput.dispatchEvent(new Event('input'));
                    });
                    empListDiv.appendChild(item);
                });
            }
        }

        const empId = val.toUpperCase();
        const employee = employeeData[empId];

        if (customerInfo) customerInfo.hidden = true;
        selectedCustomer = '';
        allEmployeeJobs = [];
        activeYear = 'all';
        jobSearchText = '';
        if (jobSearchInput) jobSearchInput.value = '';
        if (yearTriggerText) yearTriggerText.textContent = 'ทุกปี';
        yearPickBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-year') === 'all'));
        if (yearTrigger) yearTrigger.style.borderColor = '';
        if (yearTrigger) yearTrigger.style.color = '';

        if (jobInput) {
            jobInput.value = '';
            jobInput.style.display = 'none';
            jobInput.required = false;
        }
        if (jobSelect) {
            jobSelect.value = '';
        }

        if (employee) {
            empNameInput.value = employee.name;
            empNameInput.classList.add('autofilled');
            empNameInput.readOnly = true;

            allEmployeeJobs = employee.jobs || [];

            populateJobSelect();

            const hasJobs = allEmployeeJobs.length > 0;
            if (yearFilterContainer) yearFilterContainer.style.display = hasJobs ? 'block' : 'none';
            if (jobSearchContainer) jobSearchContainer.style.display = hasJobs ? 'block' : 'none';
            if (jobSelectWrapper) jobSelectWrapper.style.display = hasJobs ? 'block' : 'none';

            showToast(`พบข้อมูล: ${employee.name}`, 1800);
        } else {
            empNameInput.classList.remove('autofilled');
            empNameInput.readOnly = false;

            if (yearFilterContainer) yearFilterContainer.style.display = 'none';
            if (jobSearchContainer) jobSearchContainer.style.display = 'none';
            if (jobSelectWrapper) jobSelectWrapper.style.display = 'none';
            
            // Show manual text input for non-existent employees
            if (jobInput) {
                jobInput.style.display = 'block';
                jobInput.required = true;
            }
        }
    });

    if (jobInput) {
        jobInput.addEventListener('input', function() {
            const val = this.value.trim();
            
            // For custom inputs, try to match customer name in the loaded list if typed exactly
            const match = allEmployeeJobs.find(job => job.jobNumber.toUpperCase() === val.toUpperCase());
            if (match) {
                selectedCustomer = match.customer || '';
                if (selectedCustomer) {
                    customerDisplay.textContent = selectedCustomer;
                    customerInfo.hidden = false;
                } else {
                    customerInfo.hidden = true;
                }
            } else {
                selectedCustomer = '';
                customerInfo.hidden = true;
            }
        });
    }

    // Year picker modal
    if (yearTrigger && yearPickerModal) {
        yearTrigger.addEventListener('click', () => { yearPickerModal.hidden = false; });
        yearPickerModal.addEventListener('click', e => { if (e.target === yearPickerModal) yearPickerModal.hidden = true; });
    }
    yearPickBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            yearPickBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            activeYear = this.getAttribute('data-year');
            const label = activeYear === 'all' ? 'ทุกปี' : activeYear;
            if (yearTriggerText) yearTriggerText.textContent = label;
            if (yearTrigger) {
                const isFiltered = activeYear !== 'all';
                yearTrigger.style.borderColor = isFiltered ? 'var(--primary)' : '';
                yearTrigger.style.color = isFiltered ? 'var(--primary)' : '';
            }
            if (yearPickerModal) yearPickerModal.hidden = true;
            populateJobSelect();
        });
    });

    // Job search event listener
    if (jobSearchInput) {
        jobSearchInput.addEventListener('input', function() {
            jobSearchText = this.value.trim();
            populateJobSelect();
        });
    }

    // Set up event listener for the unified Job Select dropdown
    if (jobSelect) {
        jobSelect.addEventListener('change', function() {
            const val = this.value;
            if (val === 'custom') {
                if (jobInput) {
                    jobInput.value = '';
                    jobInput.style.display = 'block';
                    jobInput.required = true;
                    jobInput.focus();
                }
                selectedCustomer = '';
                if (customerInfo) customerInfo.hidden = true;
            } else if (val) {
                const selectedOption = this.options[this.selectedIndex];
                const cust = selectedOption.getAttribute('data-customer') || '';
                if (jobInput) {
                    jobInput.value = val;
                    jobInput.style.display = 'none';
                    jobInput.required = false;
                }
                selectedCustomer = cust;
                if (selectedCustomer) {
                    customerDisplay.textContent = selectedCustomer;
                    if (customerInfo) customerInfo.hidden = false;
                } else {
                    if (customerInfo) customerInfo.hidden = true;
                }
            } else {
                if (jobInput) {
                    jobInput.value = '';
                    jobInput.style.display = 'none';
                    jobInput.required = false;
                }
                selectedCustomer = '';
                if (customerInfo) customerInfo.hidden = true;
            }
        });
    }

    // ==========================================
    // 🔍 Search Modal for Job Number Selection
    // ==========================================
    const jobSelectTrigger = document.getElementById('jobSelectTrigger');
    const jobSearchModal = document.getElementById('jobSearchModal');
    const closeSearchModal = document.getElementById('closeSearchModal');
    const modalSearchInput = document.getElementById('modalSearchInput');
    const modalJobList = document.getElementById('modalJobList');

    function renderModalJobList(searchQuery = '') {
        if (!modalJobList) return;
        modalJobList.innerHTML = '';

        const q = searchQuery.toLowerCase().trim();

        const filtered = allEmployeeJobs.filter(job => {
            if (job.isCompleted) return false;
            if (activeYear !== 'all' && job.year !== activeYear) return false;
            if (!q) return true;
            const jobNo = (job.jobNumber || '').toLowerCase();
            const cust = (job.customer || '').toLowerCase();
            return jobNo.includes(q) || cust.includes(q);
        });

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'modal-job-item empty-state';
            empty.style.cssText = 'text-align: center; color: var(--text-secondary); padding: 24px 8px; font-size: 13px;';
            empty.textContent = searchQuery ? 'ไม่พบข้อมูลเลข JOB หรือชื่อลูกค้าที่ค้นหา' : 'ไม่มีรายการงานในแผนกนี้ หรืองานทุกรายการถูกประเมินครบแล้ว';
            modalJobList.appendChild(empty);
        } else {
            filtered.forEach(job => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'modal-job-item';

                item.innerHTML = `
                    <div class="job-item-header">
                        <span class="job-item-number">${job.jobNumber}</span>
                    </div>
                    <div class="job-item-customer">${job.customer || ''}</div>
                `;

                item.addEventListener('click', () => {
                    const customer = job.customer || '';
                    selectedCustomer = customer;

                    if (jobInput) {
                        jobInput.value = job.jobNumber;
                        jobInput.style.display = 'none';
                        jobInput.required = false;
                    }
                    if (customerDisplay) {
                        customerDisplay.textContent = customer || '-';
                    }
                    if (customerInfo) {
                        customerInfo.hidden = false;
                    }

                    const triggerText = document.getElementById('jobSelectTriggerText');
                    if (triggerText) {
                        triggerText.textContent = `${job.jobNumber} | ${customer}`;
                    }
                    if (jobSelect) {
                        jobSelect.value = job.jobNumber;
                    }

                    closeJobSearchModal();
                });
                modalJobList.appendChild(item);
            });
        }

        // Add Custom Option at the bottom
        const customItem = document.createElement('button');
        customItem.type = 'button';
        customItem.className = 'modal-job-item custom-option';
        customItem.innerHTML = `
            <div class="job-item-header">
                <span class="job-item-number" style="color: var(--primary); font-weight: 700;">-- กรอกรหัส JOB อื่นๆ --</span>
            </div>
            <div class="job-item-customer">ระบุเลข JOB ใหม่ด้วยตัวเอง</div>
        `;
        customItem.addEventListener('click', () => {
            if (jobSelect) {
                jobSelect.value = 'custom';
                jobSelect.dispatchEvent(new Event('change'));

                const triggerText = document.getElementById('jobSelectTriggerText');
                if (triggerText) {
                    triggerText.textContent = '-- กรอกรหัส JOB อื่นๆ --';
                }

                closeJobSearchModal();
            }
        });
        modalJobList.appendChild(customItem);
    }

    const clearSearchInput = document.getElementById('clearSearchInput');

    function closeJobSearchModal() {
        if (jobSearchModal) jobSearchModal.classList.remove('show');
        document.body.style.overflow = ''; // Restore background scroll
    }

    if (jobSelectTrigger && jobSearchModal) {
        jobSelectTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            jobSearchModal.classList.add('show');
            document.body.style.overflow = 'hidden'; // Lock background scroll
            if (modalSearchInput) {
                modalSearchInput.value = '';
                // Synchronous focus for reliable virtual keyboard on iOS/Android
                modalSearchInput.focus();
            }
            if (clearSearchInput) clearSearchInput.style.display = 'none';
            renderModalJobList('');
        });
    }

    if (closeSearchModal) {
        closeSearchModal.addEventListener('click', (e) => {
            e.preventDefault();
            closeJobSearchModal();
        });
    }

    if (jobSearchModal) {
        // Tap backdrop to close (reliable on desktop and iOS because of cursor: pointer in CSS)
        jobSearchModal.addEventListener('click', (e) => {
            if (e.target === jobSearchModal) {
                closeJobSearchModal();
            }
        });
    }

    if (modalSearchInput) {
        modalSearchInput.addEventListener('input', function() {
            const val = this.value.trim();
            if (clearSearchInput) {
                clearSearchInput.style.display = val ? 'flex' : 'none';
            }
            renderModalJobList(val);
        });
    }

    if (clearSearchInput && modalSearchInput) {
        clearSearchInput.addEventListener('click', (e) => {
            e.preventDefault();
            modalSearchInput.value = '';
            clearSearchInput.style.display = 'none';
            modalSearchInput.focus();
            renderModalJobList('');
        });
    }
}

function showConfirmModal(data) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-qr-modal');
        if (!modal) { resolve(true); return; }

        document.getElementById('confirm-emp-name').textContent = `${data.empId} — ${data.empName}`;
        document.getElementById('confirm-job-number').textContent = data.projectName;
        document.getElementById('confirm-customer').textContent = data.customerName;

        modal.hidden = false;

        const btnOk = document.getElementById('confirm-qr-ok');
        const btnCancel = document.getElementById('confirm-qr-cancel');

        const cleanup = (result) => {
            modal.hidden = true;
            btnOk.removeEventListener('click', onOk);
            btnCancel.removeEventListener('click', onCancel);
            resolve(result);
        };

        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);

        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
    });
}

function showCustomPrompt() {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-prompt-modal');
        const input = document.getElementById('custom-prompt-input');
        const btnOk = document.getElementById('custom-prompt-ok');
        const btnCancel = document.getElementById('custom-prompt-cancel');

        if (!modal) {
            // fallback if modal not found
            resolve(prompt('กรุณากรอกชื่อลูกค้า/โครงการ:'));
            return;
        }

        input.value = '';
        modal.hidden = false;
        input.focus();

        const cleanup = () => {
            modal.hidden = true;
            btnOk.removeEventListener('click', onOk);
            btnCancel.removeEventListener('click', onCancel);
            input.removeEventListener('keydown', onEnter);
        };

        const onOk = () => { cleanup(); resolve(input.value); };
        const onCancel = () => { cleanup(); resolve(null); };
        const onEnter = (e) => { if (e.key === 'Enter') onOk(); };

        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
        input.addEventListener('keydown', onEnter);
    });
}

function setupFormSubmit() {
    const form = document.getElementById('qrForm');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const jobInput = document.getElementById('jobNumberInput');
        const jobValue = jobInput ? jobInput.value.trim() : '';

        const data = {
            empId: document.getElementById('empId').value.trim().toUpperCase(),
            empName: document.getElementById('empName').value.trim(),
            projectName: jobValue,
            customerName: selectedCustomer || ''
        };

        if (!data.empId || !data.empName || !data.projectName) {
            showToast('กรุณากรอกข้อมูลให้ครบ');
            return;
        }

        // Validate Employee ID exists in the database to prevent typos
        if (Object.keys(employeeData).length > 0 && !employeeData[data.empId]) {
            showToast('ไม่พบรหัสพนักงานนี้ในระบบหลัก กรุณาตรวจสอบรหัสพนักงานอีกครั้ง');
            return;
        }

        if (!data.customerName) {
            const manual = await showCustomPrompt();
            if (!manual || !manual.trim()) {
                showToast('ต้องกรอกชื่อลูกค้า/โครงการ');
                return;
            }
            data.customerName = manual.trim();
        }

        const confirmed = await showConfirmModal(data);
        if (!confirmed) return;

        await createAndDisplayQR(data);
        
        // Save new employee and job to localStorage memory
        const customEmployees = JSON.parse(localStorage.getItem('customEmployees') || '{}');
        const emp = customEmployees[data.empId] || { name: data.empName, jobs: [] };
        
        // Ensure name is up to date
        emp.name = data.empName;

        // Add job if it doesn't exist in memory
        const jobExists = emp.jobs.find(j => j.jobNumber === data.projectName);
        if (!jobExists) {
            emp.jobs.push({ jobNumber: data.projectName, customer: data.customerName });
        }
        
        customEmployees[data.empId] = emp;
        localStorage.setItem('customEmployees', JSON.stringify(customEmployees));
        
        // Update current session memory
        if (!employeeData[data.empId]) {
            employeeData[data.empId] = { ...emp };
        } else {
            // Also push to standard memory so they don't have to refresh if they generate another one right away
            if (!employeeData[data.empId].jobs) employeeData[data.empId].jobs = [];
            if (!employeeData[data.empId].jobs.find(j => j.jobNumber === data.projectName)) {
                employeeData[data.empId].jobs.push({ jobNumber: data.projectName, customer: data.customerName });
            }
        }
    });
}

async function createAndDisplayQR(data) {
    const btnGenerate = document.querySelector('.btn-create-qr');
    if (btnGenerate) {
        btnGenerate.disabled = true;
        btnGenerate.textContent = 'กำลังสร้าง QR Code...';
    }

    try {
        cleanupQrSection();

        const QR_REDIRECT_BASE = window.QR_REDIRECT_BASE || '/scan.html';
        const baseUrl = QR_REDIRECT_BASE.startsWith('http')
            ? QR_REDIRECT_BASE
            : window.location.origin + QR_REDIRECT_BASE;
        
        const tempParams = new URLSearchParams({
            emp_id: data.empId,
            emp_name: data.empName,
            project: data.projectName,
            customer: data.customerName,
            openExternalBrowser: '1'
        });
        const tempUrl = `${baseUrl}?${tempParams.toString()}`;

        let finalUrl = tempUrl;
        let displayData = { ...data };
        let isDuplicate = false;

        try {
            const token = window.getAuthToken ? await window.getAuthToken() : null;
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const response = await fetch('/api/qr-logs', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    employee_id: data.empId,
                    employee_name: data.empName,
                    project_name: data.projectName,
                    customer_name: data.customerName,
                    generated_url: tempUrl
                })
            });

            if (response.ok) {
                const resData = await response.json();
                if (resData.already_exists) {
                    isDuplicate = true;
                    finalUrl = resData.generated_url || tempUrl;
                    displayData = {
                        empId: resData.employee_id || data.empId,
                        empName: resData.employee_name || data.empName,
                        projectName: resData.project_name || data.projectName,
                        customerName: resData.customer_name || data.customerName
                    };
                }
            }
        } catch (err) {
            console.warn('Failed to communicate with qr-logs backend:', err);
        }

        generatedSurveyUrl = finalUrl;

        const newCanvas = document.getElementById('qr-canvas');
        if (newCanvas) {
            await renderQR(newCanvas, generatedSurveyUrl);
        }

        const displayEmpId = document.getElementById('displayEmpId');
        const displayEmpName = document.getElementById('displayEmpName');
        const displayProject = document.getElementById('displayProject');
        const displayCustomer = document.getElementById('displayCustomer');
        if (displayEmpId) displayEmpId.textContent = displayData.empId;
        if (displayEmpName) displayEmpName.textContent = displayData.empName;
        if (displayProject) displayProject.textContent = displayData.projectName;
        if (displayCustomer) displayCustomer.textContent = displayData.customerName;

        const formCard = document.querySelector('.qr-card');
        const qrSection = document.getElementById('qr-section');
        
        if (formCard) formCard.hidden = true;
        if (qrSection) {
            qrSection.hidden = false;
            qrSection.classList.remove('hidden'); // keep for backward compatibility
            qrSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        localStorage.setItem('sst_employee', JSON.stringify({
            empId: data.empId,
            empName: data.empName
        }));

        if (isDuplicate) {
            showToast('พบชื่อโครงการ / เลข Job นี้ในระบบแล้ว ดึงข้อมูล QR Code เดิม', 4000);
        } else {
            showToast('สร้าง QR Code สำเร็จ!');
        }

        // Start polling for real-time status updates (every 3 seconds)
        startStatusPolling(data.projectName);

    } catch (error) {
        console.error('QR Generation error:', error);
        showToast('ไม่สามารถสร้าง QR Code ได้');
    } finally {
        if (btnGenerate) {
            btnGenerate.disabled = false;
            btnGenerate.textContent = 'สร้าง QR Code';
        }
    }
}

function startCountdownAndReset(seconds) {
    if (window._countdownInterval) clearInterval(window._countdownInterval);
    const desc = document.getElementById('waiting-scanned-desc');
    let remaining = seconds;

    function updateText() {
        if (desc) desc.innerHTML = `ลูกค้าสแกน QR Code แล้ว กำลังกรอกแบบประเมิน...<br><strong style="color:#D97706;">กลับหน้าหลักใน ${remaining} วินาที</strong>`;
    }
    updateText();

    window._countdownInterval = setInterval(() => {
        remaining--;
        updateText();
        if (remaining <= 0) {
            clearInterval(window._countdownInterval);
            window._countdownInterval = null;
            cleanupQrSection();
            const qrSection = document.getElementById('qr-section');
            const formCard = document.querySelector('.qr-card');
            if (qrSection) { qrSection.hidden = true; qrSection.classList.add('hidden'); }
            if (formCard) { formCard.hidden = false; formCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        }
    }, 1000);
}

function showWaitingSection(state) {
    const qrSection = document.getElementById('qr-section');
    const waitingSection = document.getElementById('scan-waiting-section');
    if (!waitingSection) return;

    const waitingJob = document.getElementById('waiting-display-job');
    const waitingCustomer = document.getElementById('waiting-display-customer');
    const waitingEmp = document.getElementById('waiting-display-emp');
    if (waitingJob) waitingJob.textContent = document.getElementById('displayProject')?.textContent || '-';
    if (waitingCustomer) waitingCustomer.textContent = document.getElementById('displayCustomer')?.textContent || '-';
    if (waitingEmp) waitingEmp.textContent = document.getElementById('displayEmpName')?.textContent || '-';

    if (qrSection) qrSection.hidden = true;
    waitingSection.hidden = false;

    document.getElementById('waiting-state-waiting').hidden  = state !== 'waiting';
    document.getElementById('waiting-state-scanned').hidden  = state !== 'scanned';
    document.getElementById('waiting-state-completed').hidden = state !== 'completed';

    waitingSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cleanupQrSection() {
    if (window._countdownInterval) {
        clearInterval(window._countdownInterval);
        window._countdownInterval = null;
    }
    const waitingSection = document.getElementById('scan-waiting-section');
    if (waitingSection) waitingSection.hidden = true;

    const container = document.querySelector('.qr-canvas-container');
    if (container) {
        container.innerHTML = `
            <canvas id="qr-canvas" width="240" height="240"></canvas>
            <div id="qr-success-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255, 255, 255, 0.96); display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: all 0.4s ease; border-radius: 12px; z-index: 10;">
                <div style="width: 68px; height: 68px; background: #D1FAE5; color: #10B981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.2);">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <span style="font-size: 15px; color: #065F46; font-weight: 600;">ประเมินเสร็จเรียบร้อย!</span>
                <span style="font-size: 11px; color: #047857; margin-top: 2px;">ขอบคุณสำหรับความพึงพอใจ</span>
            </div>
        `;
    }

    const badge = document.getElementById('qr-status-badge');
    const dot = document.getElementById('qr-status-dot');
    const text = document.getElementById('qr-status-text');
    if (badge) {
        badge.style.background = '#F3F4F6';
        badge.style.color = '#4B5563';
        badge.style.borderColor = '#E5E7EB';
    }
    if (dot) {
        dot.className = 'status-pulse-gray';
        dot.style.background = '#9CA3AF';
    }
    if (text) {
        text.textContent = 'รอการสแกน...';
    }

    const btnSave = document.getElementById('btn-save');
    const btnShare = document.getElementById('btn-share');
    const btnCopy = document.getElementById('btn-copy');
    if (btnSave) btnSave.disabled = false;
    if (btnShare) btnShare.disabled = false;
    if (btnCopy) btnCopy.disabled = false;

    if (window.statusPollInterval) {
        clearInterval(window.statusPollInterval);
        window.statusPollInterval = null;
    }

    const displayEmpId = document.getElementById('displayEmpId');
    const displayEmpName = document.getElementById('displayEmpName');
    const displayProject = document.getElementById('displayProject');
    const displayCustomer = document.getElementById('displayCustomer');
    if (displayEmpId) displayEmpId.textContent = '-';
    if (displayEmpName) displayEmpName.textContent = '-';
    if (displayProject) displayProject.textContent = '-';
    if (displayCustomer) displayCustomer.textContent = '-';
}

function startStatusPolling(project_name) {
    if (window.statusPollInterval) {
        clearInterval(window.statusPollInterval);
    }

    const badge = document.getElementById('qr-status-badge');
    const dot = document.getElementById('qr-status-dot');
    const text = document.getElementById('qr-status-text');
    const overlay = document.getElementById('qr-success-overlay');
    const btnSave = document.getElementById('btn-save');
    const btnShare = document.getElementById('btn-share');
    const btnCopy = document.getElementById('btn-copy');

    let isScannedState = false;

    window.statusPollInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/survey/check-completed?project=${encodeURIComponent(project_name)}`);
            if (res.ok) {
                const data = await res.json();

                if (data.completed || data.final_step_done) {
                    clearInterval(window.statusPollInterval);
                    window.statusPollInterval = null;

                    if (badge) {
                        badge.style.background = '#D1FAE5';
                        badge.style.color = '#065F46';
                        badge.style.borderColor = '#A7F3D0';
                    }
                    if (dot) {
                        dot.className = 'status-pulse-green';
                        dot.style.background = '#10B981';
                    }
                    if (text) {
                        text.textContent = 'ประเมินเสร็จเรียบร้อยแล้ว!';
                    }
                    if (overlay) {
                        overlay.style.opacity = '1';
                        overlay.style.pointerEvents = 'auto';
                    }

                    if (btnSave) btnSave.disabled = true;
                    if (btnShare) btnShare.disabled = true;
                    if (btnCopy) btnCopy.disabled = true;

                    showToast('ลูกค้าทำการส่งแบบประเมินเรียบร้อยแล้ว!', 3000);
                    showWaitingSection('completed');

                } else if (data.scanned && !isScannedState) {
                    isScannedState = true;
                    if (badge) {
                        badge.style.background = '#FEF3C7';
                        badge.style.color = '#92400E';
                        badge.style.borderColor = '#FDE68A';
                    }
                    if (dot) {
                        dot.className = 'status-pulse-amber';
                        dot.style.background = '#F59E0B';
                    }
                    if (text) {
                        text.textContent = 'ลูกค้ากำลังทำแบบสอบถาม...';
                    }
                    showToast('ลูกค้าสแกน QR Code แล้ว กำลังตอบแบบสอบถาม...', 3000);
                    showWaitingSection('scanned');
                    startCountdownAndReset(5);
                }
            }
        } catch (err) {
            console.warn('Status polling error:', err);
        }
    }, 3000);
}

async function renderQR(canvas, url) {
    if (typeof QRCode === 'undefined') return;
    await QRCode.toCanvas(canvas, url, {
        width: 240,
        margin: 1,
        color: { dark: '#0F6E56', light: '#FFFFFF' },
        errorCorrectionLevel: 'H'
    });

    await new Promise((resolve) => {
        const logo = new Image();
        logo.onload = () => {
            const ctx = canvas.getContext('2d');
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            const r = 44;

            // White circle background
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
            ctx.clip();

            // Crop bottom ~38% (text area), keep symbol only
            const srcX = 30;
            const srcW = logo.naturalWidth - 60;
            const srcH = Math.floor(logo.naturalHeight * 0.62);
            const d = r * 2;
            const scale = Math.max(d / srcW, d / srcH);
            const dw = srcW * scale;
            const dh = srcH * scale;
            ctx.drawImage(logo, srcX, 0, srcW, srcH, cx - dw / 2, cy - dh / 2, dw, dh);

            ctx.restore();
            resolve();
        };
        logo.onerror = resolve;
        logo.src = '/img/company_logo.png';
    });

    const dataUrl = canvas.toDataURL('image/png');
    let img = document.getElementById('qr-image-overlay');
    if (!img) {
        img = document.createElement('img');
        img.id = 'qr-image-overlay';
        img.alt = 'QR Code';
        img.width = 240;
        img.height = 240;
        img.style.cssText = `
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            opacity: 0;
            pointer-events: none;
        `;
        canvas.parentElement.style.position = 'relative';
        canvas.parentElement.appendChild(img);
    }
    img.src = dataUrl;

    if (window.InAppBrowser && window.InAppBrowser.detect()) {
        img.style.opacity = '1';
        img.style.pointerEvents = 'auto';
        canvas.style.opacity = '0';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Expose functions globally so auth.js can trigger them on login
    window.loadEmployeeData = loadEmployeeData;
    window.cleanupQrSection = cleanupQrSection;

    setupAutoFill();
    setupFormSubmit();
    
    const btnSave = document.getElementById('btn-save');
    const btnShare = document.getElementById('btn-share');
    const btnCopy = document.getElementById('btn-copy');
    const btnReset = document.getElementById('btn-reset');
    
    if (btnSave) {
        btnSave.addEventListener('click', async function() {
            const canvas = document.getElementById('qr-canvas');
            if (!canvas) return;

            const inApp = window.InAppBrowser && window.InAppBrowser.detect();
            const isAndroid = window.InAppBrowser && window.InAppBrowser.isAndroid();

            if (inApp && isAndroid) {
                showToast('กดค้างที่ QR Code ด้านบน → เลือก "บันทึกรูปภาพ"', 4000);
                return;
            }

            try {
                const targetFrame = document.querySelector('.qr-dashed-frame');
                if (!targetFrame) {
                    showToast('ไม่พบกรอบ QR Code', 2000);
                    return;
                }
                
                // แจ้งเตือนก่อนเริ่มแคปจอเพราะอาจจะใช้เวลาเล็กน้อย
                showToast('กำลังประมวลผลรูปภาพ...', 1500);

                const canvasFrame = await html2canvas(targetFrame, {
                    scale: 2, // ความคมชัดสูง 2 เท่า
                    backgroundColor: '#FFFFFF',
                    useCORS: true
                });

                const link = document.createElement('a');
                const empId = document.getElementById('displayEmpId').textContent || 'qr';
                const safeName = empId.replace(/[^a-zA-Z0-9_-]/g, '');
                link.download = `SST_QR_${safeName}_${Date.now()}.png`;
                link.href = canvasFrame.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                setTimeout(() => showToast('บันทึกรูปภาพเรียบร้อยแล้ว!', 2000), 1000);
            } catch (err) {
                console.error(err);
                showToast('ไม่สามารถบันทึกได้ กรุณากดค้างที่ QR Code');
            }
        });
    }

    if (btnShare) {
        btnShare.addEventListener('click', async function() {
            const canvas = document.getElementById('qr-canvas');
            if (!canvas) return;

            const empName = document.getElementById('displayEmpName').textContent || '';
            const project = document.getElementById('displayProject').textContent || '';
            const customer = document.getElementById('displayCustomer').textContent || '';
            const shareText = `แบบประเมินความพึงพอใจจาก ${empName}\nJOB-Number: ${project}\nชื่อลูกค้า/โครงการ: ${customer}\n\nกรุณาสแกน QR หรือคลิกลิงก์`;

            const inApp = window.InAppBrowser && window.InAppBrowser.detect();
            const isAndroid = window.InAppBrowser && window.InAppBrowser.isAndroid();

            if (inApp && isAndroid) {
                try {
                    await navigator.clipboard.writeText(generatedSurveyUrl);
                    showToast('คัดลอกลิงก์แล้ว — ไปวางในแอปที่ต้องการแชร์', 3500);
                } catch {
                    showToast('กรุณาเปิดในเบราว์เซอร์เพื่อใช้งานการแชร์');
                }
                return;
            }

            try {
                showToast('กำลังเตรียมรูปภาพเพื่อแชร์...', 1000);
                const targetFrame = document.querySelector('.qr-dashed-frame');
                const canvasFrame = targetFrame ? await html2canvas(targetFrame, {
                    scale: 2,
                    backgroundColor: '#FFFFFF',
                    useCORS: true
                }) : canvas;

                const blob = await new Promise(resolve => canvasFrame.toBlob(resolve, 'image/png'));
                const file = new File([blob], 'SST_QR_Survey.png', { type: 'image/png' });

                if (window.InAppBrowser?.canShareFiles() && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'QR Code แบบประเมิน',
                        text: shareText
                    });
                    return;
                }

                if (navigator.share) {
                    await navigator.share({
                        title: 'QR Code แบบประเมิน',
                        text: shareText,
                        url: generatedSurveyUrl
                    });
                    return;
                }

                await navigator.clipboard.writeText(generatedSurveyUrl);
                showToast('คัดลอกลิงก์แล้ว — ไปวางในแอปที่ต้องการแชร์', 3500);
            } catch (err) {
                if (err && err.name !== 'AbortError') {
                    try {
                        await navigator.clipboard.writeText(generatedSurveyUrl);
                        showToast('คัดลอกลิงก์แล้ว', 3000);
                    } catch {
                        showToast('แชร์ไม่สำเร็จ');
                    }
                }
            }
        });
    }

    if (btnCopy) {
        btnCopy.addEventListener('click', () => {
            if (!generatedSurveyUrl) return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(generatedSurveyUrl)
                    .then(() => showToast('คัดลอกลิงก์สำเร็จ!'))
                    .catch(() => fallbackCopyText(generatedSurveyUrl));
            } else {
                fallbackCopyText(generatedSurveyUrl);
            }
        });
    }




    if (btnReset) {
        btnReset.addEventListener('click', () => {
            const empIdInput = document.getElementById('empId');
            const empNameInput = document.getElementById('empName');
            if (empIdInput) empIdInput.value = '';
            if (empNameInput) {
                empNameInput.value = '';
                empNameInput.classList.remove('autofilled');
            }
            
            const jobInput = document.getElementById('jobNumberInput');
            const jobSelect = document.getElementById('jobSelect');
            const jobSelectWrapper = document.getElementById('jobSelectWrapper');
            const jobAutocompleteList = document.getElementById('jobAutocompleteList');
            const deptFilterContainer = document.getElementById('deptFilterContainer');
            const chips = document.querySelectorAll('.dept-chip');
            
            if (jobInput) {
                jobInput.value = '';
                jobInput.style.display = 'none';
            }
            if (jobSelect) {
                jobSelect.value = '';
            }
            if (jobSelectWrapper) {
                jobSelectWrapper.style.display = 'none';
            }
            if (jobAutocompleteList) {
                jobAutocompleteList.innerHTML = '';
            }
            if (deptFilterContainer) {
                deptFilterContainer.style.display = 'none';
            }
            chips.forEach(c => {
                if (c.getAttribute('data-dept') === 'all') {
                    c.classList.add('active');
                } else {
                    c.classList.remove('active');
                }
            });
            
            const customerInfo = document.getElementById('customerInfo');
            if (customerInfo) customerInfo.hidden = true;
            selectedCustomer = '';
            
            localStorage.removeItem('sst_employee');
            cleanupQrSection();
            
            const qrSection = document.getElementById('qr-section');
            const formCard = document.querySelector('.qr-card');
            if (qrSection) {
                qrSection.hidden = true;
                qrSection.classList.add('hidden'); // backward compatibility
            }
            if (formCard) {
                formCard.hidden = false;
                formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            
            setTimeout(() => {
                if (empIdInput) empIdInput.focus();
            }, 350);
        });
    }

    const inAppApp = window.InAppBrowser && window.InAppBrowser.detect();
    if (inAppApp) {
        const banner = document.getElementById('webview-banner');
        const appName = document.getElementById('webview-app-name');
        if (banner) banner.hidden = false;
        if (appName) appName.textContent = inAppApp;

        const openBtn = document.getElementById('open-in-browser-btn');
        if (openBtn) {
            openBtn.addEventListener('click', () => {
                window.InAppBrowser.openInExternalBrowser();
            });
        }
    }
});

let toastTimeout = null;
function showToast(msg, duration = 2000) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast-container';
        document.body.appendChild(toast);
    }
    if (toastTimeout) clearTimeout(toastTimeout);
    toast.textContent = msg;
    toast.classList.add('show');
    toastTimeout = setTimeout(() => toast.classList.remove('show'), duration);
}

function fallbackCopyText(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showToast('คัดลอกลิงก์สำเร็จ!');
    } catch (err) {
        showToast('ไม่สามารถคัดลอกลิงก์ได้');
    }
    document.body.removeChild(textArea);
}
