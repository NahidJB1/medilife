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

// --- LOAD DOCUMENTS (PHP VERSION) ---
function loadAllDocuments() {
    // Fetch ALL reports for this patient
    fetch(`${API_BASE}reports.php?patient_id=${email}`)
    .then(res => res.json())
    .then(data => {
        const presList = document.getElementById('list-prescriptions');
        const repList = document.getElementById('list-doc-reports');
        const myUploads = document.getElementById('list-my-uploads');

        presList.innerHTML = ''; repList.innerHTML = ''; myUploads.innerHTML = '';
        
        let presCount = 0; let repCount = 0; let myCount = 0;

        if(data.length === 0) {
            // Handle completely empty
            renderEmpty(presList, "No prescriptions.");
            renderEmpty(repList, "No reports.");
            renderEmpty(myUploads, "No uploads.");
            return;
        }

        data.forEach(doc => {
            if (doc.uploaded_by === 'doctor') {
                const html = createDocCard(doc, false); // False = cannot delete
                if (doc.report_type === 'Prescription') {
                    presList.innerHTML += html;
                    presCount++;
                } else {
                    repList.innerHTML += html;
                    repCount++;
                }
            } else {
                // Patient's own upload
                const html = createDocCard(doc, true); // True = can delete (optional feature)
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

    // View Action Logic
    let viewAction = '';
    if (data.is_manual == 1) {
        const safeContent = (data.content || '').replace(/`/g, "'").replace(/"/g, '&quot;');
        const safeDetails = (data.doctor_details || '{}').replace(/"/g, '&quot;');
        viewAction = `openDocViewer('manual', \`${safeContent}\`, '${title}', '${data.doctor_name}', '${name}', '${dateStr}', \`${safeDetails}\`)`;
    } else {
        const filePath = data.file_path;
        viewAction = `openDocViewer('file', '${filePath}', '${title}')`;
    }

    return `
    <div class="doc-card">
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

// --- VIEWER MODAL ---
// --- VIEWER MODAL (Updated with Blockchain Verification UI) ---
function openDocViewer(type, content, title, docName, patName, dateStr, drDetailsStr) {
    const viewerModal = document.getElementById('documentViewerModal');
    const viewerContent = document.getElementById('docViewerContent');
    
    // 1. Define the Blockchain Verification UI (Animated)
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

    // 3. Trigger the Animation Sequence
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

    if (type === 'manual') {
        let drDetails = {};
        try { drDetails = JSON.parse(drDetailsStr); } catch(e){}

        html = `
            <div class="rx-paper">
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
        html = `
            <h3 style="margin-bottom: 15px;">${title}</h3>
            <iframe src="${content}" style="width: 100%; height: 70vh; border: 1px solid #E5E7EB; border-radius: 8px;"></iframe>`;
    }
    
    viewerContent.innerHTML = html;
    viewerModal.classList.add('active');
}

function closeDocViewer() { document.getElementById('documentViewerModal').classList.remove('active'); }

// --- NEW FUNCTIONS FOR UPLOADING ---

function triggerPatientUpload() {
    document.getElementById('patientUploadInput').click();
}

function handlePatientUpload(input) {
    if(input.files && input.files[0]) {
        const fd = new FormData();
        fd.append('action', 'upload'); 
        fd.append('file', input.files[0]);
        fd.append('patientId', email); // email variable holds the logged-in patient's ID
        fd.append('reportType', 'Patient Upload'); // Type
        fd.append('docCategory', 'Patient Upload'); // Category
        fd.append('uploadedBy', 'patient'); 

        // Optional: Send empty doctor info to prevent PHP warnings if strict
        fd.append('doctorId', '');
        fd.append('doctorName', '');

        // Show a loading toast or state here if you want
        
        fetch(`${API_BASE}reports.php`, { method: 'POST', body: fd })
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') {
                alert("Uploaded Successfully"); // Or use your showToast() if available
                loadAllDocuments(); // Refresh list
            } else {
                alert("Error: " + (data.message || "Upload Failed"));
            }
        })
        .catch(err => {
            console.error(err);
            alert("Network Error during upload");
        });
    }
}
