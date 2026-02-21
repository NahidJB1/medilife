const API_BASE = 'api/';

// --- INIT PHARMACY DATA ---
const role = localStorage.getItem('userRole');
if(role !== 'pharmacy') { window.location.href = 'index.html'; }

const name = localStorage.getItem('userName') || 'Pharmacy Staff';
const storedEmail = localStorage.getItem('userEmail');
const storedUid = localStorage.getItem('userUid');

if (!storedEmail) { window.location.href = 'index.html'; }

const currentUserData = { name: name, role: 'pharmacy', uid: storedEmail, email: storedEmail };

document.getElementById('sideName').innerText = name;
document.getElementById('welcomeTitle').innerText = "Hello, " + name;
document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

// --- TAB SWITCHING ---
function switchMainTab(el, tabName) {
    document.querySelectorAll('.tab-item, .nav-item').forEach(t => t.classList.remove('active'));
    if(el) el.classList.add('active');
    
    const contentArea = document.getElementById('tabContentArea');

    if (tabName === 'home') {
        if(window.feedInterval) clearInterval(window.feedInterval);
        contentArea.innerHTML = `
        <div class="action-section">
            <div class="section-title">Quick Actions</div>
            <div class="quick-actions">
                <div class="action-card" onclick="openPatientSearch()"><i class="fas fa-search"></i><h4>Search Patient</h4><p>View Prescriptions</p></div>
            </div>
        </div>`;
    } else if (tabName === 'community') {
        loadCommunityFeed(contentArea);
    }
}

// --- PATIENT SEARCH ---
function openPatientSearch() {
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
        <h2 style="text-align:center;">Patient Lookup</h2>
        <div class="modern-search-bar"><i class="fas fa-search search-icon"></i>
        <input type="text" id="sInput" class="search-input-field" placeholder="Enter Patient Email..."><button class="search-btn-modern" onclick="performSearch()">Search</button></div>
        <div id="searchResults" style="max-height:400px;overflow-y:auto"></div>`;
    document.getElementById('dashboardModal').classList.add('active');
}

function performSearch() {
    const email = document.getElementById('sInput').value.trim();
    const div = document.getElementById('searchResults');
    if(!email) { showToast("Enter email"); return; }
    
    div.innerHTML = 'Searching...';

    // 1. Search User
    fetch(`${API_BASE}users.php?action=search&email=${email}`)
    .then(res => res.json())
    .then(data => {
        div.innerHTML = '';
        if(data.length === 0) { div.innerHTML = 'No patient found.'; return; }

        data.forEach(user => {
            div.innerHTML += `
                <div style="background:white; border:1px solid #E5E7EB; border-radius:12px; overflow:hidden; margin-bottom:15px;">
                    <div style="padding:15px; background:#F9FAFB; border-bottom:1px solid #E5E7EB; display:flex; align-items:center; gap:10px;">
                        <div style="width:40px; height:40px; background:#E5E7EB; border-radius:50%; display:flex; align-items:center; justify-content:center;"><i class="fas fa-user"></i></div>
                        <div><strong>${user.name}</strong><br><small>ID: ${user.uid}</small></div>
                    </div>
                    <div id="records-${user.uid}" style="padding:15px;">Loading Rx...</div>
                </div>`;
            
            // 2. Load Prescriptions
            loadPrescriptions(user.uid);
        });
    });
}

function loadPrescriptions(patientId) {
    const safeId = patientId; 
    const div = document.getElementById(`records-${safeId}`);
    
    // UPDATED: Added type=Prescription and uploader=doctor to strictly filter the results
    fetch(`${API_BASE}reports.php?action=get_prescriptions&patient_id=${patientId}&type=Prescription&uploader=doctor`)
    .then(r => r.json())
    .then(reports => {
        div.innerHTML = '';
        if(reports.length === 0) { 
            div.innerHTML = '<div style="padding: 15px; text-align: center; color: var(--gray); font-style: italic;"><i class="fas fa-file-medical-alt" style="font-size: 1.5rem; margin-bottom: 8px; opacity: 0.5; display: block;"></i>No doctor prescriptions found.</div>'; 
            return; 
        }

        reports.forEach((r, index) => {
            let viewAction = '';
            if(r.is_manual == 1) {
                // Manual Text
                const safeContent = (r.content||'').replace(/`/g, "'").replace(/\$/g, "");
                viewAction = `openDocViewer('manual', \`${safeContent}\`, 'Prescription: Dr. ${r.doctor_name}')`;
            } else {
                // File
                viewAction = `openDocViewer('file', '${r.file_path}', 'Prescription Doc')`;
            }

            // UPDATED: Added stagger animation (slideUp) and modernized the view button
            div.innerHTML += `
                <div class="list-item" style="padding:12px 15px; border-bottom:1px solid #eee; animation: slideUp 0.4s ease-out forwards; animation-delay: ${index * 0.08}s; opacity: 0;">
                    <div>
                        <strong style="color: var(--dark); font-size: 1.05rem;"><i class="fas fa-user-md" style="color: var(--primary); margin-right: 5px;"></i>Dr. ${r.doctor_name}</strong><br>
                        <small style="color: var(--gray); font-weight: 500;">${r.formatted_date || new Date(r.timestamp).toLocaleDateString()}</small>
                    </div>
                    <button class="list-btn" style="background: var(--secondary); color: white; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 6px -1px rgba(34, 197, 94, 0.2); transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'" onclick="${viewAction}">
                        <i class="fas fa-eye"></i> View Rx
                    </button>
                </div>`;
        });
    });
}

// --- VIEWER ---
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
            <div style="text-align:right; margin-top:10px;"><button class="list-btn btn-book" onclick="window.print()">Print</button></div>`;
    } else {
        html = `<h3 style="margin-bottom: 10px;">${title}</h3><iframe src="${content}" style="width: 100%; height: 80vh; border: none; background: #eee;"></iframe>`;
    }
    
    viewerContent.innerHTML = html;
    viewerModal.classList.add('active');
}

// --- COMMUNITY FEED (Auto-Refresh) ---
function loadCommunityFeed(container) {
    container.innerHTML = `
        <div class="create-post-card">
            <textarea id="newPostText" class="cp-input-area" style="width:100%; border:none; outline:none;" placeholder="Share a health update..."></textarea>
            <div style="text-align:right; margin-top:10px;">
                <button class="list-btn btn-book" onclick="publishPost()">Post</button>
            </div>
        </div>
        <div id="feedStream">Loading...</div>
    `;
    fetchPosts();
    window.feedInterval = setInterval(fetchPosts, 5000);
}

function fetchPosts() {
    const feed = document.getElementById('feedStream');
    if(!feed) return; 
    fetch(`${API_BASE}community.php?action=get`).then(r=>r.json()).then(data => {
        feed.innerHTML = '';
        data.forEach(p => {
            const isLiked = p.likes && p.likes.includes(currentUserData.uid);
            let commentsHtml = '';
            if(p.comments) p.comments.forEach(c => {
                commentsHtml += `<div style="margin-bottom:8px; font-size:0.9rem; border-bottom:1px solid #eee;"><strong>${c.author}</strong>: ${c.text}</div>`;
            });

            feed.innerHTML += `
                <div class="post-card">
                    <div class="post-header"><strong>${p.authorName}</strong> <span class="role-badge role-${p.authorRole}">${p.authorRole}</span></div>
                    <p>${p.content}</p>
                    <div class="interaction-bar">
                        <button class="action-btn ${isLiked?'liked':''}" onclick="toggleLike('${p.id}')"> <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> ${p.likes ? p.likes.length : 0}</button>
                        <button class="action-btn" onclick="document.getElementById('c-sec-${p.id}').classList.toggle('open')"> <i class="far fa-comment"></i> ${p.comments ? p.comments.length : 0}</button>
                    </div>
                    <div class="comments-section" id="c-sec-${p.id}">
                        <div class="comment-input-box">
                            <input type="text" id="i-${p.id}" placeholder="Write a comment...">
                            <button class="list-btn btn-view" onclick="sendComment('${p.id}')">Send</button>
                        </div>
                        <div style="max-height:200px; overflow-y:auto;">${commentsHtml}</div>
                    </div>
                </div>`;
        });
    });
}

function publishPost() {
    const txt = document.getElementById('newPostText').value;
    if(txt) {
        const fd = new FormData(); fd.append('action', 'post'); fd.append('content', txt);
        fd.append('authorName', currentUserData.name); fd.append('authorRole', 'pharmacy'); fd.append('authorId', currentUserData.uid);
        fetch(`${API_BASE}community.php`, { method: 'POST', body: fd }).then(() => { document.getElementById('newPostText').value = ''; fetchPosts(); });
    }
}
function toggleLike(pid) { const fd = new FormData(); fd.append('action', 'like'); fd.append('id', pid); fd.append('uid', currentUserData.uid); fetch(`${API_BASE}community.php`, { method: 'POST', body: fd }).then(fetchPosts); }
function sendComment(pid) { const t = document.getElementById('i-'+pid).value; if(t) { const fd = new FormData(); fd.append('action', 'comment'); fd.append('id', pid); fd.append('text', t); fd.append('author', currentUserData.name); fetch(`${API_BASE}community.php`, { method: 'POST', body: fd }).then(fetchPosts); } }

// --- UTILS ---
function closeDocViewer() { document.getElementById('documentViewerModal').classList.remove('active'); }
function closeModal() { document.getElementById('dashboardModal').classList.remove('active'); }
function showToast(msg) { const b = document.getElementById('toast-box'); if(b){ document.getElementById('toast-msg').innerText = msg; b.classList.add('show'); setTimeout(()=>b.classList.remove('show'),3000); }}
function logout() { localStorage.clear(); window.location.href = 'index.html'; }
