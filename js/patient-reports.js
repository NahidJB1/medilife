        const db = firebase.firestore();
        const auth = firebase.auth();
        let currentUserUid = null;

        // 1. Auth Check & Data Loading
        const role = localStorage.getItem('userRole');
        const email = localStorage.getItem('userEmail');
        const name = localStorage.getItem('userName') || 'User';

        if(role !== 'patient' || !email) { window.location.href = 'index.html'; }
        
        currentUserUid = email; 
        document.getElementById('sideName').innerText = name;
        
        // Load Avatar
        db.collection('users').doc(currentUserUid).get().then(doc => {
            if(doc.exists && doc.data().profilePic) {
                document.getElementById('sideAvatar').src = doc.data().profilePic;
            }
        });

        // Initial Load
        loadAllDocuments();

        // 2. Tab Switching Logic
        function switchReportTab(type) {
            document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            
            if(type === 'doctor') {
                document.querySelectorAll('.report-tab')[0].classList.add('active');
                document.getElementById('doctorDocs').style.display = 'block';
            } else {
                document.querySelectorAll('.report-tab')[1].classList.add('active');
                document.getElementById('patientDocs').style.display = 'block';
            }
        }

        // 3. Robust Loading Function (Handles Old & New Data)
function loadAllDocuments() {
    // We use the email as the ID since that's how doctors save it
    const patientEmail = localStorage.getItem('userEmail'); 

    db.collection('reports')
      .where('patientId', '==', patientEmail)
      // Remove .orderBy('timestamp', 'desc') temporarily to check if it fixes the visibility
      .get()
      .then(snap => {
          const presList = document.getElementById('list-prescriptions');
          const repList = document.getElementById('list-doc-reports');
          const myUploads = document.getElementById('list-my-uploads');
          
          presList.innerHTML = ''; repList.innerHTML = ''; myUploads.innerHTML = '';
          let presCount = 0; let repCount = 0; let myCount = 0;

          snap.forEach(doc => {
              const d = doc.data();
              const isFromDoctor = d.uploadedBy === 'doctor'; 

              if (isFromDoctor) {
                  const html = createDocCard(doc.id, d, false);
                  if (d.reportType === 'Prescription') {
                      presList.innerHTML += html;
                      presCount++;
                  } else {
                      repList.innerHTML += html;
                      repCount++;
                  }
              } else {
                  const html = createDocCard(doc.id, d, true);
                  myUploads.innerHTML += html;
                  myCount++;
              }
          });

                  // Handle Empty States
                  if (presCount === 0) presList.innerHTML = '<div class="empty-state">No prescriptions found.</div>';
                  if (repCount === 0) repList.innerHTML = '<div class="empty-state">No medical reports found.</div>';
                  if (myCount === 0) myUploads.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-cloud-upload-alt" style="font-size:3rem; color:#E5E7EB; margin-bottom:15px;"></i>
                        <p>You haven't uploaded any documents yet.</p>
                        <button class="btn-view" style="margin-top:10px;" onclick="window.location.href='patient-dashboard.html'">Go to Dashboard to Upload</button>
                    </div>`;
              })
              .catch(err => {
                  console.error("Error loading documents:", err);
                  // If index error, show simple message
                  if(err.code === 'failed-precondition') {
                      showToast("System Indexing... Try again in a few minutes.");
                  }
              });
        }


        // --- UPDATED CREATE CARD ---
function createDocCard(id, data, canDelete) {
    const dateStr = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleDateString() : 'Unknown Date';
    const icon = data.reportType === 'Prescription' ? 'fa-file-prescription' : 'fa-file-medical-alt';
    const docName = data.doctorName ? `Dr. ${data.doctorName}` : 'Me';
    const displayTitle = data.docCategory || data.reportType;

    // Prepare data for the viewer
    let viewAction = '';
    if (data.isManual) {
        const safeContent = (data.content || '').replace(/`/g, "'").replace(/\$/g, "").replace(/\\/g, "\\\\");
        const drDetails = JSON.stringify(data.doctorDetails || {}).replace(/"/g, '&quot;');
        viewAction = `openDocViewer('manual', \`${safeContent}\`, '${displayTitle}', '${docName}', '${name}', '${dateStr}', ${drDetails})`;
    } else {
        viewAction = `openDocViewer('file', '${data.fileData}', '${displayTitle}')`;
    }

    return `
    <div class="doc-card" id="card-${id}">
        <div class="doc-info">
            <div class="doc-icon"><i class="fas ${icon}"></i></div>
            <div class="doc-details">
                <h4>${displayTitle}</h4>
                <p>${dateStr} • By ${docName}</p>
            </div>
        </div>
        <div class="doc-actions">
            <button class="btn-view" onclick="${viewAction}"><i class="fas fa-eye"></i> View</button>
            ${canDelete ? `<button class="btn-delete" onclick="deleteReport('${id}')"><i class="fas fa-trash"></i> Delete</button>` : ''}
        </div>
    </div>`;
}

// --- NEW VIEWER LOGIC ---
function openDocViewer(type, content, title, docName, patName, dateStr, drDetails) {
    const viewerModal = document.getElementById('documentViewerModal');
    const viewerContent = document.getElementById('docViewerContent');
    let html = '';
    
    if (type === 'manual') {
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

function closeDocViewer() { 
    document.getElementById('documentViewerModal').classList.remove('active'); 
}

        

        // 5. Delete Function
        function deleteReport(docId) {
            if(confirm("Are you sure you want to delete this document?")) {
                db.collection('reports').doc(docId).delete().then(() => {
                    document.getElementById(`card-${docId}`).remove();
                    showToast("Deleted successfully");
                });
            }
        }

        function showToast(msg) { 
            const b = document.getElementById('toast-box'); 
            document.getElementById('toast-msg').innerText = msg; 
            b.classList.add('show'); 
            setTimeout(()=>b.classList.remove('show'),3000); 
        }

async function generateSmartSummary() {
    // 1. SETUP
    const GEMINI_API_KEY = 'AIzaSyB9AskDk3dwEmqHPvQ23SQrKoOqeejGO1w'; // Double check this is pasted correctly!
    const modal = document.getElementById('aiModal');
    const contentBox = document.getElementById('aiSummaryContent');
    
    if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
        alert('Please paste your actual API Key in the code!');
        return;
    }

    // 2. UI LOADING
    modal.classList.add('active');
    contentBox.innerHTML = '<div class="ai-loading"><i class="fas fa-circle-notch fa-spin"></i> Analyzing documents...</div>';

    try {
        // 3. FETCH DATA (Logic depends on which page we are on)
        let patientRef = null;
        
        // CHECK IF DOCTOR VIEW OR PATIENT VIEW
        if (typeof currentViewingPatient !== 'undefined') {
            // Doctor View
            patientRef = currentViewingPatient.id;
        } else {
            // Patient View
            patientRef = localStorage.getItem('userEmail');
        }

        const snap = await db.collection('reports').where('patientId', '==', patientRef).get();

        if (snap.empty) {
            contentBox.innerHTML = "No documents found to summarize.";
            return;
        }

        // 4. PREPARE DATA
        let docsList = [];
        snap.forEach(doc => {
            const d = doc.data();
            docsList.push({
                type: d.reportType,
                title: d.docCategory || 'General',
                source: d.uploadedBy === 'doctor' ? 'Doctor' : 'Patient',
                date: d.timestamp ? new Date(d.timestamp.toDate()).toLocaleDateString() : 'Unknown'
            });
        });

        const prompt = `
            Analyze this medical document list: ${JSON.stringify(docsList)}
            Provide a brief HTML summary with 2 bullet points:
            <ul><li><strong>From Doctor:</strong> [Summary]</li><li><strong>My Uploads:</strong> [Summary]</li></ul>.
            Keep it short. No markdown.
        `;

        // 5. CALL API WITH ERROR HANDLING
        // Changed 'gemini-1.5-flash' to 'gemini-pro'
const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const result = await response.json();

        // *** DEBUGGING: CHECK FOR API ERROR ***
        if (!response.ok || result.error) {
            console.error("Gemini API Error:", result); // <--- LOOK IN CONSOLE FOR THIS
            throw new Error(result.error?.message || "API Blocked Request");
        }

        const aiText = result.candidates[0].content.parts[0].text;
        contentBox.innerHTML = aiText;

    } catch (error) {
        console.error("Full Error Details:", error);
        contentBox.innerHTML = `<span style="color:red; font-size:0.9rem;">
            <strong>Error:</strong> ${error.message} <br><br>
            <em>Open Console (F12) to see more details.</em>
        </span>`;
    }
}
