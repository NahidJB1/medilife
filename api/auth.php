<?php
include 'db_connect.php';
header('Content-Type: application/json');

$action = $_POST['action'];

if ($action == 'register') {
    $name = $_POST['name'];
    $email = $_POST['email'];
    $pass = password_hash($_POST['password'], PASSWORD_DEFAULT);
    $role = $_POST['role'];
    
    // Use Email as UID as per your request
    $uid = $email; 

    $stmt = $conn->prepare("INSERT INTO users (uid, name, email, password, role) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("sssss", $uid, $name, $email, $pass, $role);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "uid" => $uid]);
    } else {
        echo json_encode(["status" => "error", "message" => "Email already exists"]);
    }
} 

if ($action == 'login') {
    $email = $_POST['email'];
    $pass = $_POST['password'];

    $stmt = $conn->prepare("SELECT uid, name, role, password FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($row = $result->fetch_assoc()) {
        if (password_verify($pass, $row['password'])) {
            echo json_encode(["status" => "success", "user" => $row]);
        } else {
            echo json_encode(["status" => "error", "message" => "Invalid password"]);
        }
    } else {
        echo json_encode(["status" => "error", "message" => "User not found"]);
    }
}
?>
