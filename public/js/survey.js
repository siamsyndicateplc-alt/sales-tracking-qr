document.addEventListener('DOMContentLoaded', () => {
    // Helper to sanitize client-side parameters
    const sanitizeString = (str) => {
        if (!str) return '';
        return str.replace(/<[^>]*>/g, '').replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s\-_./()]/g, '').trim().substring(0, 100);
    };

    // 1. Retrieve Session Data from LocalStorage
    let empId, empName, project, customer;
    
    try {
        const sessionStr = localStorage.getItem('sst_session');
        if (sessionStr) {
            const session = JSON.parse(sessionStr);
            empId = sanitizeString(session.emp_id);
            empName = sanitizeString(session.emp_name);
            project = sanitizeString(session.project);
            customer = sanitizeString(session.customer);
        } else {
            // Fallback to URL Parameters (just in case they accessed directly)
            const params = new URLSearchParams(window.location.search);
            empId = sanitizeString(params.get('emp_id'));
            empName = sanitizeString(params.get('emp_name'));
            project = sanitizeString(params.get('project'));
            customer = sanitizeString(params.get('customer'));
        }
    } catch (e) {
        console.error('Error parsing session', e);
    }

    const errorCard = document.getElementById('error-card');
    const surveyCard = document.getElementById('survey-card');
    const successCard = document.getElementById('success-card');
    const loadingCard = document.getElementById('loading-card');

    if (!empId || !empName) {
        // Show error if essential params are missing
        if (loadingCard) loadingCard.classList.add('hidden');
        if (errorCard) errorCard.classList.remove('hidden');
        if (surveyCard) surveyCard.classList.add('hidden');
    } else {
        // Populate info badge
        document.getElementById('empName').textContent = empName;
        document.getElementById('projectName').textContent = project || '-';
        document.getElementById('customerName').textContent = customer || '-';
        
        // Check if already completed
        fetch(`/api/survey/check-completed?emp_id=${empId}&customer=${encodeURIComponent(customer || '')}&project=${encodeURIComponent(project || '')}`)
            .then(res => res.json())
            .then(data => {
                setTimeout(() => {
                    if (loadingCard) loadingCard.classList.add('hidden');
                    if (data.completed) {
                        // Already completed, show success screen
                        if (successCard) successCard.classList.remove('hidden');
                    } else {
                        // Not completed, show survey form
                        if (errorCard) errorCard.classList.add('hidden');
                        if (surveyCard) surveyCard.classList.remove('hidden');
                    }
                }, 800);
            })
            .catch(err => {
                console.error('Check status error:', err);
                // Fallback to showing form if check fails
                setTimeout(() => {
                    if (loadingCard) loadingCard.classList.add('hidden');
                    if (errorCard) errorCard.classList.add('hidden');
                    if (surveyCard) surveyCard.classList.remove('hidden');
                }, 800);
            });
    }

    // 2. Star Ratings Logic
    const ratings = { q1: 0, q2: 0, q3: 0, q4: 0 };
    const starContainers = document.querySelectorAll('.stars-container');
    
    const starLabels = {
        1: 'ต้องปรับปรุง',
        2: 'พอใช้',
        3: 'ปานกลาง',
        4: 'ดี',
        5: 'ดีมาก'
    };

    starContainers.forEach(container => {
        const qId = container.getAttribute('data-q');
        const stars = container.querySelectorAll('.star-btn');
        const textElement = document.getElementById(`rating-text-${qId}`);

        stars.forEach(star => {
            star.addEventListener('click', () => {
                const val = parseInt(star.getAttribute('data-val'), 10);
                ratings[qId] = val;
                
                // Update visual state
                stars.forEach(s => {
                    if (parseInt(s.getAttribute('data-val'), 10) <= val) {
                        s.classList.add('active');
                    } else {
                        s.classList.remove('active');
                    }
                });
                
                if (textElement) {
                    textElement.textContent = starLabels[val] || '';
                    textElement.className = `rating-text level-${val}`;
                }
            });

            // Hover effect (only for devices supporting mouse/hover to prevent stuck stars on mobile touch screens)
            const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            if (!isTouchDevice) {
                star.addEventListener('mouseenter', () => {
                    const hoverVal = parseInt(star.getAttribute('data-val'), 10);
                    stars.forEach(s => {
                        if (parseInt(s.getAttribute('data-val'), 10) <= hoverVal) {
                            s.classList.add('hover-active');
                        }
                    });
                    
                    if (textElement) {
                        textElement.textContent = starLabels[hoverVal] || '';
                        textElement.className = `rating-text level-${hoverVal}`;
                    }
                });

                star.addEventListener('mouseleave', () => {
                    stars.forEach(s => s.classList.remove('hover-active'));
                    
                    // Revert text to selected rating
                    if (textElement) {
                        const currentVal = ratings[qId];
                        if (currentVal > 0) {
                            textElement.textContent = starLabels[currentVal] || '';
                            textElement.className = `rating-text level-${currentVal}`;
                        } else {
                            textElement.textContent = '';
                            textElement.className = 'rating-text';
                        }
                    }
                });
            }
        });
    });

    // 3. Improvements Checkboxes
    const improveNone = document.getElementById('improveNone');
    const improveOtherCheckbox = document.getElementById('improveOtherCheckbox');
    const improveOtherText = document.getElementById('improveOtherText');
    const allImproveCheckboxes = document.querySelectorAll('input[name="improve"]');

    improveNone.addEventListener('change', (e) => {
        if (e.target.checked) {
            // Uncheck and disable others
            allImproveCheckboxes.forEach(cb => {
                if (cb !== improveNone) {
                    cb.checked = false;
                    cb.disabled = true;
                }
            });
            improveOtherText.value = '';
            improveOtherText.disabled = true;
        } else {
            // Enable others
            allImproveCheckboxes.forEach(cb => {
                cb.disabled = false;
            });
        }
    });

    improveOtherCheckbox.addEventListener('change', (e) => {
        improveOtherText.disabled = !e.target.checked;
        if (e.target.checked) {
            improveOtherText.focus();
        } else {
            improveOtherText.value = '';
        }
    });

    // Prevent clicking the text input from toggling the label's checkbox
    improveOtherText.addEventListener('click', (e) => {
        e.stopPropagation();
    });




    // 4.5 Step Navigation
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const btnNext = document.getElementById('btn-next');
    const btnBack = document.getElementById('btn-back');
    const dot1 = document.getElementById('dot1');
    const dot2 = document.getElementById('dot2');
    const stepText = document.getElementById('step-text');
    const stepProgress = document.getElementById('step-progress');

    if (btnNext && btnBack) {
        btnNext.addEventListener('click', () => {
            // Validate ratings before going to step 2
            if (ratings.q1 === 0 || ratings.q2 === 0 || ratings.q3 === 0 || ratings.q4 === 0) {
                showToast('กรุณาให้คะแนนความพึงพอใจให้ครบทุกข้อ', 'error');
                return;
            }
            step1.classList.add('hidden');
            step2.classList.remove('hidden');
            dot1.classList.remove('active');
            dot2.classList.add('active');
            stepText.textContent = 'ขั้นตอนที่ 2 จาก 2: ข้อมูลติดต่อ';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        btnBack.addEventListener('click', () => {
            step2.classList.add('hidden');
            step1.classList.remove('hidden');
            dot2.classList.remove('active');
            dot1.classList.add('active');
            stepText.textContent = 'ขั้นตอนที่ 1 จาก 2: การประเมิน';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // 5. Submit Form
    const btnSubmit = document.getElementById('btn-submit');
    let isSubmitting = false; // Guard against double-submit (prevents 429 rate-limit)
    
    btnSubmit.addEventListener('click', async () => {
        if (isSubmitting) return; // Block if already in progress
        const pdpaRadio = document.querySelector('input[name="pdpa"]:checked');
        if (!pdpaRadio) {
            showToast('กรุณาเลือกให้ความยินยอมหรือไม่ยินยอมในข้อมูลส่วนบุคคล', 'error');
            return;
        }

        // Collect Improvement Data
        const improvementsList = [];
        let improvementsOtherText = '';
        
        allImproveCheckboxes.forEach(cb => {
            if (cb.checked) {
                if (cb.value === 'อื่นๆ') {
                    improvementsOtherText = improveOtherText.value.trim();
                } else {
                    improvementsList.push(cb.value);
                }
            }
        });

        const consentGiven = pdpaRadio.value === 'ยินยอม';

        // Backend expects specific field names
        const payload = {
            session_id: '', // Not strictly needed, or we could pass local storage session id
            employee_id: empId,
            employee_name: empName,
            project_name: project || '-',
            customer_name: customer || '-',
            pdpa_consent_1: pdpaRadio.value,
            score_q1: ratings.q1,
            score_q2: ratings.q2,
            score_q3: ratings.q3,
            score_q4: ratings.q4,
            improvements: improvementsList.join(', '),
            improvements_other: improvementsOtherText,
            contact_name: consentGiven ? document.getElementById('contactName').value.trim() : '',
            contact_phone: consentGiven ? document.getElementById('contactPhone').value.trim() : '',
            contact_email: consentGiven ? document.getElementById('contactEmail').value.trim() : '',
            pdpa_consent_2: pdpaRadio.value
        };

        // Submit logic
        isSubmitting = true;
        const originalText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center;">
                <svg viewBox="0 0 50 50" style="width: 20px; height: 20px; animation: spin 1s linear infinite; margin-right: 8px;">
                    <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" style="opacity: 0.25;"></circle>
                    <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-dasharray="31.4 125.6" style="opacity: 1;"></circle>
                </svg>
                กำลังส่งข้อมูล...
            </div>
        `;
        btnSubmit.disabled = true;

        try {
            const response = await fetch('/api/survey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = new Error('Network response was not ok');
                err.status = response.status;
                throw err;
            }

            // Show Success button state first
            btnSubmit.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    เสร็จสิ้น
                </div>
            `;
            const originalBg = btnSubmit.style.background;
            btnSubmit.style.background = '#10B981'; // Success Green
            
            // Wait a moment for the user to see the "Done" state on the button
            await new Promise(resolve => setTimeout(resolve, 800));

            // Show Success Screen
            surveyCard.classList.add('hidden');
            successCard.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error) {
            console.error('Error submitting survey:', error);
            isSubmitting = false; // Allow retry on real errors
            if (error.status === 429) {
                showToast('ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่', 'error');
            } else {
                showToast('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', 'error');
            }
            btnSubmit.innerHTML = originalText;
            btnSubmit.style.background = '';
            btnSubmit.disabled = false;
        }
    });

    // Toast utility
    const toast = document.getElementById('toast');
    function showToast(message, type = 'error') {
        toast.textContent = message;
        toast.className = `toast-container show ${type}`;
        setTimeout(() => {
            toast.className = 'toast-container';
        }, 3000);
    }
});
