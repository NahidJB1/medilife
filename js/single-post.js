document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');

    if (!postId) {
        document.getElementById('singlePostWrapper').innerHTML = `<div style="text-align:center; color:var(--primary); padding:40px; background:white; border-radius:12px;">Invalid Post ID.</div>`;
        return;
    }

    // Wait slightly to ensure community.js has initialized currentUser
    setTimeout(() => {
        loadSinglePost(postId);
    }, 100);
});

async function loadSinglePost(postId) {
    const wrapper = document.getElementById('singlePostWrapper');
    
    try {
        const res = await fetch(`${API_URL}?action=get_single_post&postId=${postId}&uid=${currentUser.uid}`);
        const data = await res.json();
        
        if (data.status === 'success') {
            wrapper.innerHTML = ''; // Clear loading
            
            // Re-use the flawless rendering engine from community.js
            const postElement = createPostElement(data.post);
            wrapper.appendChild(postElement);
            
            // UX Enhancement: Auto-open comments or answers so it feels active immediately
            if (data.post.type === 'question') {
                toggleAnswers(data.post.id);
            } else {
                toggleComments(data.post.id);
            }
            
        } else {
            wrapper.innerHTML = `<div style="text-align:center; color:var(--gray); padding:40px; background:white; border-radius:12px; border:1px solid #E5E7EB;">${data.message || 'Post could not be found.'}</div>`;
        }
    } catch (err) {
        wrapper.innerHTML = `<div style="text-align:center; color:var(--primary); padding:40px; background:white; border-radius:12px;">Network error loading post.</div>`;
    }
}
