<?php
include 'db_connect.php';
header('Content-Type: application/json');

$action = $_REQUEST['action'] ?? '';

// 1. GET POSTS
if ($action == 'get') {
    $result = $conn->query("SELECT * FROM posts ORDER BY created_at DESC LIMIT 20");
    $posts = [];
    while($row = $result->fetch_assoc()) {
        // Decode JSON strings back to Arrays for JS
        $row['likes'] = json_decode($row['likes']) ?: [];
        $row['comments'] = json_decode($row['comments']) ?: [];
        
        // Map SQL columns to JS expectations
        $row['authorName'] = $row['author_name'];
        $row['authorRole'] = $row['author_role'];
        $row['timestamp'] = $row['created_at']; 
        
        $posts[] = $row;
    }
    echo json_encode($posts);
}

// 2. CREATE POST
elseif ($action == 'post') {
    $content = $_POST['content'];
    $name = $_POST['authorName'];
    $role = $_POST['authorRole'];
    $uid = $_POST['authorId'];
    $emptyJson = '[]';

    $stmt = $conn->prepare("INSERT INTO posts (author_id, author_name, author_role, content, likes, comments) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ssssss", $uid, $name, $role, $content, $emptyJson, $emptyJson);
    $stmt->execute();
}

// 3. LIKE POST
elseif ($action == 'like') {
    $id = $_POST['id'];
    $uid = $_POST['uid'];

    // Fetch current likes
    $res = $conn->query("SELECT likes FROM posts WHERE id = $id");
    $row = $res->fetch_assoc();
    $likes = json_decode($row['likes'], true) ?: [];

    // Toggle logic
    if (in_array($uid, $likes)) {
        $likes = array_diff($likes, [$uid]); // Remove
    } else {
        $likes[] = $uid; // Add
    }

    $newJson = json_encode(array_values($likes));
    $stmt = $conn->prepare("UPDATE posts SET likes = ? WHERE id = ?");
    $stmt->bind_param("si", $newJson, $id);
    $stmt->execute();
}

// 4. COMMENT POST
elseif ($action == 'comment') {
    $id = $_POST['id'];
    $text = $_POST['text'];
    $author = $_POST['author'];
    $role = $_POST['role']; // e.g. 'doctor'

    $res = $conn->query("SELECT comments FROM posts WHERE id = $id");
    $row = $res->fetch_assoc();
    $comments = json_decode($row['comments'], true) ?: [];

    $newComment = [
        "text" => $text,
        "author" => $author,
        "role" => $role
    ];
    $comments[] = $newComment;

    $newJson = json_encode($comments);
    $stmt = $conn->prepare("UPDATE posts SET comments = ? WHERE id = ?");
    $stmt->bind_param("si", $newJson, $id);
    $stmt->execute();
}
?>
