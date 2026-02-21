const API_BASE = 'api/';

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
function openDocViewer(type, content, title, docName, patName, dateStr, drDetailsStr) {
    const viewerModal = document.getElementById('documentViewerModal');
    const viewerContent = document.getElementById('docViewerContent');
    let html = '';

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

async function generateSmartSummary() {
    const modal = document.getElementById('aiModal');
    const contentBox = document.getElementById('aiSummaryContent');
    
    if (!email) {
        showToast("Patient email not found.");
        return;
    }

    modal.classList.add('active');
    
    // Smooth modern loading animation
    contentBox.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 30px; color: var(--primary);">
            <i class="fas fa-circle-notch fa-spin" style="font-size:2.5rem; margin-bottom: 15px;"></i>
            <p style="font-weight: 500; color: var(--dark);">AI is reading your medical records...</p>
        </div>`;

    try {
        const response = await fetch(`${API_BASE}ai_summary.php`, {
            method: 'POST',
            headers: { 'Content-Type: application/json' },
            body: JSON.stringify({ patientId: email }) // Fixed: Sending patientId to match the PHP API
        });
        
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        if (!data.candidates) throw new Error("No summary generated.");

        const aiText = data.candidates[0].content.parts[0].text;
        
        contentBox.innerHTML = aiText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
        contentBox.style.animation = "fadeIn 0.8s ease-in-out"; // Keeping the site feeling alive
    } catch (err) {
        console.error("AI Error:", err);
        contentBox.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #EF4444; background: #FEF2F2; border-radius: 8px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <p>Failed to generate summary. Make sure records exist and the API is connected.</p>
            </div>`;
    }
}

// Added this to handle notifications smoothly without breaking the UI flow with alert pop-ups
function showToast(msg) {
    const b = document.getElementById('toast-box');
    if (!b) return;
    document.getElementById('toast-msg').innerText = msg;
    b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), 3000);
}
