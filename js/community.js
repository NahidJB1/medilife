        const db = firebase.firestore();
        let currentUser = null;
        let currentPostType = 'question';

        document.addEventListener("DOMContentLoaded", () => {
            initCommunity();
        });

        function initCommunity() {
               
    const role = localStorage.getItem('userRole') || 'patient';
    const name = localStorage.getItem('userName') || 'User';
    const uid = localStorage.getItem('userUid'); 

    if (!localStorage.getItem('isLoggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = { name, role, uid };

    // --- NEW CODE START: Set Logo Link based on Role ---
    const logoLink = document.getElementById('navLogo');
    if(logoLink) {
        if(role === 'doctor') {
            logoLink.href = 'doctor-dashboard.html';
        } else if (role === 'pharmacy') {
            logoLink.href = 'pharmacy-dashboard.html';
        } else {
            logoLink.href = 'patient-dashboard.html';
        }
    }
    // --- NEW CODE END ---

    // UI Adaptation based on Role
    if (role === 'doctor') {
        document.getElementById('tabArticle').classList.remove('hidden');
    }

    // Load Posts
    listenToPosts();
}

        // --- 2. POSTING LOGIC ---
        function setPostType(type) {
            currentPostType = type;
            const titleInput = document.getElementById('postTitle');
            const contentInput = document.getElementById('postContent');
            const tabs = document.querySelectorAll('.cp-tab');

            tabs.forEach(t => t.classList.remove('active'));
            
            if (type === 'article') {
                document.getElementById('tabArticle').classList.add('active');
                titleInput.classList.add('active');
                contentInput.placeholder = "Write your medical article content here...";
                contentInput.rows = 6;
            } else {
                tabs[0].classList.add('active');
                titleInput.classList.remove('active');
                contentInput.placeholder = "What health question is on your mind?";
                contentInput.rows = 3;
            }
        }

        function submitPost() {
            const content = document.getElementById('postContent').value.trim();
            const title = document.getElementById('postTitle').value.trim();

            if (!content) { showToast("Please write something!"); return; }
            if (currentPostType === 'article' && !title) { showToast("Articles need a title."); return; }

            const postData = {
                authorName: currentUser.name,
                authorRole: currentUser.role,
                authorId: currentUser.uid,
                content: content,
                title: currentPostType === 'article' ? title : null,
                type: currentPostType,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                likes: [], // Array of UIDs
                comments: [] // Simple array of objects for this demo
            };

            db.collection('posts').add(postData).then(() => {
                document.getElementById('postContent').value = '';
                document.getElementById('postTitle').value = '';
                showToast("Post published!");
                // Reset to Question mode
                setPostType('question'); 
            }).catch(err => console.error(err));
        }

        // --- 3. RENDERING FEED ---
        function listenToPosts() {
            db.collection('posts').orderBy('timestamp', 'desc').limit(20)
                .onSnapshot(snapshot => {
                    const feed = document.getElementById('feedContainer');
                    feed.innerHTML = '';

                    if(snapshot.empty) {
                        feed.innerHTML = '<div style="text-align:center; padding:20px;">No posts yet. Be the first!</div>';
                        return;
                    }

                    snapshot.forEach(doc => {
                        const post = doc.data();
                        const postId = doc.id;
                        
                        // Check if Liked by current user
                        const isLiked = post.likes && post.likes.includes(currentUser.uid);
                        const likeCount = post.likes ? post.likes.length : 0;
                        const commentCount = post.comments ? post.comments.length : 0;

                        // Badge Color
                        let badgeClass = 'role-patient';
                        if(post.authorRole === 'doctor') badgeClass = 'role-doctor';
                        if(post.authorRole === 'pharmacy') badgeClass = 'role-pharmacy';

                        // Tag Label
                        let tagLabel = post.type === 'article' ? '<span class="post-tag">Article</span>' : '<span class="post-tag" style="background:#E0F2FE; color:#0284C7">Question</span>';

                        // Title HTML (only if article)
                        let titleHtml = post.title ? `<h3>${post.title}</h3>` : '';

                        // Render Card
                        const div = document.createElement('div');
                        div.className = 'post-card';
                        div.innerHTML = `
                            <div class="post-header">
                                <div class="user-info">
                                    <div class="avatar" style="background:#eee; display:flex; align-items:center; justify-content:center; font-size:1.2rem; color:#aaa;">
                                        <i class="fas fa-user"></i>
                                    </div>
                                    <div class="meta">
                                        <h4>${post.authorName} <span class="role-badge ${badgeClass}">${post.authorRole.toUpperCase()}</span></h4>
                                        <span>${formatDate(post.timestamp)}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="post-content">
                                ${tagLabel}
                                ${titleHtml}
                                <p>${post.content}</p>
                            </div>

                            <div class="interaction-bar">
                                <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${postId}', ${isLiked})">
                                    <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> ${likeCount} Likes
                                </button>
                                <button class="action-btn" onclick="toggleComments('${postId}')">
                                    <i class="far fa-comment"></i> ${commentCount} Comments
                                </button>
                            </div>

                            <div id="comments-${postId}" class="comments-section">
                                <div class="comment-input-box">
                                    <input type="text" id="input-${postId}" placeholder="Write a comment...">
                                    <button class="btn-send" onclick="submitComment('${postId}')"><i class="fas fa-paper-plane"></i></button>
                                </div>
                                <div class="comment-list" id="list-${postId}">
                                    ${renderComments(post.comments)}
                                </div>
                            </div>
                        `;
                        feed.appendChild(div);
                    });
                });
        }

        // --- 4. INTERACTIONS ---
        
        function toggleLike(postId, isLiked) {
            const postRef = db.collection('posts').doc(postId);
            if (isLiked) {
                postRef.update({
                    likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
                });
            } else {
                postRef.update({
                    likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                });
            }
        }

        function toggleComments(postId) {
            const section = document.getElementById(`comments-${postId}`);
            section.classList.toggle('open');
        }

        function submitComment(postId) {
            const input = document.getElementById(`input-${postId}`);
            const text = input.value.trim();
            if (!text) return;

            const newComment = {
                text: text,
                author: currentUser.name,
                role: currentUser.role,
                timestamp: new Date().toISOString()
            };

            db.collection('posts').doc(postId).update({
                comments: firebase.firestore.FieldValue.arrayUnion(newComment)
            }).then(() => {
                input.value = ''; // Clear input
            });
        }

        function renderComments(commentsArray) {
            if (!commentsArray || commentsArray.length === 0) return '<div style="color:#9CA3AF; font-size:0.85rem;">No comments yet.</div>';
            
            return commentsArray.map(c => {
                let color = c.role === 'doctor' ? 'var(--secondary)' : 'var(--dark)';
                return `
                    <div class="single-comment">
                        <span class="comment-author" style="color:${color}">${c.author}:</span>
                        <span>${c.text}</span>
                    </div>
                `;
            }).join('');
        }

        // --- 5. UTILITIES ---
        function formatDate(timestamp) {
            if (!timestamp) return 'Just now';
            const date = timestamp.toDate();
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }

        function showToast(msg) {
            const box = document.getElementById('toast-box');
            document.getElementById('toast-msg').innerText = msg;
            box.classList.add('show');
            setTimeout(() => box.classList.remove('show'), 3000);
        }
