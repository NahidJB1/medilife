       const db = firebase.firestore();
        
        // --- 1. HELPER FUNCTIONS (Must be defined first) ---
        
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
            // Get Days
            const daysMap = { 'Mon':1, 'Tue':2, 'Wed':3, 'Thu':4, 'Fri':5, 'Sat':6, 'Sun':7 };
            const selectedEls = Array.from(document.querySelectorAll('.day-circle.selected'));
            
            if(selectedEls.length === 0) { alert("Select at least one day"); return; }
            
            selectedEls.sort((a,b) => daysMap[a.getAttribute('data-d')] - daysMap[b.getAttribute('data-d')]);
            const dayNames = selectedEls.map(el => el.getAttribute('data-d'));

            // Format Day String
            let dayString = dayNames.join(', ');
            if (dayNames.length > 2 && isConsecutive(selectedEls, daysMap)) {
                dayString = `${dayNames[0]} - ${dayNames[dayNames.length-1]}`;
            } else if(dayNames.length === 7) dayString = "Everyday";

            // Get Time
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

            // Create Visual Tag
            const container = document.getElementById('scheduleContainer');
            document.getElementById('emptySchedMsg').style.display = 'none';

            const div = document.createElement('div');
            div.className = 'schedule-tag';
            div.innerHTML = `<span><i class="far fa-clock" style="color:var(--primary); margin-right:8px;"></i>${fullString}</span> <i class="fas fa-times" style="color:#EF4444; cursor:pointer;" onclick="removeSchedule(this)"></i>`;
            container.appendChild(div);

            // Reset UI
            selectedEls.forEach(el => el.classList.remove('selected'));
            updateHiddenInput();
        }

        function removeSchedule(icon) {
            icon.closest('.schedule-tag').remove();
            const container = document.getElementById('scheduleContainer');
            if(container.children.length <= 1) { 
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

        // --- 2. MAIN LOGIC ---

        const role = localStorage.getItem('userRole');
        const email = localStorage.getItem('userEmail');
        const uid = email; 
        const name = localStorage.getItem('userName');

        if(!email) window.location.href = 'index.html';

        document.getElementById('sideName').innerText = name;
        document.getElementById('headerName').innerText = name;
        document.getElementById('sideRole').innerText = role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
        document.getElementById('headerRole').innerText = role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
        document.getElementById('accEmail').value = email;
        document.getElementById('accUid').value = uid;

        // Render Dynamic Fields
        const container = document.getElementById('dynamicFields');
        
        if (role === 'patient') {
            container.innerHTML = `
                <div class="form-group"><label>Full Name</label><input type="text" class="form-input" id="inp_name" value="${name}"></div>
                
                <div class="form-group">
                    <label>Gender</label>
                    <select class="form-input" id="inp_gender">
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Age (Years)</label>
                    <input type="number" class="form-input" id="inp_age" placeholder="e.g. 25">
                </div>
                <div class="form-group"><label>Blood Group</label><select class="form-input" id="inp_bloodGroup"><option value="">Select</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>O+</option><option>O-</option><option>AB+</option><option>AB-</option></select></div>
                <div class="form-group"><label>Height (cm)</label><input type="number" class="form-input" id="inp_height" placeholder="e.g. 175"></div>
                <div class="form-group"><label>Weight (kg)</label><input type="number" class="form-input" id="inp_weight" placeholder="e.g. 70"></div>
                <div class="form-group" style="grid-column:1/-1"><label>Address</label><input type="text" class="form-input" id="inp_address" placeholder="Home Address"></div>
                
                <div class="section-divider">Emergency Contact</div>
                
                <div class="form-group"><label>Contact Name</label><input type="text" class="form-input" id="inp_emName"></div>
                <div class="form-group"><label>Relation</label><input type="text" class="form-input" id="inp_emRelation" placeholder="e.g. Father, Spouse"></div>
                <div class="form-group"><label>Phone Number</label><input type="tel" class="form-input" id="inp_emPhone"></div>
                <div class="form-group"><label>Email</label><input type="email" class="form-input" id="inp_emEmail"></div>
            `;
        
        } else if (role === 'doctor') {
            // Using the helper function here is now SAFE because it is defined above
            container.innerHTML = `
                <div class="form-group"><label>Full Name</label><input type="text" class="form-input" id="inp_name" value="${name}"></div>
                <div class="form-group"><label>Specialist In</label><input type="text" class="form-input" id="inp_specialist" placeholder="e.g. Cardiology"></div>
                <div class="form-group"><label>Degrees</label><input type="text" class="form-input" id="inp_degrees" placeholder="e.g. MBBS, MD"></div>
                <div class="form-group"><label>Contact Number</label><input type="tel" class="form-input" id="inp_phone"></div>
                <div class="form-group" style="grid-column:1/-1"><label>Chamber Address</label><input type="text" class="form-input" id="inp_address"></div>
                
                <div class="form-group" style="grid-column:1/-1">
                    <label>Manage Schedule</label>
                    <div class="time-builder-area">
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
                            <div>
                                <span style="font-size:0.75rem; color:var(--gray); display:block; margin-bottom:4px;">Open Time</span>
                                <div class="time-select-group">
                                    <select id="openH" class="time-select">${generateOptions(1,12)}</select> :
                                    <select id="openM" class="time-select">${generateOptions(0,50,10)}</select>
                                    <select id="openAmPm" class="time-select"><option>AM</option><option>PM</option></select>
                                </div>
                            </div>
                            <span style="color:var(--gray); padding-bottom:10px;">-</span>
                            <div>
                                <span style="font-size:0.75rem; color:var(--gray); display:block; margin-bottom:4px;">Close Time</span>
                                <div class="time-select-group">
                                    <select id="closeH" class="time-select">${generateOptions(1,12)}</select> :
                                    <select id="closeM" class="time-select">${generateOptions(0,50,10)}</select>
                                    <select id="closeAmPm" class="time-select"><option>PM</option><option>AM</option></select>
                                </div>
                            </div>
                            <button type="button" class="btn-add-time" onclick="addScheduleRow()"><i class="fas fa-plus"></i> Add Hours</button>
                        </div>

                        <div id="scheduleContainer" style="border-top:1px solid #E5E7EB; padding-top:10px;">
                            <p id="emptySchedMsg" style="font-size:0.85rem; color:var(--gray); font-style:italic;">No hours added yet.</p>
                        </div>
                    </div>
                    <input type="hidden" id="inp_time">
                </div>
            `;
        } else if (role === 'pharmacy') {
            container.innerHTML = `
                <div class="form-group"><label>Pharmacy Name</label><input type="text" class="form-input" id="inp_name" value="${name}"></div>
                <div class="form-group"><label>Registration Number</label><input type="text" class="form-input" id="inp_regNum"></div>
                <div class="form-group" style="grid-column:1/-1"><label>Address</label><input type="text" class="form-input" id="inp_address"></div>
            `;
        }

        // --- 3. DATA LOADING ---
        let currentProfilePic = null;

        db.collection('users').doc(uid).get().then(doc => {
            if(doc.exists) {
                const data = doc.data();
                
                if(data.profilePic) {
                    document.getElementById('mainProfileImg').src = data.profilePic;
                    document.getElementById('sideAvatar').src = data.profilePic;
                    currentProfilePic = data.profilePic;
                }

                // Generic inputs
                document.querySelectorAll('input, select').forEach(input => {
                    const key = input.id.replace('inp_', '');
                    if(data[key] && key !== 'time') input.value = data[key];
                });

                // Load Time Tags Specifically
                if(data.time && document.getElementById('scheduleContainer')) {
                    // Split by separator ' | ' if multiple, or just handle string
                    // Note: This matches the save format below
                    const times = data.time.split(' | ');
                    const schedCont = document.getElementById('scheduleContainer');
                    const emptyMsg = document.getElementById('emptySchedMsg');
                    
                    if(times.length > 0 && times[0] !== "") {
                        emptyMsg.style.display = 'none';
                        times.forEach(tStr => {
                            if(!tStr) return;
                            const div = document.createElement('div');
                            div.className = 'schedule-tag';
                            div.innerHTML = `<span><i class="far fa-clock" style="color:var(--primary); margin-right:8px;"></i>${tStr}</span> <i class="fas fa-times" style="color:#EF4444; cursor:pointer;" onclick="removeSchedule(this)"></i>`;
                            schedCont.appendChild(div);
                        });
                        document.getElementById('inp_time').value = data.time;
                    }
                }
            }
        });

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
                    currentProfilePic = e.target.result; 
                }
                reader.readAsDataURL(input.files[0]);
            }
        }

        function saveProfile() {
            const formData = { profilePic: currentProfilePic };
            
            document.querySelectorAll('[id^="inp_"]').forEach(input => {
                const key = input.id.replace('inp_', '');
                formData[key] = input.value;
            });

            if(formData.name) localStorage.setItem('userName', formData.name);

            db.collection('users').doc(uid).set(formData, { merge: true }).then(() => {
                const toast = document.getElementById('toast-box');
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 3000);
            }).catch(err => alert("Error saving: " + err.message));
        }

        function goBack() {
            const dashboard = role + '-dashboard.html';
            window.location.href = dashboard;
        }






