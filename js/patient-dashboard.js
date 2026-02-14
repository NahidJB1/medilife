// --- 1. INIT PHARMACY DATA ---
const role = localStorage.getItem('userRole');
if (role !== 'pharmacy') { window.location.href = 'index.html'; }

const name = localStorage.getItem('userName') || 'Pharmacy Staff';
const storedEmail = localStorage.getItem('userEmail');
const storedUid = localStorage.getItem('userUid'); // Use the ID saved from login

if (!storedEmail) {
    window.location.href = 'index.html';
}

const currentUserData = { name: name, role: 'pharmacy', uid: storedUid, email: storedEmail };

document.getElementById('sideName').innerText = name;
document.getElementById('welcomeTitle').innerText = "Hello, " + name;
document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });


// --- 2. TAB SWITCHING ---
function switchMainTab(el, tabName) {
    document.querySelectorAll('.tab-item, .nav-item').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');

    const contentArea = document.getElementById('tabContentArea');

    if (tabName === 'home') {
        contentArea.innerHTML = `
        <div class="action-section">
            <div class="section-title">Quick Actions</div>
            <div class="quick-actions">
                <div class="action-card" onclick="openPatientSearch()"><i class="fas fa-search"></i><h4>Search Patient</h4><p>View Prescriptions</p></div>
            </div>
        </div>`;
    } else if (tabName === 'community') {
         contentArea.innerHTML = '<p style="text-align:center; padding:20px;">Community feature coming soon to Hostinger version.</p>';
    }
}


// --- 3. PATIENT SEARCH & PRESCRIPTIONS ---
function openPatientSearch() {
    const modal = document.getElementById('dashboardModal');
    const modalContent = document.getElementById('modalContent');
    
    modalContent.innerHTML = `
        <h2 style="text-align:center;">Patient Lookup</h2>
        <div class="modern-search-bar"><i class="fas fa-search search-icon"></i>
        <input type="text" id="sInput" class="search-input-field" placeholder="Enter Patient Email..."><button class="search-btn-modern" onclick="performSearch()">Search</button></div>
        <div id="searchResults" style="max-height:400px;overflow-y:auto"></div>`;
    modal.classList.add('active');
}

function performSearch() {
    const email = document.getElementById('sInput').value.trim();
    const div = document.getElementById('searchResults');
    
    if(!email) { showToast("Enter email"); return; }
    
    div.innerHTML = '<div style="text-align:center; padding:20px;">Searching patient...</div>';

    // 1. CALL PHP API TO FIND PATIENT
    fetch(`api/search_patient.php?email=${email}`)
    .then(res => res.json())
    .then(data => {
        div.innerHTML = '';
        
        // Handle no results
        if(data.length === 0 || data.status === 'error') { 
            div.innerHTML = '<p style="text-align:center; color:#EF4444;">No patient found.</p>'; 
            return; 
        }

        const patients = Array.isArray(data) ? data : [data];

        patients.forEach(userData => {
            const patientId = userData.uid; // This is the email/ID

            div.innerHTML += `
                <div style="background:white; border:1px solid #E5E7EB; border-radius:12px; overflow:hidden; margin-bottom:15px;">
                    <div style="padding:15px; background:#F9FAFB; border-bottom:1px solid #E5E7EB; display:flex; align-items:center; gap:10px;">
                        <div style="width:40px; height:40px; background:#E5E7EB; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#6B7280;">
                            <i class="fas fa-user"></i>
                        </div>
                        <div>
                            <strong>${userData.name}</strong>
                            <div style="font-size:0.8rem; color:var(--gray);">ID: ${patientId}</div>
                        </div>
                    </div>
                    <div id="records-${patientId.replace(/[^a-zA-Z0-9]/g, '')}" style="padding:15px;">
                        Loading prescriptions...
                    </div>
                </div>`;

            // 2. CALL PHP API TO FETCH PRESCRIPTIONS FOR THIS PATIENT
            loadPrescriptions(patientId);
        });
    })
    .catch(err => {
        console.error(err);
        div.innerHTML = '<p style="text-align:center; color:red;">Connection error.</p>';
    });
}

function loadPrescriptions(patientId) {
    // Sanitize ID for DOM selector
    const safeId = patientId.replace(/[^a-zA-Z0-9]/g, '');
    const recordDiv = document.getElementById(`records-${safeId}`);

    fetch(`api/get_patient_prescriptions.php?patient_id=${patientId}`)
    .then(res => res.json())
    .then(reports => {
        recordDiv.innerHTML = '';

        if(reports.length === 0) {
            recordDiv.innerHTML = '<small style="color:#6B7280; font-style:italic;">No prescriptions found.</small>';
            return;
        }

        reports.forEach(r => {
            const date = new Date(r.timestamp).toLocaleDateString();
            let viewAction = '';

            // Handle Manual vs File
            if (r.is_manual == 1) { // Note: PHP usually returns '1' or 1 for true
                // Escape special characters for JS string
                const safeContent = (r.content || '').replace(/`/g, "'").replace(/\$/g, "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
                const docName = r.doctor_name || 'Unknown';
                viewAction = `openDocViewer('manual', \`${safeContent}\`, 'Prescription: Dr. ${docName}')`;
            } else {
                // For files, we use the path from the DB
                // Assuming 'file_path' is relative to api folder, we might need to adjust based on where files are stored
                // If api/upload_report.php saves to ../uploads/, the link is 'uploads/filename'
                const filePath = r.file_path.replace('../', ''); 
                viewAction = `openDocViewer('file', '${filePath}', 'Prescription Document')`;
            }

            recordDiv.innerHTML += `
                <div class="list-item" style="padding:10px; border-bottom:1px solid #eee;">
                    <div>
                        <strong>Prescribed by Dr. ${r.doctor_name || 'Unknown'}</strong><br>
                        <small style="color:#6B7280">${date}</small>
                    </div>
                    <button class="list-btn btn-view" onclick="${viewAction}">View Rx</button>
                </div>
            `;
        });
    })
    .catch(err => {
        console.error(err);
        recordDiv.innerHTML = '<small style="color:red">Error loading records.</small>';
    });
}


// --- 4. VIEWER LOGIC ---
function openDocViewer(type, content, title) {
    const viewerModal = document.getElementById('documentViewerModal');
    const viewerContent = document.getElementById('docViewerContent');
    
    let html = '';
    if (type === 'manual') {
        html = `
            <h2 style="margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 10px;">${title}</h2>
            <div style="background: #F9FAFB; padding: 25px; border-radius: 12px; border: 1px solid #E5E7EB; overflow-y: auto; flex: 1;">
                <pre style="white-space: pre-wrap; font-family: 'Poppins', sans-serif; font-size: 1.1rem; color: #333;">${content}</pre>
            </div>
            <div style="margin-top:10px; text-align:right;">
                <button class="list-btn btn-book" onclick="printDiv()"><i class="fas fa-print"></i> Print</button>
            </div>`;
    } else {
        html = `
            <h3 style="margin-bottom: 10px;">${title}</h3>
            <iframe src="${content}" style="width: 100%; height: 80vh; border: none; background: #eee;"></iframe>`;
    }
    
    viewerContent.innerHTML = html;
    viewerModal.classList.add('active');
}

function printDiv() {
    window.print();
}

function closeDocViewer() { document.getElementById('documentViewerModal').classList.remove('active'); }
function closeModal() { document.getElementById('dashboardModal').classList.remove('active'); }
function showToast(msg) { 
    const b = document.getElementById('toast-box'); 
    if(b) {
        document.getElementById('toast-msg').innerText = msg; 
        b.classList.add('show'); 
        setTimeout(()=>b.classList.remove('show'),3000); 
    } else {
        alert(msg);
    }
}
function logout() { localStorage.clear(); window.location.href = 'index.html'; }
