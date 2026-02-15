// --- 1. GLOBAL VARIABLES & CONFIG ---
const API_BASE = 'api/';

// Define these globally so all functions (saveProfile, goBack) can access them
let role = '';
let email = '';
let uid = '';
let name = '';

// --- 2. INITIALIZATION (Runs when page loads) ---
document.addEventListener('DOMContentLoaded', () => {
    
    // A. Retrieve & Normalize Data
    const rawRole = localStorage.getItem('userRole');
    role = rawRole ? rawRole.toLowerCase().trim() : ''; // Fixes "Patient" vs "patient"
    email = localStorage.getItem('userEmail');
    name = localStorage.getItem('userName') || 'User';
    uid = email; // Using email as UID based on your auth setup

    // B. Security Check - Redirect if missing data
    if (!email || !role) {
        window.location.href = 'index.html';
        return;
    }

    // C. Update Static UI Elements (Header, Sidebar)
    document.getElementById('sideName').innerText = name;
    document.getElementById('headerName').innerText = name;
    
    const displayRole = role.charAt(0).toUpperCase() + role.slice(1);
    document.getElementById('sideRole').innerText = `${displayRole} Account`;
    document.getElementById('headerRole').innerText = `Update your ${displayRole} details`;

    document.getElementById('accEmail').value = email;
    document.getElementById('accUid').value = uid;

    // D. Generate Dynamic Form Fields
    renderFormFields();

    // E. Load Data from Server
    loadUserData();
});

// --- 3. CORE FUNCTIONS ---

// --- REPLACE YOUR EXISTING renderFormFields FUNCTION WITH THIS ---

function renderFormFields() {
    const container = document.getElementById('dynamicFields');
    container.innerHTML = ''; 
    container.style.animation = "fadeIn 0.5s ease-out forwards";

    // Common attributes for validation: No negatives, Read-only by default
    const numAttr = 'type="number" min="0" oninput="if(this.value<0)this.value=0" disabled';
    const textAttr = 'type="text" disabled';

    let html = '';

    if (role === 'patient') {
        html = `
            <div class="form-group"><label>Full Name</label><input ${textAttr} class="form-input" id="inp_name"></div>
            <div class="form-group"><label>Gender</label><select class="form-input" id="inp_gender" disabled><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
            
            <div class="form-group"><label>Age</label><input ${numAttr} class="form-input" id="inp_age"></div>
            
            <div class="form-group"><label>Blood Group</label><select class="form-input" id="inp_bloodGroup" disabled><option value="">Select</option><option>A+</option><option>B+</option><option>O+</option><option>AB+</option><option>A-</option><option>B-</option><option>O-</option><option>AB-</option></select></div>
            
            <div class="form-group"><label>Height (ft/in)</label><input ${textAttr} class="form-input" id="inp_height" placeholder="e.g. 5'6&quot;"></div>
            
            <div class="form-group"><label>Weight (kg)</label><input ${numAttr} class="form-input" id="inp_weight"></div>
            
            <div class="form-group" style="grid-column:1/-1"><label>Address</label><input ${textAttr} class="form-input" id="inp_address"></div>
            
            <div class="section-divider">Emergency Contact</div>
            <div class="form-group"><label>Contact Name</label><input ${textAttr} class="form-input" id="inp_emName"></div>
            <div class="form-group"><label>Relation</label><input ${textAttr} class="form-input" id="inp_emRelation" placeholder="e.g. Spouse"></div>
            <div class="form-group"><label>Phone</label><input type="tel" disabled class="form-input" id="inp_emPhone"></div>
            <div class="form-group"><label>Email</label><input type="email" disabled class="form-input" id="inp_emEmail"></div>
        `;
    } else if (role === 'doctor') {
        html = `
            <div class="form-group"><label>Full Name</label><input ${textAttr} class="form-input" id="inp_name"></div>
            <div class="form-group"><label>Specialist In</label><input ${textAttr} class="form-input" id="inp_specialist"></div>
            <div class="form-group"><label>Degrees</label><input ${textAttr} class="form-input" id="inp_degrees"></div>
            <div class="form-group"><label>Contact Number</label><input type="tel" disabled class="form-input" id="inp_phone"></div>
            <div class="form-group" style="grid-column:1/-1"><label>Chamber Address</label><input ${textAttr} class="form-input" id="inp_address"></div>
            
            <div class="form-group" style="grid-column:1/-1">
                <label>Manage Schedule</label>
                <div class="time-builder-area" id="scheduleArea" style="opacity:0.6; pointer-events:none;">
                    ${getScheduleHTML()} 
                </div>
                <input type="hidden" id="inp_time">
            </div>
        `;
    } else if (role === 'pharmacy') {
        html = `
            <div class="form-group"><label>Pharmacy Name</label><input ${textAttr} class="form-input" id="inp_name"></div>
            <div class="form-group"><label>Registration Number</label><input ${textAttr} class="form-input" id="inp_regNum"></div>
            <div class="form-group" style="grid-column:1/-1"><label>Address</label><input ${textAttr} class="form-input" id="inp_address"></div>
        `;
    }

    container.innerHTML = html;

    // HIDE SAVE BUTTON INITIALLY
    document.querySelector('.btn-save').style.display = 'none';

    // INSERT EDIT BUTTON
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-edit';
    editBtn.innerHTML = '<i class="fas fa-pen"></i> Edit Details';
    editBtn.onclick = enableEditing;
    editBtn.style.marginBottom = "20px";
    
    // Add button before the form grid
    container.parentNode.insertBefore(editBtn, container);

    if(document.getElementById('inp_name')) document.getElementById('inp_name').value = name;
}

// --- ADD THIS HELPER FUNCTION ---
function getScheduleHTML() {
    // Returns the inner HTML for schedule builder to keep renderFormFields clean
    return `
        <div style="display:flex; gap:8px; margin-bottom:15px; flex-wrap:wrap;">
            <div class="day-circle" onclick="toggleDay(this)" data-d="Mon">M</div>
            <div class="day-circle" onclick="toggleDay(this)" data-d="Tue">T</div>
            <div class="day-circle" onclick="toggleDay(this)" data-d="Wed">W</div>
            <div class="day-circle" onclick="toggleDay(this)" data-d="Thu">T</div>
            <div class="day-circle" onclick="toggleDay(this)" data-d="Fri">F</div>
            <div class="day-circle" onclick="toggleDay(this)" data-d="Sat">S</div>
            <div class="day-circle" onclick="toggleDay(this)" data-d="Sun">S</div>
        </div>
        <div class="time-controls-row" style="display:flex; flex-wrap:wrap; gap:15px; align-items:flex-end; margin-bottom:15px;">
            <div><span style="font-size:0.75rem; color:var(--gray);">Open</span><div class="time-select-group"><select id="openH" class="time-select">${generateOptions(1,12)}</select> : <select id="openM" class="time-select">${generateOptions(0,50,10)}</select><select id="openAmPm" class="time-select"><option>AM</option><option>PM</option></select></div></div>
            <div><span style="font-size:0.75rem; color:var(--gray);">Close</span><div class="time-select-group"><select id="closeH" class="time-select">${generateOptions(1,12)}</select> : <select id="closeM" class="time-select">${generateOptions(0,50,10)}</select><select id="closeAmPm" class="time-select"><option>PM</option><option>AM</option></select></div></div>
            <button type="button" class="btn-add-time" onclick="addScheduleRow()"><i class="fas fa-plus"></i> Add</button>
        </div>
        <div id="scheduleContainer" style="border-top:1px solid #E5E7EB; padding-top:10px;">
            <p id="emptySchedMsg" style="font-size:0.85rem; color:var(--gray); font-style:italic;">No hours added yet.</p>
        </div>
    `;
}

// --- ADD THIS NEW FUNCTION ---
function enableEditing() {
    // 1. Enable all inputs
    document.querySelectorAll('.form-input').forEach(el => {
        el.disabled = false;
        el.style.backgroundColor = '#fff'; // Visual feedback
    });

    // 2. Enable Schedule area (Doctor only)
    const sched = document.getElementById('scheduleArea');
    if(sched) {
        sched.style.opacity = '1';
        sched.style.pointerEvents = 'all';
    }

    // 3. Show Save Button
    const saveBtn = document.querySelector('.btn-save');
    saveBtn.style.display = 'block';
    saveBtn.style.animation = "fadeIn 0.5s";

    // 4. Hide Edit Button (optional, to prevent double clicking)
    document.querySelector('.btn-edit').style.display = 'none';
}

function loadUserData() {
    fetch(`${API_BASE}users.php?action=get&uid=${uid}`)
        .then(r => r.json())
        .then(data => {
            if (!data) return;

            if (data.profile_pic) { 
                document.getElementById('mainProfileImg').src = data.profile_pic;
                document.getElementById('sideAvatar').src = data.profile_pic;
            }

            // Smart Input Filling (Matches inp_camelCase to snake_case DB fields)
            document.querySelectorAll('input, select').forEach(input => {
                if (input.id.startsWith('inp_')) {
                    const jsKey = input.id.replace('inp_', '');
                    // 1. Try exact match
                    let val = data[jsKey];
                    // 2. Try snake_case conversion (bloodGroup -> blood_group)
                    if (!val) {
                        const snakeKey = jsKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                        val = data[snakeKey];
                    }
                    if (val) input.value = val;
                }
            });

            // Load Schedule (Doctor only)
            if (data.time && document.getElementById('scheduleContainer')) {
                const times = data.time.split(' | ');
                const schedCont = document.getElementById('scheduleContainer');
                
                // Clear existing if any
                schedCont.querySelectorAll('.schedule-tag').forEach(e => e.remove());

                if (times.length > 0 && times[0] !== "") {
                    document.getElementById('emptySchedMsg').style.display = 'none';
                    times.forEach(tStr => {
                        const div = document.createElement('div');
                        div.className = 'schedule-tag';
                        div.innerHTML = `<span><i class="far fa-clock" style="color:var(--primary); margin-right:8px;"></i>${tStr}</span> <i class="fas fa-times" style="color:#EF4444; cursor:pointer;" onclick="removeSchedule(this)"></i>`;
                        schedCont.appendChild(div);
                    });
                    document.getElementById('inp_time').value = data.time;
                }
            }
        })
        .catch(err => console.log("Profile load error:", err));
}

// --- 4. ACTION FUNCTIONS (Must be Global) ---

function saveProfile() {
    const fd = new FormData();
    fd.append('action', 'update_profile');
    fd.append('uid', uid);

    document.querySelectorAll('[id^="inp_"]').forEach(input => {
        const key = input.id.replace('inp_', '');
        fd.append(key, input.value);
    });

    const fileInput = document.getElementById('imgUpload');
    if (fileInput.files[0]) {
        fd.append('profile_pic', fileInput.files[0]);
    }

    fetch(`${API_BASE}users.php`, { method: 'POST', body: fd })
        .then(r => r.json()) // Changed to json() for cleaner handling
        .then(data => {
            if(data.status === 'success') {
                const toast = document.getElementById('toast-box');
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 3000);
                
                const newName = document.getElementById('inp_name').value;
                if(newName) {
                    localStorage.setItem('userName', newName);
                    document.getElementById('sideName').innerText = newName;
                    document.getElementById('headerName').innerText = newName;
                }
            } else {
                alert("Error: " + data.message);
            }
        })
        .catch(err => alert("Error saving: " + err));
}

function goBack() {
    // Uses the global 'role' variable set in DOMContentLoaded
    if(role) {
        window.location.href = `${role}-dashboard.html`;
    } else {
        window.location.href = 'index.html';
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.p-nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
    
    if(tabName === 'details') {
        document.querySelectorAll('.p-nav-item')[0].classList.add('active');
        document.getElementById('detailsTab').classList.add('active');
    } else {
        document.querySelectorAll('.p-nav-item')[1].classList.add('active');
        document.getElementById('accountTab').classList.add('active');
    }
}

function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('mainProfileImg').src = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// --- 5. HELPERS ---
function generateOptions(start, end, step = 1) {
    let ops = '';
    for(let i=start; i<=end; i+=step) {
        let val = i < 10 ? '0'+i : i;
        ops += `<option value="${val}">${val}</option>`;
    }
    return ops;
}

function toggleDay(el) { el.classList.toggle('selected'); }

function addScheduleRow() {
    const daysMap = { 'Mon':1, 'Tue':2, 'Wed':3, 'Thu':4, 'Fri':5, 'Sat':6, 'Sun':7 };
    const selectedEls = Array.from(document.querySelectorAll('.day-circle.selected'));
    
    if(selectedEls.length === 0) { alert("Select at least one day"); return; }
    
    selectedEls.sort((a,b) => daysMap[a.getAttribute('data-d')] - daysMap[b.getAttribute('data-d')]);
    const dayNames = selectedEls.map(el => el.getAttribute('data-d'));

    let dayString = dayNames.join(', ');
    if (dayNames.length > 2 && isConsecutive(selectedEls, daysMap)) {
        dayString = `${dayNames[0]} - ${dayNames[dayNames.length-1]}`;
    } else if(dayNames.length === 7) dayString = "Everyday";

    const t = {
        oh: document.getElementById('openH').value,
        om: document.getElementById('openM').value,
        oa: document.getElementById('openAmPm').value,
        ch: document.getElementById('closeH').value,
        cm: document.getElementById('closeM').value,
        ca: document.getElementById('closeAmPm').value
    };

    const timeString = `${t.oh}:${t.om} ${t.oa} - ${t.ch}:${t.cm} ${t.ca}`;
    const fullString = `${dayString}: ${timeString}`;

    const container = document.getElementById('scheduleContainer');
    document.getElementById('emptySchedMsg').style.display = 'none';

    const div = document.createElement('div');
    div.className = 'schedule-tag';
    div.innerHTML = `<span><i class="far fa-clock" style="color:var(--primary); margin-right:8px;"></i>${fullString}</span> <i class="fas fa-times" style="color:#EF4444; cursor:pointer;" onclick="removeSchedule(this)"></i>`;
    container.appendChild(div);

    selectedEls.forEach(el => el.classList.remove('selected'));
    updateHiddenInput();
}

function removeSchedule(icon) {
    icon.closest('.schedule-tag').remove();
    const container = document.getElementById('scheduleContainer');
    if(container.children.length <= 1) { // includes the hidden msg p tag
        document.getElementById('emptySchedMsg').style.display = 'block';
    }
    updateHiddenInput();
}

function updateHiddenInput() {
    const tags = document.querySelectorAll('.schedule-tag span');
    let finalVal = [];
    tags.forEach(t => finalVal.push(t.innerText));
    document.getElementById('inp_time').value = finalVal.join(' | ');
}

function isConsecutive(els, map) {
    for(let i=0; i < els.length-1; i++) {
        if(map[els[i+1].getAttribute('data-d')] - map[els[i].getAttribute('data-d')] !== 1) return false;
    }
    return true;
}
