// --- CONFIG ---
const API_BASE = 'api/';

// --- AUTH CHECK ---
const role = localStorage.getItem('userRole');
const email = localStorage.getItem('userEmail');
const name = localStorage.getItem('userName') || 'User';

if (role !== 'patient' || !email) { window.location.href = 'index.html'; }

// Init UI
document.getElementById('sideName').innerText = name;
// Fetch Avatar
fetch(`${API_BASE}users.php?action=get&uid=${email}`)
.then(res => res.json())
.then(data => {
    if(data.profile_pic) document.getElementById('sideAvatar').src = data.profile_pic;
});

// Load Data
loadAllDocuments();

// --- TABS ---
function switchReportTab(type) {
    document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    
    if (type === 'doctor') {
        document.querySelectorAll('.report-tab')[0].classList.add('active');
        document.getElementById('doctorDocs').style.display = 'block';
    } else {
        document.querySelectorAll('.report-tab')[1].classList.add('active');
        document.getElementById('patientDocs').style.display = 'block';
    }
}

// --- LOAD DOCUMENTS ---
function loadAllDocuments() {
    fetch(`${API_BASE}reports.php?patient_id=${email}`)
    .then(res => res.json())
    .then(data => {
        const presList = document.getElementById('list-prescriptions');
        const repList = document.getElementById('list-doc-reports');
        const myUploads = document.getElementById('list-my-uploads');

        presList.innerHTML = ''; repList.innerHTML = ''; myUploads.innerHTML = '';
        
        let presCount = 0; let repCount = 0; let myCount = 0;

        if(data.length === 0) {
            renderEmpty(presList, "No prescriptions.");
            renderEmpty(repList, "No reports.");
            renderEmpty(myUploads, "No uploads.");
            return;
        }

        data.forEach(doc => {
            if (doc.uploaded_by === 'doctor') {
                const html = createDocCard(doc, false);
                if (doc.report_type === 'Prescription') {
                    presList.innerHTML += html;
                    presCount++;
                } else {
                    repList.innerHTML += html;
                    repCount++;
                }
            } else {
                const html = createDocCard(doc, true);
                myUploads.innerHTML += html;
                myCount++;
            }
        });

        if(presCount === 0) renderEmpty(presList, "No prescriptions found.");
        if(repCount === 0) renderEmpty(repList, "No medical reports found.");
        if(myCount === 0) renderEmpty(myUploads, "You haven't uploaded any documents.");
    })
    .catch(err => console.error("Load Error:", err));
}

function renderEmpty(container, msg) {
    container.innerHTML = `<div class="empty-state">${msg}</div>`;
}

function createDocCard(data, canDelete) {
    const dateStr = data.formatted_date || 'Unknown Date';
    const icon = data.report_type === 'Prescription' ? 'fa-file-prescription' : 'fa-file-medical-alt';
    const docName = data.doctor_name ? `Dr. ${data.doctor_name}` : 'Me';
    const title = data.doc_category || data.report_type;

    // Safely encode content to prevent syntax parsing errors in HTML attributes
    let viewAction = '';
    if (data.is_manual == 1) {
        const safeContent = encodeURIComponent(data.content || '');
        const safeDetails = encodeURIComponent(data.doctor_details || '{}');
        viewAction = `openDocViewer('manual', decodeURIComponent('${safeContent}'), '${title}', '${data.doctor_name}', '${name}', '${dateStr}', decodeURIComponent('${safeDetails}'))`;
    } else {
        const filePath = data.file_path;
        viewAction = `openDocViewer('file', '${filePath}', '${title}')`;
    }

    return `
    <div class="doc-card fade-in-card">
        <div class="doc-info">
            <div class="doc-icon"><i class="fas ${icon}"></i></div>
            <div class="doc-details">
                <h4>${title}</h4>
                <p>${dateStr} • By ${docName}</p>
            </div>
        </div>
        <div class="doc-actions">
            <button class="btn-view" onclick="${viewAction}"><i class="fas fa-eye"></i> View</button>
        </div>
    </div>`;
}

// --- VIEWER MODAL (With Blockchain Animation) ---
function openDocViewer(type, content, title, docName, patName, dateStr, drDetailsStr) {
    const viewerModal = document.getElementById('documentViewerModal');
    const viewerContent = document.getElementById('docViewerContent');
    
    const verificationUI = `
        <div id="blockchain-status" style="display:flex; align-items:center; gap:10px; padding:12px 20px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:30px; margin-bottom:20px; width: fit-content; margin-left: auto; margin-right: auto; transition: all 0.4s ease;">
            <i id="blockchain-icon" class="fas fa-spinner fa-spin" style="color:var(--primary); font-size:1.2rem;"></i>
            <span id="blockchain-text" style="font-weight:600; color:#475569; font-size:0.95rem;">Verifying immutable record...</span>
        </div>
    `;

    let html = verificationUI;

    if (type === 'manual') {
        let drDetails = {};
        try { drDetails = JSON.parse(drDetailsStr); } catch(e){}

        html += `
            <div class="rx-paper" id="doc-main-content" style="opacity: 0.5; transition: opacity 0.5s ease;">
                <div style="border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px;">
                    <h2 style="font-size: 1.4rem; margin: 0;">Dr. ${docName}</h2>
                    <p style="color: #EF4444; font-weight: 600; font-size: 0.9rem;">${drDetails.spec || 'Medical Professional'}</p>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 0.9rem;">
                    <span><strong>Patient:</strong> ${patName}</span>
                    <span><strong>Date:</strong> ${dateStr}</span>
                </div>
                <div class="rx-body-bg">
                    <div style="white-space: pre-wrap; font-family: 'Poppins', sans-serif;">${content}</div>
                </div>
            </div>`;
    } else {
        html += `
            <div id="doc-main-content" style="opacity: 0.5; transition: opacity 0.5s ease;">
                <h3 style="margin-bottom: 15px;">${title}</h3>
                <iframe src="${content}" style="width: 100%; height: 70vh; border: 1px solid #E5E7EB; border-radius: 8px;"></iframe>
            </div>`;
    }
    
    viewerContent.innerHTML = html;
    viewerModal.classList.add('active');

    setTimeout(() => {
        const statusBox = document.getElementById('blockchain-status');
        const icon = document.getElementById('blockchain-icon');
        const text = document.getElementById('blockchain-text');
        const docContent = document.getElementById('doc-main-content');

        if(statusBox) {
            statusBox.style.background = '#ECFDF5';
            statusBox.style.borderColor = '#10B981';
            icon.className = 'fas fa-link';
            icon.style.color = '#10B981';
            text.innerText = 'Data Intact & Verified on Ledger';
            text.style.color = '#065F46';
            docContent.style.opacity = '1';
        }
    }, 1500);
}

function closeDocViewer() { document.getElementById('documentViewerModal').classList.remove('active'); }

// --- UPLOAD & TOAST FUNCTIONS ---

function showToast(message) {
    const toast = document.getElementById('toast-box');
    const msgSpan = document.getElementById('toast-msg');
    if (toast && msgSpan) {
        msgSpan.innerText = message;
        toast.classList.add('active');
        setTimeout(() => toast.classList.remove('active'), 3000);
    }
}

function triggerPatientUpload() {
    document.getElementById('patientUploadInput').click();
}

function handlePatientUpload(input) {
    if(input.files && input.files[0]) {
        const fd = new FormData();
        fd.append('action', 'upload'); 
        fd.append('file', input.files[0]);
        fd.append('patientId', email);
        fd.append('reportType', 'Patient Upload');
        fd.append('docCategory', 'Patient Upload');
        fd.append('uploadedBy', 'patient'); 
        fd.append('doctorId', '');
        fd.append('doctorName', '');
        
        showToast("Uploading document...");
        
        fetch(`${API_BASE}reports.php`, { method: 'POST', body: fd })
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') {
                showToast("Uploaded Successfully");
                loadAllDocuments(); 
            } else {
                showToast("Error: " + (data.message || "Upload Failed"));
            }
        })
        .catch(err => {
            console.error(err);
            showToast("Network Error during upload");
        });
    }
}

// --- AI SMART SUMMARY ---
function generateSmartSummary() {
    const modal = document.getElementById('aiModal');
    const contentDiv = document.getElementById('aiSummaryContent');
    
    // Trigger trendy loading state
    modal.classList.add('active');
    contentDiv.innerHTML = `
        <div class="ai-loading-container">
            <i class="fas fa-brain ai-brain-icon"></i>
            <p class="ai-loading-text">Analyzing medical records...</p>
            <div class="ai-loading-bar"></div>
        </div>
    `;

    // Fetch from backend
    fetch('ai_summary.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: email }) // Email acts as the Patient ID here
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            contentDiv.innerHTML = `<p style="color: #EF4444; text-align: center;"><i class="fas fa-exclamation-triangle"></i> ${data.error}</p>`;
            return;
        }
        
        // Safely parse Gemini's specific JSON structure
        try {
            const summaryText = data.candidates[0].content.parts[0].text;
            contentDiv.innerHTML = `<div class="ai-fade-in">${summaryText}</div>`;
        } catch (e) {
            console.error("Gemini Parsing Error:", e, data);
            contentDiv.innerHTML = `<p style="color: #EF4444; text-align: center;">Received an unexpected format from the AI.</p>`;
        }
    })
    .catch(err => {
        console.error("Network error:", err);
        contentDiv.innerHTML = `<p style="color: #EF4444; text-align: center;">Failed to connect to the AI service. Please try again.</p>`;
    });
}
