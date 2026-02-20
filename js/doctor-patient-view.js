// --- CONFIG ---
const API_BASE = 'api/';

// --- GET PARAMS & USER ---
const urlParams = new URLSearchParams(window.location.search);
const patientId = urlParams.get('pid');
const patientNameParam = urlParams.get('name') || 'Patient';

// Check Doctor Auth
const role = localStorage.getItem('userRole');
const docEmail = localStorage.getItem('userEmail');
const docName = localStorage.getItem('userName') || 'Dr. User';

if (role !== 'doctor' || !docEmail) { window.location.href = 'index.html'; }

// Setup UI
document.getElementById('sideName').innerText = docName;
document.getElementById('headerPatientName').innerText = patientNameParam;
document.getElementById('headerDate').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

// Fetch Side Avatar
fetch(`${API_BASE}users.php?action=get&uid=${docEmail}`)
.then(res => res.json())
.then(data => {
    if(data.profile_pic) document.getElementById('sideAvatar').src = data.profile_pic;
});

const currentUserData = { uid: docEmail, name: docName, role: 'doctor' };

// --- GLOBAL VARIABLES FOR STATE ---
let currentViewingPatient = { id: patientId, name: patientNameParam };
let tempDoctorDetails = {}; 

// --- INITIALIZE PROFILE ---
if(!patientId) {
    document.getElementById('mainProfileContainer').innerHTML = `<p style="text-align:center; color:red;">Error: No Patient ID provided.</p>`;
} else {
    loadPatientProfile();
}

function loadPatientProfile() {
    // We need 3 things: Doctor Info, Patient Info, and Appointment/Access Status
    Promise.all([
        fetch(`${API_BASE}users.php?action=get&uid=${currentUserData.uid}`).then(r => r.json()), // Doctor
        fetch(`${API_BASE}users.php?action=get&uid=${patientId}`).then(r => r.json()),         // Patient
        fetch(`${API_BASE}appointments.php?doctor_id=${currentUserData.uid}&patient_id=${patientId}`).then(r => r.json()) // Appointments
    ]).then(([docInfo, patInfo, aptList]) => {
        
        // Handle Empty Patient Data (if user doesn't exist in DB yet)
        const patientData = patInfo.error ? { name: patientNameParam } : patInfo;

        // Update Name
        currentViewingPatient.name = patientData.name;
        document.getElementById('headerPatientName').innerText = patientData.name;

        // LOGIC: Check Access
        let hasAccess = false;
        let appointmentExists = aptList.length > 0;
        let accessRequestPending = false;
        let relevantAptId = null;

        if(appointmentExists) {
            // Check if ANY appointment allows sharing
            aptList.forEach(apt => {
                if (!relevantAptId || apt.status === 'accepted') relevantAptId = apt.id;
                // PHP sends 'share_documents' as boolean or 1/0
                if (apt.share_documents == 1 || apt.share_documents === true) hasAccess = true;
                if (apt.access_request === 'pending') accessRequestPending = true;
            });
        }

        renderProfileUI(hasAccess, appointmentExists, accessRequestPending, relevantAptId, docInfo, patientData);
    })
    .catch(err => {
        console.error("Profile Load Error:", err);
        document.getElementById('mainProfileContainer').innerHTML = `<p style="text-align:center;">Failed to load profile. <br><small>${err}</small></p>`;
    });
}

function renderProfileUI(hasAccess, appointmentExists, accessRequestPending, aptId, docInfo, patInfo) {
    const container = document.getElementById('mainProfileContainer');
    
    // 1. Patient Header Info
    let html = `
        <div style="display:flex; align-items:center; gap:20px; margin-bottom:30px; padding-bottom:20px; border-bottom:1px solid #E5E7EB;">
            <img src="${patInfo.profile_pic || 'https://via.placeholder.com/80'}" style="width:80px; height:80px; border-radius:50%; object-fit:cover; border:3px solid var(--secondary);">
            <div>
                <h1 style="font-size:1.8rem; margin:0; line-height:1.2;">${patInfo.name}</h1>
                <p style="color:var(--gray); font-size:1rem; margin-top:5px;">
                    ${patInfo.gender || 'N/A'} • ${patInfo.age ? patInfo.age + ' Yrs' : 'Age N/A'}
                    <span style="margin:0 10px; color:#E5E7EB;">|</span>
                    <span style="color:var(--primary); font-weight:600;"><i class="fas fa-tint"></i> ${patInfo.blood_group || 'N/A'}</span>
                </p>
                <p style="color:var(--gray); font-size:0.9rem;">${patInfo.email || ''}</p>
            </div>
        </div>`;

    // 2. Logic Switch
    if (hasAccess) {
        // --- UNLOCKED VIEW ---
        const docObjRaw = {
            name: docInfo.name || currentUserData.name,
            spec: docInfo.specialist || 'Medical Professional',
            deg: docInfo.degrees || '',
            addr: docInfo.chamber_address || 'Address not available',
            time: docInfo.schedule || '',
            phone: docInfo.phone || '',
            email: docInfo.email || ''
        };
        // Safe Stringify
        const drDetailsObj = JSON.stringify(docObjRaw).replace(/"/g, '&quot;');

        html += `
            <div class="modal-tabs">
                <div class="m-tab-item active" onclick="switchTab('presc')"><i class="fas fa-prescription"></i> Prescriptions</div>
                <div class="m-tab-item" onclick="switchTab('reports')"><i class="fas fa-file-medical-alt"></i> Reports & Labs</div>
                <div class="m-tab-item" onclick="switchTab('patient-uploads')"><i class="fas fa-file-upload"></i> Patient Uploads</div>
            </div>

            <div id="tab-presc" class="tab-content">
                <div style="display:flex; gap:10px; margin-bottom:20px;">
                    <button class="list-btn btn-book" style="padding:12px 20px; font-size:1rem;" 
                        onclick="renderWritePrescription('${patInfo.name}', '${patInfo.gender||''}', '${patInfo.age||''}', ${drDetailsObj})">
                        <i class="fas fa-pen"></i> Write New Prescription
                    </button>
                    <button class="list-btn" style="background:white; border:1px solid #E5E7EB; padding:12px 20px; font-size:1rem;" 
                        onclick="triggerUpload('Prescription')">
                        <i class="fas fa-upload"></i> Upload Rx File
                    </button>
                </div>
                <div id="prescHistoryList">Loading...</div>
            </div>

            <div id="tab-reports" class="tab-content" style="display:none;">
                <div style="background:#F9FAFB; padding:20px; border-radius:12px; border:1px solid #E5E7EB; margin-bottom:20px; display:flex; gap:15px; align-items:flex-end;">
                    <div style="flex:1;">
                        <label style="font-size:0.85rem; font-weight:600; color:var(--gray); display:block; margin-bottom:5px;">Document Type</label>
                        <select id="reportCategorySelect" class="rx-input" style="min-height:auto; height:45px; margin:0; background:white;">
                            <option value="General Report">General Lab Report</option>
                            <option value="Blood Test">Blood Test</option>
                            <option value="X-Ray">X-Ray</option>
                            <option value="ECG">ECG</option>
                            <option value="MRI">MRI</option>
                            <option value="CT Scan">CT Scan</option>
                            <option value="Ultrasound">Ultrasound</option>
                            <option value="Discharge Summary">Discharge Summary</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <button class="list-btn btn-view" style="height:45px; padding:0 25px;" onclick="triggerUpload('Report')">
                        <i class="fas fa-cloud-upload-alt"></i> Upload
                    </button>
                </div>
                <div id="reportHistoryList">Loading reports...</div>
            </div>

            <div id="tab-patient-uploads" class="tab-content" style="display:none;">
                <div class="doc-category-title" style="margin-bottom:15px; font-weight:600;">Patient's Personal Uploads</div>
                <div id="patientUploadsList">Loading...</div>
            </div>
        `;
        
        container.innerHTML = html;

        // Load Lists via PHP API
        loadPatientHistory('Prescription', 'prescHistoryList', docObjRaw, 'doctor');
        loadPatientHistory('Report', 'reportHistoryList', docObjRaw, 'doctor');
        loadPatientHistory('All', 'patientUploadsList', docObjRaw, 'patient');

    } else {
        // --- LOCKED VIEW (Same as before) ---
        let lockMsg = '';
        let actionButton = '';

        if (!appointmentExists) {
            lockMsg = 'No confirmed appointment found with this patient.';
            actionButton = `<span style="color:#EF4444; background:#FEF2F2; padding:10px 20px; border-radius:8px; border:1px solid #FCA5A5;">
                <i class="fas fa-exclamation-triangle"></i> Booking Required
            </span>`;
        } else {
            lockMsg = 'Patient has restricted document access.';
            if (accessRequestPending) {
                actionButton = `<button class="list-btn" disabled style="background:#F59E0B; color:white; padding:12px 25px; font-size:1rem;">
                    <i class="fas fa-clock"></i> Access Request Pending
                </button>`;
            } else {
                actionButton = `<button class="list-btn btn-book" onclick="requestDocAccess('${aptId}')" style="padding:12px 25px; font-size:1rem;">
                    Request Access
                </button>`;
            }
        }

        html += `
            <div class="access-denied-box">
                <i class="fas fa-lock" style="font-size:4rem; color:#D1D5DB; margin-bottom:20px;"></i>
                <h2 style="color:#374151; margin-bottom:10px;">Profile Locked</h2>
                <p style="color:#6B7280; margin-bottom:25px; font-size:1.1rem;">${lockMsg}</p>
                ${actionButton}
            </div>
        `;
        container.innerHTML = html;
    }
}

function switchTab(tab) {
    document.querySelectorAll('.m-tab-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    
    // Set active tab styling
    const tabs = document.querySelectorAll('.m-tab-item');
    if(tab === 'presc') {
        tabs[0].classList.add('active');
        document.getElementById('tab-presc').style.display = 'block';
    } else if(tab === 'reports') {
        tabs[1].classList.add('active');
        document.getElementById('tab-reports').style.display = 'block';
    } else {
        tabs[2].classList.add('active');
        document.getElementById('tab-patient-uploads').style.display = 'block';
    }
}

// --- HISTORY LIST LOADER (PHP VERSION) ---
// --- LOAD HISTORY (Corrected for PHP API) ---
function loadPatientHistory(typeFilter, containerId, fallbackDrDetails, uploadedByFilter) {
    const container = document.getElementById(containerId);
    container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--gray);"><i class="fas fa-spinner fa-spin"></i> Fetching records...</div>';
    
    // Construct URL based on filters
    let url = `${API_BASE}reports.php?action=get&patient_id=${currentViewingPatient.id}`;
    
    // PHP expects 'type' or 'uploader' params
    if (typeFilter !== 'All') url += `&type=${typeFilter}`;
    if (uploadedByFilter) url += `&uploader=${uploadedByFilter}`;

    fetch(url)
    .then(res => res.json())
    .then(data => {
        container.innerHTML = '';
        if(!data || data.length === 0) { 
            container.innerHTML = `<div class="empty-state" style="padding:40px; text-align:center; color:var(--gray); border:1px dashed #E5E7EB; border-radius:12px;">No records found.</div>`; 
            return; 
        }
        
        data.forEach(d => {
            // Handle Dates (PHP sends 'formatted_date' or 'timestamp')
            const date = d.formatted_date || (d.timestamp ? new Date(d.timestamp).toLocaleDateString() : 'N/A');
            const displayTitle = d.doc_category || d.report_type;
            const docName = d.doctor_name || fallbackDrDetails.name || 'Professional';
            const icon = d.report_type === 'Prescription' ? 'fa-file-prescription' : 'fa-file-medical-alt';

            // Parse stored JSON doctor details if available
            let storedDocDetails = fallbackDrDetails;
            try { if(d.doctor_details) storedDocDetails = JSON.parse(d.doctor_details); } catch(e){}

            let viewAction = '';
            if(d.is_manual == 1) {
                // Manual Prescription
                const safeContent = (d.content || "").replace(/`/g, "'").replace(/\$/g, "").replace(/\\/g, "\\\\").replace(/"/g, '&quot;');
                const drDetailsStr = JSON.stringify(storedDocDetails).replace(/"/g, '&quot;');
                viewAction = `openDocViewer('manual', \`${safeContent}\`, '${displayTitle}', '${docName}', '${currentViewingPatient.name}', '${date}', \`${drDetailsStr}\`)`;
            } else {
                // File Upload
                viewAction = `openDocViewer('file', '${d.file_path}', '${displayTitle}', '${docName}', '${currentViewingPatient.name}', '${date}', '')`;
            }


            container.innerHTML += `
                <div class="list-item" style="display:flex; justify-content:space-between; align-items:center; padding:15px; background:white; border:1px solid #E5E7EB; border-radius:12px; margin-bottom:10px;">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <div style="background:#F3F4F6; width:45px; height:45px; border-radius:10px; display:flex; align-items:center; justify-content:center; color:var(--primary);">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div>
                            <div style="font-weight:600; color:var(--dark);">${displayTitle}</div>
                            <div style="font-size:0.8rem; color:var(--gray);">${date} • ${d.uploaded_by === 'doctor' ? 'Dr. ' + docName : 'Patient Upload'}</div>
                        </div>
                    </div>
                    <button class="list-btn btn-view" onclick="${viewAction}">View</button>
                </div>`;
        });
    })
    .catch(err => {
        console.error(err);
        container.innerHTML = "Error loading records.";
    });
}

// --- WRITE PRESCRIPTION UI (Keep logic, use PHP save) ---
function renderWritePrescription(pName, pGen, pAge, docDetails) {
    tempDoctorDetails = { ...docDetails, pAge: pAge || 'N/A', pGender: pGen || 'N/A' };
    
    let displayTime = docDetails.time || 'Not set';
    if(displayTime.includes('|')) displayTime = displayTime.split('|').map(t => t.trim()).join('<br>');

    // ... (HTML Generation same as before, no changes needed to HTML string) ...
    // Copying the previous HTML generation logic briefly:
    const headerHtml = `
        <div class="rx-header" style="border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 15px; display: flex; flex-wrap: wrap; gap: 20px; justify-content: space-between;">
            <div style="flex: 1; min-width: 200px; text-align: left;">
                <div style="display:flex; align-items:center; gap:5px; margin-bottom:10px;">
                        <svg width="24" height="24" viewBox="0 0 100 100"><rect x="35" y="10" width="30" height="80" rx="5" fill="#EF4444" /><rect x="10" y="35" width="80" height="30" rx="5" fill="#EF4444" /></svg>
                        <div style="font-weight:700; font-size:16px; line-height:1;"><span style="color:#EF4444;">MED</span><span style="color:#000;">e</span><span style="color:#22C55E;">LIFE</span></div>
                </div>
                <h3 style="font-size: 1.2rem;">Dr. ${docDetails.name}</h3>
                <p style="color: var(--primary); font-weight: 600;">${docDetails.spec}</p>
                <p style="color: var(--gray); font-size: 0.85rem;">${docDetails.deg}</p>
            </div>
            <div style="text-align: right; min-width: 200px; font-size: 0.85rem; color: #374151;">
                <p><strong>Chamber:</strong><br>${docDetails.addr}</p>
                <p><strong>Contact:</strong><br>${docDetails.phone || ''}<br>${docDetails.email || ''}</p>
            </div>
        </div>
        <div class="rx-meta">
            <span><strong>Pt:</strong> ${pName}</span>
            <span><strong>Age/Gen:</strong> ${pAge} / ${pGen}</span>
            <span><strong>Date:</strong> ${new Date().toLocaleDateString()}</span>
        </div>`;

    document.getElementById('tab-presc').innerHTML = `
        <div class="rx-paper">
            ${headerHtml}
            <textarea id="rxBody" class="rx-input" placeholder="Rx: \n\n1. Medicine Name - Dosage - Duration..."></textarea>
            <div style="margin-top:20px; text-align:right;">
                <button class="list-btn" style="background:var(--gray); color:white; margin-right:10px;" onclick="loadPatientProfile()">Cancel</button>
                <button class="list-btn btn-book" onclick="saveWrittenPrescription()">Save Prescription</button>
            </div>
        </div>`;
}

function saveWrittenPrescription() {
    const content = document.getElementById('rxBody').value;
    if(!content) { showToast("Prescription is empty"); return; }
    
    const fd = new FormData();
    fd.append('action', 'manual');
    fd.append('patientId', currentViewingPatient.id);
    fd.append('doctorId', currentUserData.uid);
    fd.append('doctorName', currentUserData.name);
    fd.append('content', content);
    fd.append('doctorDetails', JSON.stringify(tempDoctorDetails));

    fetch(`${API_BASE}reports.php`, { method: 'POST', body: fd })
    .then(res => res.json())
    .then(data => {
        if(data.status === 'success') {
            showToast("Prescription Saved");
            loadPatientProfile(); 
        } else {
            showToast("Error saving");
        }
    });
}

// --- UPLOAD LOGIC ---
function triggerUpload(type) {
    document.getElementById('uploadType').value = type;
    document.getElementById('docUploadInput').click();
}

// --- UPLOAD FUNCTION (Corrected for PHP API) ---
function handleDocUpload(input) {
    const type = document.getElementById('uploadType').value;
    let category = type;
    
    // If it's a Report, get the specific category from dropdown
    if (type === 'Report') {
        const selector = document.getElementById('reportCategorySelect');
        if(selector) category = selector.value;
    }

    if(input.files && input.files[0]) {
        const fd = new FormData();
        fd.append('action', 'upload'); 
        fd.append('file', input.files[0]);
        fd.append('patientId', currentViewingPatient.id);
        fd.append('doctorId', currentUserData.uid);
        fd.append('doctorName', currentUserData.name);
        fd.append('reportType', type);
        fd.append('docCategory', category);
        fd.append('uploadedBy', 'doctor'); 

        fetch(`${API_BASE}reports.php`, { method: 'POST', body: fd })
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') {
                showToast("Uploaded Successfully");
                loadPatientProfile(); // Refresh lists to show new file
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

// --- ACCESS REQUEST ---
function requestDocAccess(aptId) {
    const fd = new FormData();
    fd.append('action', 'request_access');
    fd.append('id', aptId);

    fetch(`${API_BASE}appointments.php`, { method: 'POST', body: fd })
    .then(() => { showToast("Request sent"); loadPatientProfile(); });
}

// --- DOCUMENT VIEWER (Same as before) ---
function openDocViewer(type, content, title, docName, patName, dateStr, drDetails) {
    const viewerModal = document.getElementById('documentViewerModal');
    const viewerContent = document.getElementById('docViewerContent');
    let html = '';
    
    if (type === 'manual') {
        let dTime = drDetails.time || '';
        if(dTime.includes('|')) dTime = dTime.split('|').map(t => t.trim()).join('<br>');

        html = `
            <div class="rx-paper" style="border: none; box-shadow: none; padding: 10px; margin: 0 auto; background: white;">
                <div style="display: flex; flex-wrap: wrap; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px;">
                    <div style="flex: 1; min-width: 250px; margin-bottom: 15px;">
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:15px;">
                                <svg width="24" height="24" viewBox="0 0 100 100"><rect x="35" y="10" width="30" height="80" rx="5" fill="#EF4444" /><rect x="10" y="35" width="80" height="30" rx="5" fill="#EF4444" /></svg>
                                <div style="font-family: 'Poppins', sans-serif; font-size: 18px; font-weight: 700; line-height: 1;"><span style="color: #EF4444;">MED</span><span style="color: #000;">e</span><span style="color: #22C55E;">LIFE</span></div>
                            </div>
                            <h2 style="font-size: 1.6rem; margin: 0; color: #111;">Dr. ${docName}</h2>
                            <p style="color: #EF4444; font-weight: 600; font-size: 0.95rem; margin-top: 2px;">${drDetails.spec || ''}</p>
                            <p style="color: #6B7280; font-size: 0.85rem;">${drDetails.deg || ''}</p>
                    </div>
                    <div style="text-align: right; min-width: 200px; font-size: 0.85rem; color: #374151;">
                            <p style="margin-bottom: 8px;"><strong>Chamber:</strong><br>${drDetails.addr || ''}</p>
                            ${dTime ? `<p style="margin-bottom: 8px;"><strong>Schedule:</strong><br>${dTime}</p>` : ''}
                            <p style="margin-top: 8px;"><strong>Contact:</strong><br>${drDetails.phone || ''}<br>${drDetails.email || ''}</p>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #E5E7EB; padding-bottom: 15px; margin-bottom: 25px; font-size: 0.95rem; color: #374151;">
                    <div><span style="font-weight: 700; color: #111;">Patient: ${patName}</span><br>
                        ${drDetails.pAge ? `<span style="font-size: 0.9rem; color: #4B5563;">Age: ${drDetails.pAge} • Gender: ${drDetails.pGender||'N/A'}</span>` : ''} 
                    </div>
                    <div style="text-align: right;"><span style="font-weight: 700;">Date: ${dateStr}</span></div>
                </div>

                <div class="rx-body-bg" style="background: #FAFAFA; padding: 30px; border-radius: 8px; border: 1px dashed #E5E7EB; min-height: 400px; position: relative;">
                    <span style="font-family: 'Times New Roman', serif; font-style: italic; font-weight: bold; font-size: 2.5rem; color: #333; position: absolute; top: 20px; left: 20px;">Rx</span>
                    <div style="margin-top: 60px; white-space: pre-wrap; font-family: 'Poppins', sans-serif; font-size: 1rem; line-height: 1.8; color: #1F2937;">${content}</div>
                </div>

                <div class="rx-footer" style="margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid;">
                    <small style="color: #9CA3AF;">Generated digitally via MEDeLIFE</small>
                    <div style="text-align: center;">
                        <div style="font-family: 'Cursive', serif; font-size: 1.5rem; color: #EF4444; opacity: 0.7;">Signed</div>
                        <div style="border-top: 1px solid #333; width: 150px; margin-top: 5px;"></div>
                        <small style="font-weight: 600;">Dr. ${docName}</small>
                    </div>
                </div>
            </div>
            <div class="no-print" style="margin-top: 20px; text-align: right; border-top: 1px solid #eee; padding-top: 15px;">
                <button class="list-btn btn-book" onclick="window.print()"><i class="fas fa-print"></i> Print / Save as PDF</button>
            </div>`;
    } else {
        html = `<h3 style="margin-bottom: 10px;">${title}</h3><iframe src="${content}" style="width: 100%; height: 500px; border: 1px solid #E5E7EB; border-radius: 8px; background: #f1f1f1;"></iframe>`;
    }
    viewerContent.innerHTML = html;
    viewerModal.classList.add('active');
}

function closeDocViewer() { document.getElementById('documentViewerModal').classList.remove('active'); }
function showToast(msg) { const b = document.getElementById('toast-box'); document.getElementById('toast-msg').innerText = msg; b.classList.add('show'); setTimeout(()=>b.classList.remove('show'),3000); }
