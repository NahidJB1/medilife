// --- 1. SETUP & MOCK STATE ---
let currentUser = null;
let currentPostType = 'question';
let tempImages = []; // Stores images before posting

// Mocking the feed so the UI works immediately before you connect PHP
let posts = []; 

document.addEventListener("DOMContentLoaded", () => {
    initCommunity();
});

function initCommunity() {
    const role = localStorage.getItem('userRole') || 'patient';
    const name = localStorage.getItem('userName') || 'User';
    const uid = localStorage.getItem('userUid') || 'u123'; 

    currentUser = { name, role, uid, following: [] };

    // Set Navigation Link
    const logoLink = document.getElementById('navLogo');
    if(logoLink) {
        if(role === 'doctor') logoLink.href = 'doctor-dashboard.html';
        else if (role === 'pharmacy') logoLink.href = 'pharmacy-dashboard.html';
        else logoLink.href = 'patient-dashboard.html';
    }

    // Doctor specific UI
    if (role === 'doctor') {
        document.getElementById('tabArticle').classList.remove('hidden');
    }

    renderFeed(); // Initial render
}

// --- 2. POSTING & MEDIA LOGIC ---
function setPostType(type) {
    currentPostType = type;
    const titleInput = document.getElementById('postTitle');
    const contentInput = document.getElementById('postContent');
    const tabs = document.querySelectorAll('.cp-tab');

    tabs.forEach(t => t.classList.remove('active'));
    
    if (type === 'article') {
        document.getElementById('tabArticle').classList.add('active');
        titleInput.classList.add('active');
        contentInput.placeholder = "Write your medical article. You can attach multiple photos below.";
        contentInput.rows = 6;
    } else {
        tabs[0].classList.add('active');
        titleInput.classList.remove('active');
        contentInput.placeholder = "What health question is on your mind?";
        contentInput.rows = 3;
    }
}

function previewImages() {
    const input = document.getElementById('imageInput');
    const container = document.getElementById('imagePreviewContainer');
    
    for (let file of input.files) {
        const reader = new FileReader();
        reader.onload = function(e) {
            tempImages.push(e.target.result);
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'img-preview';
            container.appendChild(img);
        }
        reader.readAsDataURL(file);
    }
}

function submitPost() {
    const content = document.getElementById('postContent').value.trim();
    const title = document.getElementById('postTitle').value.trim();

    if (!content) { showToast("Please write something!"); return; }
    if (currentPostType === 'article' && !title) { showToast("Articles need a title."); return; }

    const newPost = {
        id: 'post_' + Date.now(),
        authorName: currentUser.name,
        authorRole: currentUser.role,
        authorId: currentUser.uid,
        content: content,
        title: currentPostType === 'article' ? title : null,
        type: currentPostType,
        images: [...tempImages],
        timestamp: new Date(),
        likes: [],
        dislikes: [],
        shares: 0,
        replies: [] // Mixed array of comments and answers
    };

    posts.unshift(newPost); // Add to top of local array
    
    // Clear UI
    document.getElementById('postContent').value = '';
    document.getElementById('postTitle').value = '';
    document.getElementById('imagePreviewContainer').innerHTML = '';
    tempImages = [];
    document.getElementById('imageInput').value = '';
    
    showToast("Post published successfully!");
    setPostType('question'); 
    renderFeed();
}

// --- 3. RENDERING THE FEED ---
function renderFeed() {
    const feed = document.getElementById('feedContainer');
    feed.innerHTML = '';

    if(posts.length === 0) {
        feed.innerHTML = '<div style="text-align:center; padding:40px; color:var(--gray);">No posts yet. Be the first to start a discussion!</div>';
        return;
    }

    posts.forEach(post => {
        const isLiked = post.likes.includes(currentUser.uid);
        const isDisliked = post.dislikes.includes(currentUser.uid);
        const isFollowing = currentUser.following.includes(post.authorId);
        
        let badgeClass = post.authorRole === 'doctor' ? 'role-doctor' : (post.authorRole === 'pharmacy' ? 'role-pharmacy' : 'role-patient');
        let tagLabel = post.type === 'article' ? '<span class="topic-tag" style="background:#FEF2F2; color:#EF4444">Article</span>' : '<span class="topic-tag" style="background:#E0F2FE; color:#0284C7">Question</span>';
        let titleHtml = post.title ? `<h3>${post.title}</h3>` : '';

        // Follow Button Logic (Don't show on own posts)
        let followBtnHtml = post.authorId !== currentUser.uid 
            ? `<button class="btn-follow ${isFollowing ? 'following' : ''}" onclick="toggleFollow('${post.authorId}')">${isFollowing ? 'Following' : 'Follow'}</button>` 
            : '';

        // Media Parsing
        let mediaHtml = '';
        if (post.images && post.images.length > 0) {
            mediaHtml += `<div class="post-media" id="media-${post.id}">`;
            post.images.forEach((imgSrc, index) => {
                let hiddenClass = index > 0 ? 'hidden-media' : '';
                mediaHtml += `<img src="${imgSrc}" class="post-img ${hiddenClass}">`;
            });
            mediaHtml += `</div>`;
        }

        // Determine input placeholder based on role and post type
        let replyPlaceholder = "Write a comment...";
        let isAnswerMode = false;
        if (currentUser.role === 'doctor' && post.type === 'question') {
            replyPlaceholder = "Provide a medical answer...";
            isAnswerMode = true;
        }

        const div = document.createElement('div');
        div.className = 'post-card';
        div.innerHTML = `
            <div class="post-header">
                <div class="user-info">
                    <div class="avatar"><i class="fas fa-user"></i></div>
                    <div class="meta">
                        <h4>${post.authorName} <span class="role-badge ${badgeClass}">${post.authorRole.toUpperCase()}</span></h4>
                        <span>${formatDate(post.timestamp)}</span>
                    </div>
                </div>
                ${followBtnHtml}
            </div>
            
            <div class="post-content">
                ${tagLabel}
                ${titleHtml}
                <div class="text-body text-truncated" id="text-${post.id}">${post.content}</div>
                <button class="btn-see-more" id="btn-more-${post.id}" onclick="expandPost('${post.id}')">See More</button>
                ${mediaHtml}
            </div>

            <div class="interaction-bar">
                <button class="action-btn ${isLiked ? 'active-like' : ''}" onclick="toggleLike('${post.id}')">
                    <i class="fa-thumbs-up ${isLiked ? 'fas' : 'far'}"></i> ${post.likes.length}
                </button>
                <button class="action-btn ${isDisliked ? 'active-dislike' : ''}" onclick="toggleDislike('${post.id}')">
                    <i class="fa-thumbs-down ${isDisliked ? 'fas' : 'far'}"></i> ${post.dislikes.length}
                </button>
                <button class="action-btn" onclick="toggleSection('discussion-${post.id}')">
                    <i class="far fa-comment-dots"></i> ${post.replies.length}
                </button>
                <button class="action-btn" onclick="sharePost('${post.id}')">
                    <i class="fa-solid fa-share"></i> ${post.shares} Share
                </button>
            </div>

            <div id="discussion-${post.id}" class="discussion-section">
                <div class="input-box">
                    <input type="text" id="input-${post.id}" placeholder="${replyPlaceholder}">
                    <button class="btn-send" onclick="submitReply('${post.id}', ${isAnswerMode})"><i class="fas fa-paper-plane"></i></button>
                </div>
                <div class="discussion-list">
                    ${renderReplies(post.replies)}
                </div>
            </div>
        `;
        feed.appendChild(div);

        // Hide "See More" if text is short and there is only 0 or 1 image
        setTimeout(() => {
            const textEl = document.getElementById(`text-${post.id}`);
            const btnEl = document.getElementById(`btn-more-${post.id}`);
            const hasHiddenImages = post.images && post.images.length > 1;
            
            if (textEl.scrollHeight <= textEl.clientHeight && !hasHiddenImages) {
                btnEl.style.display = 'none';
            }
        }, 10);
    });
}

// --- 4. INTERACTIONS ---
function expandPost(postId) {
    const textEl = document.getElementById(`text-${postId}`);
    const mediaEl = document.getElementById(`media-${postId}`);
    const btnEl = document.getElementById(`btn-more-${postId}`);

    textEl.classList.remove('text-truncated');
    if(mediaEl) mediaEl.classList.add('expanded-media');
    btnEl.style.display = 'none';
}

function toggleLike(postId) {
    let post = posts.find(p => p.id === postId);
    if(post.dislikes.includes(currentUser.uid)) {
        post.dislikes = post.dislikes.filter(id => id !== currentUser.uid);
    }
    if(post.likes.includes(currentUser.uid)) {
        post.likes = post.likes.filter(id => id !== currentUser.uid);
    } else {
        post.likes.push(currentUser.uid);
    }
    renderFeed();
}

function toggleDislike(postId) {
    let post = posts.find(p => p.id === postId);
    if(post.likes.includes(currentUser.uid)) {
        post.likes = post.likes.filter(id => id !== currentUser.uid);
    }
    if(post.dislikes.includes(currentUser.uid)) {
        post.dislikes = post.dislikes.filter(id => id !== currentUser.uid);
    } else {
        post.dislikes.push(currentUser.uid);
    }
    renderFeed();
}

function toggleFollow(authorId) {
    if (currentUser.following.includes(authorId)) {
        currentUser.following = currentUser.following.filter(id => id !== authorId);
        showToast("Unfollowed user.");
    } else {
        currentUser.following.push(authorId);
        showToast("Following user!");
    }
    renderFeed();
}

function sharePost(postId) {
    let post = posts.find(p => p.id === postId);
    post.shares += 1;
    showToast("Post shared to your wall!");
    renderFeed();
}

function toggleSection(sectionId) {
    document.getElementById(sectionId).classList.toggle('open');
}

function submitReply(postId, isAnswer) {
    const input = document.getElementById(`input-${postId}`);
    const text = input.value.trim();
    if (!text) return;

    let post = posts.find(p => p.id === postId);
    post.replies.push({
        text: text,
        author: currentUser.name,
        role: currentUser.role,
        isAnswer: isAnswer,
        timestamp: new Date()
    });

    input.value = '';
    renderFeed();
    
    // Re-open discussion section after re-rendering
    document.getElementById(`discussion-${postId}`).classList.add('open');
}

function renderReplies(repliesArray) {
    if (!repliesArray || repliesArray.length === 0) return '<div style="color:var(--gray); font-size:0.85rem; text-align:center;">No replies yet.</div>';
    
    return repliesArray.map(r => {
        let cardClass = r.isAnswer ? 'reply-item doctor-answer' : 'reply-item';
        let badge = r.isAnswer ? '<span class="role-badge role-doctor">Verified Answer</span>' : '';
        
        return `
            <div class="${cardClass}">
                <div class="reply-header">
                    <span class="reply-author">${r.author} ${badge}</span>
                    <span style="font-size:0.75rem; color:var(--gray);">${formatDate(r.timestamp)}</span>
                </div>
                <div style="color:var(--dark); line-height:1.5;">${r.text}</div>
            </div>
        `;
    }).join('');
}

// --- 5. UTILITIES ---
function formatDate(dateObj) {
    if (!dateObj) return 'Just now';
    return dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function showToast(msg) {
    const box = document.getElementById('toast-box');
    document.getElementById('toast-msg').innerText = msg;
    box.classList.add('show');
    setTimeout(() => box.classList.remove('show'), 3000);
}
