document.addEventListener('DOMContentLoaded', function() {
    // Initialize modals
    const photoUploadModal = new bootstrap.Modal(document.getElementById('photoUploadModal'));
    const deleteConfirmationModal = new bootstrap.Modal(document.getElementById('deleteConfirmationModal'));

    // Load admin data
    loadAdminData();
    
    // Load students
    loadStudents();

    // Add event listeners
    document.getElementById('addStudentBtn')?.addEventListener('click', function() {
        document.getElementById('addStudentFormContainer').style.display = 'block';
    });

    document.getElementById('cancelAddStudent')?.addEventListener('click', function() {
        document.getElementById('addStudentFormContainer').style.display = 'none';
        document.getElementById('addStudentForm').reset();
    });

    document.getElementById('semesterFilter')?.addEventListener('change', function() {
        const semester = this.value;
        loadStudents(semester);
    });

    document.getElementById('addStudentForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        
        try {
            const response = await fetch('/Admin/add-student', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('Student added successfully');
                document.getElementById('addStudentFormContainer').style.display = 'none';
                document.getElementById('addStudentForm').reset();
                loadStudents();
            } else {
                alert(data.message || 'Error adding student');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error adding student');
        }
    });
});

// Admin Profile Management
function loadAdminData() {
    fetch('/api/admin/profile')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data && data.name) {
                document.getElementById('adminName').textContent = data.name;
            }
            if (data && data.photo) {
                document.getElementById('adminPhoto').src = data.photo;
            }
        })
        .catch(error => {
            console.error('Error loading admin data:', error);
        });
}

// Student Management
function loadStudents(semester = '') {
    let url = '/Admin/get-students';
    if (semester) {
        url += `?semester=${semester}`;
    }

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data && data.success) {
                const tbody = document.getElementById('studentTableBody');
                if (!tbody) return;
                
                tbody.innerHTML = '';
                data.students.forEach(student => {
                    const photoUrl = student.photo_path ? 
                        `/static/uploads/${student.photo_path}` : 
                        '/static/images/default-avatar.png';
                    
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>
                            <img src="${photoUrl}"
                                 class="rounded-circle"
                                 style="width: 40px; height: 40px; object-fit: cover;"
                                 alt="Student Photo">
                        </td>
                        <td>${student.Stu_name}</td>
                        <td>${student.Stu_rollno || 'N/A'}</td>
                        <td>${student.semester || 'N/A'}</td>
                        <td>
                            <button class="btn btn-sm btn-primary"
                                    onclick="uploadStudentPhoto(${student.stu_id}, '${student.Stu_name}')">
                                Upload Photo
                            </button>
                            <button class="btn btn-sm btn-danger ms-1"
                                    onclick="deleteStudent(${student.stu_id})">
                                Delete
                            </button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            }
        })
        .catch(error => {
            console.error('Error loading students:', error);
        });
}

// Student Photo Upload
function uploadStudentPhoto(studentId, studentName) {
    document.getElementById('studentId').value = studentId;
    document.querySelector('#photoUploadModal .modal-title').textContent = `Upload Photo for ${studentName}`;
    const modal = new bootstrap.Modal(document.getElementById('photoUploadModal'));
    modal.show();
}

async function submitStudentPhoto() {
    const form = document.getElementById('studentPhotoForm');
    const formData = new FormData(form);
    const studentId = document.getElementById('studentId').value;

    try {
        const response = await fetch(`/Admin/student/${studentId}/photo`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            alert('Photo uploaded successfully');
            const modal = bootstrap.Modal.getInstance(document.getElementById('photoUploadModal'));
            modal.hide();
            loadStudents();
        } else {
            alert(data.message || 'Error uploading photo');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error uploading photo');
    }
}

// Student Deletion
function deleteStudent(studentId) {
    document.getElementById('studentToDelete').value = studentId;
    const modal = new bootstrap.Modal(document.getElementById('deleteConfirmationModal'));
    modal.show();
}

async function confirmDelete() {
    const studentId = document.getElementById('studentToDelete').value;
    
    try {
        const response = await fetch(`/Admin/delete-student/${studentId}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Student deleted successfully');
            const modal = bootstrap.Modal.getInstance(document.getElementById('deleteConfirmationModal'));
            modal.hide();
            loadStudents();
        } else {
            alert(data.message || 'Error deleting student');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error deleting student');
    }
}