<?php
include 'db_connect.php';
header('Content-Type: application/json');

$action = $_REQUEST['action'] ?? '';

// ----------------------------- GET FEED -----------------------------
if ($action == 'get_feed') {
    $uid = $_GET['uid'] ?? ''; // current user id for like/follow status
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
    $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;

    // Get posts from followed users + own posts, ordered by date
    // For simplicity, we get all posts. You can implement follow filtering later.
    $sql = "SELECT p.*, 
            (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count
            FROM posts p
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $limit, $offset);
    $stmt->execute();
    $result = $stmt->get_result();

    $posts = [];
    while ($row = $result->fetch_assoc()) {
        // Decode images JSON
        $row['images'] = json_decode($row['images'], true) ?? [];

        // If it's a share, fetch original post details
        if ($row['type'] == 'share' && $row['original_post_id']) {
            $orig = $conn->query("SELECT author_name, author_role, content, images FROM posts WHERE id = " . $row['original_post_id'])->fetch_assoc();
            $row['original'] = $orig;
        }

        // Check if current user liked this post
        if ($uid) {
            $likeCheck = $conn->query("SELECT id FROM likes WHERE post_id = {$row['id']} AND user_id = '$uid'");
            $row['liked_by_user'] = $likeCheck->num_rows > 0;
        } else {
            $row['liked_by_user'] = false;
        }

        // Check if current user follows the author
        if ($uid) {
            $followCheck = $conn->query("SELECT id FROM follows WHERE follower_uid = '$uid' AND followed_uid = '{$row['author_id']}'");
            $row['followed_by_user'] = $followCheck->num_rows > 0;
        } else {
            $row['followed_by_user'] = false;
        }

        // Format date
        $row['created_at'] = date('c', strtotime($row['created_at']));

        $posts[] = $row;
    }

    echo json_encode($posts);
    exit;
}

// ----------------------------- CREATE POST (with images) -----------------------------
elseif ($action == 'create_post') {
    $authorId = $_POST['authorId'];
    $authorName = $_POST['authorName'];
    $authorRole = $_POST['authorRole'];
    $type = $_POST['type']; // 'question' or 'article'
    $title = $_POST['title'] ?? null;
    $content = $_POST['content'];

    // Handle image uploads
    $imagePaths = [];
    if (!empty($_FILES['images']['name'][0])) {
        $targetDir = "../uploads/community/";
        if (!file_exists($targetDir)) mkdir($targetDir, 0777, true);

        foreach ($_FILES['images']['tmp_name'] as $key => $tmpName) {
            $fileName = time() . "_" . basename($_FILES['images']['name'][$key]);
            $targetFile = $targetDir . $fileName;
            if (move_uploaded_file($tmpName, $targetFile)) {
                $imagePaths[] = "uploads/community/" . $fileName;
            }
        }
    }
    $imagesJson = json_encode($imagePaths);

    $stmt = $conn->prepare("INSERT INTO posts (author_id, author_name, author_role, type, title, content, images) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("sssssss", $authorId, $authorName, $authorRole, $type, $title, $content, $imagesJson);
    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "post_id" => $stmt->insert_id]);
    } else {
        echo json_encode(["status" => "error", "message" => $stmt->error]);
    }
    exit;
}

// ----------------------------- LIKE / UNLIKE -----------------------------
elseif ($action == 'like') {
    $postId = $_POST['postId'];
    $userId = $_POST['userId'];

    // Check if already liked
    $check = $conn->query("SELECT id FROM likes WHERE post_id = $postId AND user_id = '$userId'");
    if ($check->num_rows == 0) {
        $conn->query("INSERT INTO likes (post_id, user_id) VALUES ($postId, '$userId')");
        $conn->query("UPDATE posts SET likes_count = likes_count + 1 WHERE id = $postId");
        echo json_encode(["status" => "liked"]);
    } else {
        $conn->query("DELETE FROM likes WHERE post_id = $postId AND user_id = '$userId'");
        $conn->query("UPDATE posts SET likes_count = likes_count - 1 WHERE id = $postId");
        echo json_encode(["status" => "unliked"]);
    }
    exit;
}

// ----------------------------- COMMENT (or ANSWER) -----------------------------
elseif ($action == 'comment') {
    $postId = $_POST['postId'];
    $userId = $_POST['userId'];
    $authorName = $_POST['authorName'];
    $authorRole = $_POST['authorRole'];
    $content = $_POST['content'];
    $type = $_POST['type'] ?? 'comment'; // 'comment' or 'answer'

    $stmt = $conn->prepare("INSERT INTO comments (post_id, user_id, author_name, author_role, content, type) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("isssss", $postId, $userId, $authorName, $authorRole, $content, $type);
    if ($stmt->execute()) {
        $conn->query("UPDATE posts SET comments_count = comments_count + 1 WHERE id = $postId");
        echo json_encode(["status" => "success", "comment_id" => $stmt->insert_id]);
    } else {
        echo json_encode(["status" => "error", "message" => $stmt->error]);
    }
    exit;
}

// ----------------------------- FOLLOW / UNFOLLOW -----------------------------
elseif ($action == 'follow') {
    $followerUid = $_POST['followerUid'];
    $followedUid = $_POST['followedUid'];

    $check = $conn->query("SELECT id FROM follows WHERE follower_uid = '$followerUid' AND followed_uid = '$followedUid'");
    if ($check->num_rows == 0) {
        $conn->query("INSERT INTO follows (follower_uid, followed_uid) VALUES ('$followerUid', '$followedUid')");
        echo json_encode(["status" => "followed"]);
    } else {
        $conn->query("DELETE FROM follows WHERE follower_uid = '$followerUid' AND followed_uid = '$followedUid'");
        echo json_encode(["status" => "unfollowed"]);
    }
    exit;
}

// ----------------------------- SHARE POST -----------------------------
elseif ($action == 'share') {
    $userId = $_POST['userId'];
    $originalPostId = $_POST['originalPostId'];

    // Get original post details
    $orig = $conn->query("SELECT author_id, author_name, author_role, content, images FROM posts WHERE id = $originalPostId")->fetch_assoc();
    if (!$orig) {
        echo json_encode(["status" => "error", "message" => "Original post not found"]);
        exit;
    }

    // Get current user details
    $user = $conn->query("SELECT name, role FROM users WHERE uid = '$userId'")->fetch_assoc();
    if (!$user) {
        echo json_encode(["status" => "error", "message" => "User not found"]);
        exit;
    }

    // Create share post
    $shareContent = "shared a post"; // You can customize
    $stmt = $conn->prepare("INSERT INTO posts (author_id, author_name, author_role, type, content, original_post_id) VALUES (?, ?, ?, 'share', ?, ?)");
    $stmt->bind_param("ssssi", $userId, $user['name'], $user['role'], $shareContent, $originalPostId);
    if ($stmt->execute()) {
        // Increment shares count on original post
        $conn->query("UPDATE posts SET shares_count = shares_count + 1 WHERE id = $originalPostId");
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["status" => "error", "message" => $stmt->error]);
    }
    exit;
}

// ----------------------------- GET COMMENTS FOR A POST -----------------------------
elseif ($action == 'get_comments') {
    $postId = $_GET['postId'];
    $result = $conn->query("SELECT * FROM comments WHERE post_id = $postId ORDER BY created_at ASC");
    $comments = [];
    while ($row = $result->fetch_assoc()) {
        $row['created_at'] = date('c', strtotime($row['created_at']));
        $comments[] = $row;
    }
    echo json_encode($comments);
    exit;
}

// ----------------------------- DELETE POST -----------------------------
elseif ($action == 'delete_post') {
    $postId = intval($_POST['postId']);
    $userId = $_POST['userId']; // Need to verify ownership

    // Check ownership
    $check = $conn->query("SELECT id FROM posts WHERE id = $postId AND author_id = '$userId'");
    if ($check->num_rows > 0) {
        // Delete associated likes and comments first to prevent orphaned data
        $conn->query("DELETE FROM likes WHERE post_id = $postId");
        $conn->query("DELETE FROM comments WHERE post_id = $postId");
        // Delete the post
        $conn->query("DELETE FROM posts WHERE id = $postId");
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Unauthorized to delete this post"]);
    }
    exit;
}

// If no action matched
echo json_encode(["status" => "error", "message" => "Invalid action"]);
?>
