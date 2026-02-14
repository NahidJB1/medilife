<?php
include 'db_connect.php';
header('Content-Type: application/json');

$action = $_REQUEST['action'] ?? '';

// 1. UPLOAD FILE (X-Ray, PDF, etc.)
if ($action == 'upload') {
    $pid = $_POST['patientId'];
    $did = $_POST['doctorId'] ?? '';
    $dname = $_POST['doctorName'] ?? '';
    $type = $_POST['reportType'];
    $cat = $_POST['docCategory'] ?? $type;
    $by = $_POST['uploadedBy'];

    if (isset($_FILES['file'])) {
        $target_dir = "../uploads/";
        if (!file_exists($target_dir)) mkdir($target_dir, 0777, true);

        $fileName = time() . "_" . basename($_FILES["file"]["name"]);
        $target_file = $target_dir . $fileName;

        if (move_uploaded_file($_FILES["file"]["tmp_name"], $target_file)) {
            // Web accessible path
            $webPath = "uploads/" . $fileName;
            
            $stmt = $conn->prepare("INSERT INTO reports (patient_id, doctor_id, doctor_name, report_type, doc_category, file_path, uploaded_by, is_manual) VALUES (?, ?, ?, ?, ?, ?, ?, 0)");
            $stmt->bind_param("sssssss", $pid, $did, $dname, $type, $cat, $webPath, $by);
            
            if($stmt->execute()) echo json_encode(["status" => "success"]);
            else echo json_encode(["status" => "error"]);
        } else {
            echo json_encode(["status" => "error", "message" => "Move failed"]);
        }
    }
}

// 2. MANUAL PRESCRIPTION (Text)
elseif ($action == 'manual') {
    $pid = $_POST['patientId'];
    $did = $_POST['doctorId'];
    $dname = $_POST['doctorName'];
    $content = $_POST['content'];
    
    // We store doctorDetails JSON in the 'file_path' column or a new column 'content' 
    // depending on your SQL schema. I will assume a 'content' column exists.
    
    $stmt = $conn->prepare("INSERT INTO reports (patient_id, doctor_id, doctor_name, report_type, uploaded_by, is_manual, content) VALUES (?, ?, ?, 'Prescription', 'doctor', 1, ?)");
    $stmt->bind_param("ssss", $pid, $did, $dname, $content);
    
    if($stmt->execute()) echo json_encode(["status" => "success"]);
    else echo json_encode(["status" => "error", "message" => $conn->error]);
}

// 3. GET PRESCRIPTIONS (For Pharmacy)
elseif ($action == 'get_prescriptions') {
    $pid = $_GET['patient_id'];
    $sql = "SELECT * FROM reports WHERE patient_id = ? AND report_type = 'Prescription' ORDER BY timestamp DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $pid);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $data = [];
    while($row = $result->fetch_assoc()) $data[] = $row;
    echo json_encode($data);
}
?>
