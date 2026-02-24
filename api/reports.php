<?php
include 'db_connect.php';
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_REQUEST['action'] ?? '';

// --- GET REQUESTS (Fetching Data) ---
if ($method === 'GET') {
    $patient_id = $_GET['patient_id'] ?? '';
    $type = $_GET['type'] ?? '';        // e.g., 'Prescription'
    $uploader = $_GET['uploader'] ?? ''; // e.g., 'patient' or 'doctor'

    // Base SQL
    $sql = "SELECT * FROM reports WHERE patient_id = '$patient_id'";

    // Add filters if they exist
    if (!empty($type)) {
        $sql .= " AND report_type = '$type'";
    }
    if (!empty($uploader)) {
        $sql .= " AND uploaded_by = '$uploader'";
    }

    $sql .= " ORDER BY timestamp DESC";

    $result = $conn->query($sql);
    
    $data = [];
    while ($row = $result->fetch_assoc()) {
        // Add a clean date for JS
        $row['formatted_date'] = date("M d, Y", strtotime($row['timestamp']));
        $data[] = $row;
    }
    echo json_encode($data);
}

// --- POST REQUESTS (Saving Data) ---
elseif ($method === 'POST') {
    
    // 1. UPLOAD FILE (Used by both Doctor & Patient)
    if ($action == 'upload') {
        $pid = $_POST['patientId'];
        $did = $_POST['doctorId'] ?? '';
        $dname = $_POST['doctorName'] ?? '';
        $type = $_POST['reportType']; // 'Prescription', 'Report', or 'Patient Upload'
        $cat = $_POST['docCategory'] ?? $type;
        $by = $_POST['uploadedBy']; // 'doctor' or 'patient'

        if (isset($_FILES['file'])) {
            $target_dir = "../uploads/";
            if (!file_exists($target_dir)) mkdir($target_dir, 0777, true);

            $fileName = time() . "_" . basename($_FILES["file"]["name"]);
            $target_file = $target_dir . $fileName;

            if (move_uploaded_file($_FILES["file"]["tmp_name"], $target_file)) {
            
                // Store path relative to API or Root
                $dbPath = "uploads/" . $fileName;
                
                // BLOCKCHAIN INTEGRATION: Generate a unique SHA-256 hash of the uploaded file
                $fileHash = hash_file('sha256', $target_file);
                
                $stmt = $conn->prepare("INSERT INTO reports (patient_id, doctor_id, doctor_name, report_type, doc_category, file_path, uploaded_by, is_manual, blockchain_hash) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)");
                $stmt->bind_param("ssssssss", $pid, $did, $dname, $type, $cat, $dbPath, $by, $fileHash);
                
                if($stmt->execute()) echo json_encode(["status" => "success"]);
                else echo json_encode(["status" => "error", "message" => $stmt->error]);
            } else {
                echo json_encode(["status" => "error", "message" => "File move failed"]);
            }
        } else {
            echo json_encode(["status" => "error", "message" => "No file sent"]);
        }
    }

    // 2. MANUAL PRESCRIPTION (Doctor Only)
    elseif ($action == 'manual') {
        $pid = $_POST['patientId'];
        $did = $_POST['doctorId'];
        $dname = $_POST['doctorName'];
        $content = $_POST['content'];
        $docDetails = $_POST['doctorDetails']; // JSON string
        
        // BLOCKCHAIN INTEGRATION: Generate a hash based on the prescription content and timestamp
        $dataToHash = $pid . $did . $content . time();
        $recordHash = hash('sha256', $dataToHash);

        $stmt = $conn->prepare("INSERT INTO reports (patient_id, doctor_id, doctor_name, report_type, doc_category, uploaded_by, is_manual, content, doctor_details, blockchain_hash) VALUES (?, ?, ?, 'Prescription', 'Prescription', 'doctor', 1, ?, ?, ?)");
        $stmt->bind_param("sssssss", $pid, $did, $dname, $content, $docDetails, $recordHash);
        
        if($stmt->execute()) echo json_encode(["status" => "success"]);
        else echo json_encode(["status" => "error", "message" => $stmt->error]);
    }
}
?>
