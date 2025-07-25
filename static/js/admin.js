// Admin Dashboard JavaScript Functions

// Show/Hide Sections
function showSection(sectionIdPrefix, navLink) {
  // Hide all sections
  document.querySelectorAll('section[id$="-content"]').forEach(section => {
    section.classList.add('hidden');
  });
  
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.remove('active');
  });
  
  const actualSectionId = sectionIdPrefix.endsWith('-content') ? sectionIdPrefix : sectionIdPrefix + '-content';
  const currentSection = document.getElementById(actualSectionId);
  if (currentSection) {
    currentSection.classList.remove('hidden');
  }
  
  const titlePrefix = sectionIdPrefix.replace('-content', '');
  let sectionTitle = titlePrefix.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  if (titlePrefix === 'manage-class-routines') {
      sectionTitle = 'Manage Class Routines';
  }
  document.getElementById('main-title').textContent = sectionTitle;
  
  if (navLink) {
    navLink.classList.add('active');
  }

  // Update URL using history.pushState
  // Base path should be /Admin/dashboard
  const basePath = "/Admin/dashboard"; 
  const newUrl = titlePrefix === 'dashboard' ? basePath : `${basePath}/${titlePrefix}`;
  if (window.location.pathname !== newUrl) {
    history.pushState({section: titlePrefix}, sectionTitle, newUrl);
  }

  // Load data for specific sections
  if (actualSectionId === 'my-profile-content') loadAdminProfileData();
  if (actualSectionId === 'manage-student-content') loadStudents();
  if (actualSectionId === 'dashboard-content') {
    loadDashboardStats();
    if (adminSemesterChart) updateStudentChart('all');
    else setupStudentChart();
  }
  if (typeof updateSidebarActiveLink === 'function') updateSidebarActiveLink(navLink);
  if (actualSectionId === 'manage-classes-content') loadClasses();
  else if (actualSectionId === 'manage-announcements-content') loadAnnouncements();
  else if (actualSectionId === 'manage-class-routines-content') {
    console.log('[showSection] Navigating to Manage Class Routines.');
    const semesterFilter = document.getElementById('routine-semester-filter');
    const addFormContainer = document.getElementById('add-routine-form-container');
    const routineDisplayArea = document.getElementById('routine-display-area');
    const selectSemesterPrompt = document.getElementById('select-semester-prompt');
    const semesterSpan = document.getElementById('selected-semester-span');

    if (semesterFilter) {
        console.log('[showSection] Current semesterFilter.value:', semesterFilter.value, 'Current global selectedRoutineSemester:', selectedRoutineSemester);
        if (!semesterFilter.value) { // If filter is empty when section is shown
            console.log('[showSection] semesterFilter is empty. Resetting routine view.');
            if(addFormContainer) addFormContainer.classList.add('hidden');
            if(routineDisplayArea) routineDisplayArea.classList.add('hidden');
            if(selectSemesterPrompt) selectSemesterPrompt.classList.remove('hidden');
            selectedRoutineSemester = null; // Reset global
            if(semesterSpan) semesterSpan.textContent = '';
             // Optionally, clear the table if no semester is to be loaded.
            const routineTableBody = document.getElementById('class-routine-table-body');
            if(routineTableBody) routineTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-3 text-gray-500">Select a semester to view routines.</td></tr>';
        } else { // If filter has a value
            selectedRoutineSemester = semesterFilter.value; // Ensure global is synced with current dropdown value
            console.log('[showSection] semesterFilter has value. Updated global selectedRoutineSemester to:', selectedRoutineSemester, '. Showing form/display.');
            if(addFormContainer) addFormContainer.classList.remove('hidden');
            if(routineDisplayArea) routineDisplayArea.classList.remove('hidden');
            if(selectSemesterPrompt) selectSemesterPrompt.classList.add('hidden');
            if(semesterSpan) semesterSpan.textContent = selectedRoutineSemester;
            console.log('[showSection] Calling loadClassRoutines for semester:', selectedRoutineSemester);
            loadClassRoutines(selectedRoutineSemester); // Load using the current filter value
        }
    } else {
        console.warn('[showSection] semesterFilter element not found when showing routines section.');
         // Fallback behavior if filter doesn't exist, e.g., show prompt
        if(addFormContainer) addFormContainer.classList.add('hidden');
        if(routineDisplayArea) routineDisplayArea.classList.add('hidden');
        if(selectSemesterPrompt) selectSemesterPrompt.classList.remove('hidden');
    }
  }
}

window.addEventListener('popstate', function(event) {
  let sectionIdPrefix = 'dashboard'; // Default to dashboard
  if (event.state && event.state.section) {
    sectionIdPrefix = event.state.section;
  } else {
    // Fallback for direct URL navigation or when state is not set
    const pathSegments = window.location.pathname.split('/');
    // Expected: ['', 'Admin', 'dashboard', 'sectionName']
    if (pathSegments.length > 3 && pathSegments[1] === 'Admin' && pathSegments[2] === 'dashboard' && pathSegments[3]) {
      sectionIdPrefix = pathSegments[3];
    } else if (pathSegments.length === 3 && pathSegments[1] === 'Admin' && pathSegments[2] === 'dashboard') {
      sectionIdPrefix = 'dashboard'; // Handles /Admin/dashboard
    }
    // If other specific base paths are needed, add more conditions here
  }
  const navLink = document.querySelector(`.sidebar-link[onclick*="showSection('${sectionIdPrefix}'"]`);
  showSection(sectionIdPrefix, navLink);
});

// Toggle Dropdown Menus
function toggleDropdown(dropdownId) {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) {
    console.error('Dropdown element with ID ' + dropdownId + ' not found.');
    return;
  }
  
  // Close other open dropdowns (simple version)
  document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
    if (menu.id !== dropdownId) {
      menu.classList.remove('show');
    }
  });

  dropdown.classList.toggle('show');

  // If opening the notification dropdown, refresh notifications
  if (dropdownId === 'notification-dropdown' && dropdown.classList.contains('show')) {
    loadNotifications(); 
  }
}

let students = []; // Global student data
let classesData = []; // Global class data
let adminSemesterChart = null; // Initialize chart variable

function setupStudentChart() {
  try {
    const canvasElement = document.getElementById('adminSemesterChart');
    if (!canvasElement) {
      console.error('adminSemesterChart canvas element not found.');
      return; 
    }
    const ctx = canvasElement.getContext('2d');
    if (!ctx) {
      console.error('Failed to get 2D context for adminSemesterChart.');
      return;
    }

    const initialStudentsData = Array.isArray(students) ? students : [];
    const semesterCounts = initialStudentsData.reduce((acc, student) => {
      acc[student.semester] = (acc[student.semester] || 0) + 1;
      return acc;
    }, {});
    
    const chartLabels = Object.keys(semesterCounts).map(s => `Semester ${s}`);
    const chartDataValues = Object.values(semesterCounts);

    if (adminSemesterChart) { // Destroy existing chart instance before creating a new one
        adminSemesterChart.destroy();
    }

    adminSemesterChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartLabels,
        datasets: [{
          label: 'Number of Students',
          data: chartDataValues,
          backgroundColor: [
            'rgba(54, 162, 235, 0.6)','rgba(75, 192, 192, 0.6)',
            'rgba(255, 206, 86, 0.6)','rgba(153, 102, 255, 0.6)',
            'rgba(255, 159, 64, 0.6)','rgba(255, 99, 132, 0.6)',
            'rgba(201, 203, 207, 0.6)','rgba(100, 150, 200, 0.6)'
          ],
          borderColor: [
            'rgba(54, 162, 235, 1)','rgba(75, 192, 192, 1)',
            'rgba(255, 206, 86, 1)','rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)','rgba(255, 99, 132, 1)',
            'rgba(201, 203, 207, 1)','rgba(100, 150, 200, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Number of Students' } },
          x: { title: { display: true, text: 'Semester' } }
        },
        plugins: { legend: { display: false } }
      }
    });
    // console.log('Admin Semester Chart initialized/updated successfully.');
  } catch (error) {
    console.error('Error in setupStudentChart:', error);
    showMessage('Error initializing student chart: ' + error.message, 'error');
  }
}

function updateStudentChart(semester, clickedButtonElement) {
  // Manage active state for filter chips
  if (clickedButtonElement) {
    document.querySelectorAll('.chip-filter').forEach(btn => {
      btn.classList.remove('active');
      // Re-apply default non-active Tailwind classes if they were removed by .active
      // This assumes .active primarily sets background and text color.
      // If .active also REMOVES classes like bg-gray-200, they need to be added back.
      // For simplicity, the provided CSS for .active only ADDS styles.
      // However, to be robust, let's ensure base styles are there if not active:
      if (!btn.classList.contains('active')) {
        btn.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
      }
    });
    clickedButtonElement.classList.add('active');
    // Remove default non-active classes if .active overrides them (e.g., bg-gray-200)
    clickedButtonElement.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
  }

  if (!adminSemesterChart) {
    // console.error('updateStudentChart called before adminSemesterChart is initialized. Attempting to set it up.');
    setupStudentChart(); 
    if (!adminSemesterChart) { 
        // console.error('adminSemesterChart still not initialized after attempting setup. Exiting updateStudentChart.');
        return;
    }
  }

  try {
    const currentStudents = Array.isArray(students) ? students : [];
    let filteredStudents = currentStudents;
    if (semester !== 'all' && typeof semester !== 'undefined' && semester !== null && semester !== '') {
        filteredStudents = currentStudents.filter(s => String(s.semester) === String(semester));
    }

    const semesterCounts = filteredStudents.reduce((acc, student) => {
      acc[student.semester] = (acc[student.semester] || 0) + 1;
      return acc;
    }, {});

    let chartLabels, chartDataValues;

    if (semester === 'all' || typeof semester === 'undefined' || semester === null || semester === '') {
      const allSemesterCounts = currentStudents.reduce((acc, student) => {
        acc[student.semester] = (acc[student.semester] || 0) + 1;
        return acc;
      }, {});
      chartLabels = Object.keys(allSemesterCounts).sort((a, b) => parseInt(a) - parseInt(b)).map(s => `Semester ${s}`);
      chartDataValues = chartLabels.map(label => {
        const semNum = parseInt(label.replace('Semester ', ''));
        return allSemesterCounts[semNum] || 0;
      });
    } else {
      chartLabels = [`Semester ${semester}`];
      chartDataValues = [semesterCounts[semester] || 0];
    }

    adminSemesterChart.data.labels = chartLabels;
    adminSemesterChart.data.datasets[0].data = chartDataValues;
    adminSemesterChart.update();
    // console.log('Admin Semester Chart updated for semester:', semester);
  } catch (error) {
    console.error('Error in updateStudentChart:', error);
    showMessage('Error updating student chart: ' + error.message, 'error');
  }
}

function renderStudentTable(studentsToRender) {
  const tableBody = document.getElementById('student-table-body');
  const noStudentsMessage = document.getElementById('no-students-message');
  
  if (!tableBody || !noStudentsMessage) {
    console.error('Student table body or no message element not found.');
    return;
  }
  tableBody.innerHTML = '';
  const currentStudents = Array.isArray(studentsToRender) ? studentsToRender : [];

  if (currentStudents.length === 0) {
    noStudentsMessage.classList.remove('hidden');
    tableBody.classList.add('hidden');
  } else {
    noStudentsMessage.classList.add('hidden');
    tableBody.classList.remove('hidden');
    currentStudents.forEach((student, index) => {
      const displayId = index + 1; 
      const photoHtml = student.photo_path
        ? `<img src="/static/${student.photo_path}" alt="Student Photo" class="w-10 h-10 rounded-full object-cover">`
        : `<div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400"><i class="fas fa-user"></i></div>`;
      
      const row = `
        <tr class="hover:bg-gray-50">
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${displayId}</td> 
          <td class="px-6 py-4 whitespace-nowrap">${photoHtml}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${student.Stu_name}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${student.Stu_email}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${student.Stu_contact}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${student.semester}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${student.Stu_Address || '-'}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
            <div class="flex items-center space-x-2">
              <button onclick="openEditStudentModal(${student.stu_id})" class="text-blue-600 hover:text-blue-900"><i class="fas fa-edit"></i> Edit</button>
              <button onclick="deleteStudent(${student.stu_id})" class="text-red-600 hover:text-red-900"><i class="fas fa-trash-alt"></i> Delete</button>
            </div>
          </td>
        </tr>`;
      tableBody.innerHTML += row;
    });
  }
  const totalStudentsCard = document.getElementById('total-students-card');
  if (totalStudentsCard) {
    totalStudentsCard.textContent = (Array.isArray(students) ? students.length : 0); 
  }
}

function filterStudentsBySemester(semester) {
  const currentStudents = Array.isArray(students) ? students : [];
  let filteredStudents = currentStudents;
  if (semester !== 'all' && typeof semester !== 'undefined' && semester !== null && semester !== '') {
    filteredStudents = currentStudents.filter(s => String(s.semester) === String(semester));
  }
  renderStudentTable(filteredStudents);
}

function openAddStudentModal() {
  const modal = document.getElementById('addStudentModal');
  if(modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex'); // Changed from just remove hidden
    // Initialize photo preview for add modal
    const photoInput = modal.querySelector('#student-photo');
    const photoPreview = modal.querySelector('#add-student-photo-preview');
    const previewContainer = modal.querySelector('#add-student-photo-preview-container');
    const uploadLabel = modal.querySelector('#add-student-photo-upload-label');
    const removeButton = modal.querySelector('#add-student-remove-photo');

    if (photoInput && photoPreview && previewContainer && uploadLabel && removeButton) {
        photoInput.value = ''; // Clear previous selection
        photoPreview.src = '#';
        previewContainer.classList.add('hidden');
        uploadLabel.classList.remove('hidden');

        photoInput.onchange = evt => {
            const [file] = photoInput.files;
            if (file) {
                photoPreview.src = URL.createObjectURL(file);
                previewContainer.classList.remove('hidden');
                uploadLabel.classList.add('hidden');
            }
        };
        removeButton.onclick = () => {
            photoInput.value = ''; // Clear file input
            photoPreview.src = '#';
            previewContainer.classList.add('hidden');
            uploadLabel.classList.remove('hidden');
            URL.revokeObjectURL(photoPreview.src); // Clean up
        };
    }
  }
}

function closeAddStudentModal() {
  const modal = document.getElementById('addStudentModal');
  if(modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex'); // Added remove flex
  }
  const form = document.getElementById('addStudentForm');
  if(form) form.reset();
  // Also reset photo preview if any state was stored or elements manipulated directly
    const photoPreview = modal.querySelector('#add-student-photo-preview');
    const previewContainer = modal.querySelector('#add-student-photo-preview-container');
    const uploadLabel = modal.querySelector('#add-student-photo-upload-label');
    if (photoPreview && previewContainer && uploadLabel) {
        if (photoPreview.src.startsWith('blob:')) URL.revokeObjectURL(photoPreview.src);
        photoPreview.src = '#';
        previewContainer.classList.add('hidden');
        uploadLabel.classList.remove('hidden');
    }
}

function openEditStudentModal(studentId) {
  const currentStudents = Array.isArray(students) ? students : [];
  const student = currentStudents.find(s => s.stu_id === studentId);
  if (!student) {
    showMessage('Student not found.', 'error');
    return;
  }

  const modal = document.getElementById('editStudentModal');
  if(modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex'); // Changed from just remove hidden

    // Populate form fields
    modal.querySelector('#edit-student-id').value = student.stu_id;
    modal.querySelector('#edit-student-name').value = student.Stu_name;
    modal.querySelector('#edit-student-email').value = student.Stu_email;
    modal.querySelector('#edit-student-contact').value = student.Stu_contact;
    modal.querySelector('#edit-student-semester').value = student.semester;
    modal.querySelector('#edit-student-address').value = student.Stu_Address || '';

    const currentPhotoImg = modal.querySelector('#edit-student-current-photo');
    const currentPhotoContainer = modal.querySelector('#edit-current-photo-container');
    const newPhotoPreviewImg = modal.querySelector('#edit-student-new-photo-preview');
    const newPhotoPreviewContainer = modal.querySelector('#edit-new-photo-preview-container');
    const photoInput = modal.querySelector('#edit-student-photo');
    const removeNewPhotoButton = modal.querySelector('#edit-student-remove-new-photo');
    const uploadLabelContainer = modal.querySelector('#edit-student-photo-upload-label-container');

    // Reset photo state
    photoInput.value = ''; // Clear any previously selected file
    newPhotoPreviewImg.src = '#';
    newPhotoPreviewContainer.classList.add('hidden');
    currentPhotoContainer.classList.remove('hidden');
    uploadLabelContainer.classList.remove('hidden'); // Show upload button initially

    if (student.photo_path) {
      currentPhotoImg.src = '/static/' + student.photo_path;
      currentPhotoContainer.classList.remove('hidden');
    } else {
      currentPhotoImg.src = 'https://placehold.co/80x80/E2E8F0/94A3B8?text=No+Photo'; // Placeholder
      // currentPhotoContainer.classList.add('hidden'); // Or keep placeholder visible
    }

    photoInput.onchange = evt => {
        const [file] = photoInput.files;
        if (file) {
            newPhotoPreviewImg.src = URL.createObjectURL(file);
            newPhotoPreviewContainer.classList.remove('hidden');
            currentPhotoContainer.classList.add('hidden'); // Hide current photo display
            uploadLabelContainer.classList.add('hidden'); // Hide upload button when preview shows
        } else { // No file selected or selection cancelled
            if (newPhotoPreviewImg.src.startsWith('blob:')) URL.revokeObjectURL(newPhotoPreviewImg.src);
            newPhotoPreviewImg.src = '#';
            newPhotoPreviewContainer.classList.add('hidden');
            currentPhotoContainer.classList.remove('hidden'); // Show current photo again
            uploadLabelContainer.classList.remove('hidden'); // Show upload button again
        }
    };

    removeNewPhotoButton.onclick = () => {
        photoInput.value = ''; // Clear file input
        if (newPhotoPreviewImg.src.startsWith('blob:')) URL.revokeObjectURL(newPhotoPreviewImg.src); // Clean up blob URL
        newPhotoPreviewImg.src = '#';
        newPhotoPreviewContainer.classList.add('hidden');
        currentPhotoContainer.classList.remove('hidden'); // Show current photo again
        uploadLabelContainer.classList.remove('hidden'); // Show upload button again
    };
  }
}

function closeEditStudentModal() {
  const modal = document.getElementById('editStudentModal');
  if(modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  const form = document.getElementById('editStudentForm');
  if(form) form.reset();

  // Reset photo preview elements specific to edit modal on close
  const currentPhotoContainer = modal.querySelector('#edit-current-photo-container');
  const newPhotoPreviewContainer = modal.querySelector('#edit-new-photo-preview-container');
  const newPhotoPreviewImg = modal.querySelector('#edit-student-new-photo-preview');
  const uploadLabelContainer = modal.querySelector('#edit-student-photo-upload-label-container');
  const photoInput = modal.querySelector('#edit-student-photo');

  if (photoInput) photoInput.value = '';
  if (newPhotoPreviewImg && newPhotoPreviewImg.src.startsWith('blob:')) URL.revokeObjectURL(newPhotoPreviewImg.src);
  if (newPhotoPreviewImg) newPhotoPreviewImg.src = '#';
  if (newPhotoPreviewContainer) newPhotoPreviewContainer.classList.add('hidden');
  if (currentPhotoContainer) currentPhotoContainer.classList.remove('hidden');
  if (uploadLabelContainer) uploadLabelContainer.classList.remove('hidden');
}

function showMessage(message, type = 'success', targetId = null) {
  const area = targetId ? document.getElementById(targetId) : document.getElementById('message-area');
  
  if (!area) {
    // console.warn is good for dev, but alert ensures user sees critical messages if UI element is missing.
    console.warn(`Message area '${targetId || 'message-area'}' not found. Falling back to alert.`);
    alert(`${type.toUpperCase()}: ${message}`); 
    return;
  }

  // Use more specific styling for targeted messages if needed, or keep it consistent.
  // Added mb-0 for targeted messages as they might be within elements with their own bottom margin.
  area.innerHTML = `
    <div class="px-4 py-2 rounded shadow-lg text-white ${type === 'success' ? 'bg-green-600' : 'bg-red-600'} ${targetId ? 'mb-0' : 'mb-2'}">
      ${message}
    </div>`;

  // If targeting a specific div (like addRoutineFormMessage), it might start hidden.
  if (targetId) {
    area.classList.remove('hidden');
  }

  setTimeout(() => {
    area.innerHTML = '';
    if (targetId) {
      area.classList.add('hidden'); // Re-hide the targeted div after message clears
    }
  }, 3000);
}

function displayMessage(elementId, message, isSuccess) {
    const messageElement = document.getElementById(elementId);
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.className = `text-sm mt-2 ${isSuccess ? 'text-green-600' : 'text-red-600'}`;
        messageElement.classList.remove('hidden');
        setTimeout(() => {
            messageElement.classList.add('hidden');
        }, 5000);
    }
}

async function loadAdminProfileData() {
    try {
        const response = await fetch('/Admin/profile-data');
        const result = await response.json();
        if (result.success) {
            document.getElementById('admin-username').value = result.data.username;
            document.getElementById('admin-email').value = result.data.email;
        } else {
            displayMessage('profile-update-message', result.message, false);
        }
    } catch (error) {
        console.error('Error loading admin profile data:', error);
        displayMessage('profile-update-message', 'Could not load profile data.', false);
    }
}



async function loadStudents() {
  try {
    const response = await fetch('/Admin/students');
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data.success) {
      students = Array.isArray(data.students) ? data.students : []; 
      renderStudentTable(students); 
      updateStudentChart('all');    
    } else {
      showMessage('Failed to load students: ' + (data.error || 'Unknown server error'), 'error');
    }
  } catch (error) { 
    console.error('Error in loadStudents:', error); 
    showMessage('Error loading students: ' + error.message, 'error');
  }
}

function validateStudentForm(form, type) {
    const email = form.get('email');
    const contact = form.get('contact');
    const password = form.get('password');
    const errors = {};

    // Clear previous errors
    document.querySelectorAll(`[id^='${type}-'][id$='-error']`).forEach(el => el.textContent = '');

    if (!/\S+@\S+\.\S+/.test(email)) {
        errors.email = 'Invalid email format.';
    }

    if (contact && (!contact.startsWith('98') && !contact.startsWith('97'))) {
        errors.contact = 'Contact must start with 98 or 97.';
    } else if (contact && contact.length !== 10) {
        errors.contact = 'Contact must be 10 digits long.';
    }

    if (password && password.length < 8) {
        errors.password = 'Password must be at least 8 characters long.';
    }

    return errors;
}

document.getElementById('addStudentForm')?.addEventListener('submit', async function(event) {
    event.preventDefault();
    const formData = new FormData(this);
    const validationErrors = validateStudentForm(formData, 'add');

    if (Object.keys(validationErrors).length > 0) {
        for (const [field, message] of Object.entries(validationErrors)) {
            showMessage(message, 'error', `add-${field}-error`);
        }
        return;
    }

    console.log("Adding student with the following data:");
    for (var pair of formData.entries()) {
        console.log(pair[0]+ ': ' + pair[1]); 
    }

    try {
        const response = await fetch('/Admin/add_student', { 
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            showMessage('Student added successfully!', 'success');
            this.reset();
            closeAddStudentModal();
            loadStudents(); // Refresh the student list
        } else {
            let errorMessage = result.error || 'Failed to add student.';
            if (result.errors) {
                errorMessage += ' Details: ' + JSON.stringify(result.errors);
            }
            showMessage(errorMessage, 'error');
        }
    } catch (error) {
        console.error('Error adding student:', error);
        showMessage('Error adding student: ' + error.message, 'error');
    }
});

// Event listener for the Edit Student Form
document.getElementById('editStudentForm')?.addEventListener('submit', async function(event) {
    event.preventDefault();
    const form = event.target;
    const studentId = form.querySelector('#edit-student-id').value;

    if (!studentId) {
        showMessage('Student ID is missing. Cannot update.', 'error');
        return;
    }

    const formData = new FormData(form);
    const validationErrors = validateStudentForm(formData, 'edit');

    if (Object.keys(validationErrors).length > 0) {
        if (validationErrors.email) {
            document.getElementById('edit-email-error').textContent = validationErrors.email;
        }
        if (validationErrors.contact) {
            document.getElementById('edit-contact-error').textContent = validationErrors.contact;
        }
        if (validationErrors.password) {
            document.getElementById('edit-password-error').textContent = validationErrors.password;
        }
        return;
    }

    try {
        const response = await fetch(`/Admin/student/${studentId}/update`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (result.success) {
            showMessage('Student updated successfully!', 'success');
            closeEditStudentModal();
            loadStudents(); // Refresh the student list
        } else {
            showMessage(result.error || 'Failed to update student.', 'error');
        }
    } catch (error) {
        console.error('Error updating student:', error);
        showMessage('Error updating student: ' + error.message, 'error');
    }
});

async function updateStudent(studentId) {
    const form = document.getElementById('editStudentForm');
    if(!form) return;
    const formData = new FormData(form);
    try {
        const response = await fetch(`/Admin/student/${studentId}/update`, { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.success) {
            showMessage('Student updated successfully!', 'success');
            closeEditStudentModal();
            loadStudents(); 
        } else {
            showMessage(data.error || 'Failed to update student', 'error');
        }
    } catch (error) {
        console.error('Error updating student:', error);
        showMessage('Error updating student: ' + error.message, 'error');
    }
}

async function deleteStudent(studentId) {
    if (!confirm('Are you sure you want to delete this student?')) return;
    try {
        const response = await fetch(`/Admin/student/${studentId}/delete`, { method: 'DELETE' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.success) {
            showMessage('Student deleted successfully!', 'success');
            loadStudents(); 
        } else {
            showMessage(data.error || 'Failed to delete student', 'error');
        }
    } catch (error) {
        console.error('Error deleting student:', error);
        showMessage('Error deleting student: ' + error.message, 'error');
    }
}

function updateClock() {
  const clockElement = document.getElementById('clock');
  if (clockElement) {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    clockElement.innerHTML = `<div>${timeString}</div><div class="text-xs">${dateString}</div>`;
  }
}

async function loadDashboardStats() {
  try {
    const response = await fetch('/Admin/dashboard-stats'); // Endpoint is in app.py
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    if (data.success && data.stats) {
      const stats = data.stats;
      const totalStudentsCard = document.getElementById('total-students-card');
      const totalFacultiesCard = document.getElementById('total-faculties-card'); // This will display today's attendance for now
      // const attendancePercentageCard = document.getElementById('attendance-percentage-card'); // If there's an element for this

      if (totalStudentsCard) {
        totalStudentsCard.textContent = stats.total_students !== undefined ? stats.total_students : 'N/A';
      } else {
        console.warn("Element with ID 'total-students-card' not found.");
      }

      if (totalFacultiesCard) {
        // Updating the 'Faculties' card to show 'Today's Attendance'
        // Optionally, we could also change the label "Faculties" to "Today's Attendance" here if desired
        const facultyCardParent = totalFacultiesCard.parentElement;
        if (facultyCardParent) {
            const labelElement = facultyCardParent.querySelector('p.text-gray-600.text-sm');
            if (labelElement && labelElement.textContent.trim() === "Faculties") {
                // labelElement.textContent = "Today's Attendance"; // Uncomment to change label
            }
        }
        totalFacultiesCard.textContent = stats.today_attendance !== undefined ? stats.today_attendance : 'N/A';
      } else {
        console.warn("Element with ID 'total-faculties-card' not found.");
      }

      // if (attendancePercentageCard) { // Example for attendance percentage
      //   attendancePercentageCard.textContent = stats.attendance_percentage !== undefined ? `${stats.attendance_percentage}%` : 'N/A';
      // }

      console.log('Dashboard stats loaded and updated:', stats);
    } else {
      console.error('Failed to load dashboard stats:', data.message || 'No data returned');
      showMessage(data.message || 'Could not load dashboard statistics.', 'error');
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    showMessage('Error fetching dashboard statistics: ' + error.message, 'error');
  }
}

async function loadNotifications() {
  try {
    const response = await fetch('/Admin/notifications');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data.success) {
      renderNotifications(data.notifications, data.unread_count);
    } else {
      console.error('Failed to load notifications:', data.message);
      const notificationList = document.getElementById('notification-list');
      if(notificationList) notificationList.innerHTML = '<p class="p-3 text-sm text-gray-500">Could not load notifications.</p>';
    }
  } catch (error) {
    console.error('Error loading notifications:', error);
    const notificationList = document.getElementById('notification-list');
    if(notificationList) notificationList.innerHTML = '<p class="p-3 text-sm text-gray-500">Error fetching notifications.</p>';
  }
}

function renderNotifications(notifications, unreadCount) {
  const notificationList = document.getElementById('notification-list');
  const notificationBadge = document.getElementById('notification-badge-count'); 

  if (!notificationBadge) {
    console.error('Notification badge element (#notification-badge-count) not found. Cannot update badge.');
  } else {
    if (unreadCount > 0) {
      notificationBadge.textContent = unreadCount;
      notificationBadge.classList.remove('hidden');
    } else {
      notificationBadge.textContent = '0'; 
      notificationBadge.classList.add('hidden');
    }
  }

  if (!notificationList) {
    console.error('Notification list element (#notification-list) not found. Cannot display notifications.');
    return; 
  }

  notificationList.innerHTML = ''; 

  if (notifications && notifications.length > 0) {
    notifications.forEach(notification => {
      const timeAgo = (dateStr) => {
        const date = new Date(dateStr);
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "mo ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m ago";
        return Math.floor(seconds) + "s ago";
      };

      const item = document.createElement('a');
      item.href = "#"; 
      item.className = "block px-4 py-3 hover:bg-gray-100 dark:hover:bg-slate-700 border-b border-gray-200 dark:border-slate-600";
      item.innerHTML = `
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <i class="fas fa-bell text-blue-500"></i>
          </div>
          <div class="ml-3 w-full">
            <p class="text-sm font-medium text-gray-900 dark:text-slate-200">${notification.message}</p>
            <p class="text-xs text-gray-500 dark:text-slate-400">${timeAgo(notification.created_at)}</p>
          </div>
        </div>
      `;
      notificationList.appendChild(item);
    });
  } else {
    notificationList.innerHTML = '<p class="p-4 text-sm text-gray-500 dark:text-slate-400 text-center">No new notifications.</p>';
  }
}

async function clearAllNotifications() {
  if (!confirm('Are you sure you want to clear all notifications?')) {
    return;
  }
  try {
    const response = await fetch('/Admin/notifications/clear_all', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json' 
      }
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to clear notifications. Server error.' }));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data.success) {
      showMessage('All notifications cleared!', 'success');
      renderNotifications([], 0);
    } else {
      showMessage(data.message || 'Failed to clear notifications.', 'error');
    }
  } catch (error) {
    console.error('Error clearing all notifications:', error);
    showMessage('Error clearing notifications: ' + error.message, 'error');
  }
}

// Generic modal opener
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex'); // Using flex for centering
  } else {
    console.error('Modal with ID ' + modalId + ' not found.');
  }
}

// Generic modal closer
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    const form = modal.querySelector('form');
    if (form) form.reset();
  } else {
    console.error('Modal with ID ' + modalId + ' not found.');
  }
}

// Upcoming Classes Modals
function openAddClassModal() { openModal('addClassModal'); }
function closeAddClassModal() { closeModal('addClassModal'); }

async function openEditClassModal(classId) {
  try {
    const response = await fetch(`/Admin/api/classes/${classId}`);
    const data = await response.json();
    if (data.success && data.class_detail) {
      const cls = data.class_detail;
      document.getElementById('edit-class-id').value = cls.id;
      document.getElementById('edit-class-name').value = cls.class_name;
      document.getElementById('edit-class-day-time').value = cls.day_time;
      document.getElementById('edit-class-faculty').value = cls.faculty;
      document.getElementById('edit-class-semester').value = cls.semester;
      openModal('editClassModal');
    } else {
      showMessage('Could not load class details.', 'error');
    }
  } catch (error) {
    console.error('Error fetching class details:', error);
    showMessage('Error fetching class details: ' + error.message, 'error');
  }
}
function closeEditClassModal() { closeModal('editClassModal'); }

// Event listener for Add Class Form submission
document.getElementById('addClassForm')?.addEventListener('submit', async function(event) {
    event.preventDefault();
    const formData = new FormData(this);
    const classData = Object.fromEntries(formData.entries());
    const addClassFormMessage = document.getElementById('addClassFormMessage');

    try {
        const response = await fetch('/Admin/api/classes/add', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(classData)
        });
        const result = await response.json();
        if (result.success) {
            showMessage('Class added successfully!', 'success', 'addClassFormMessage');
            setTimeout(() => {
                closeAddClassModal();
                loadClasses(); // Refresh the list
            }, 1500); // Delay to allow message to be seen
        } else {
            showMessage(result.message || 'Failed to add class.', 'error', 'addClassFormMessage');
        }
    } catch (error) {
        console.error('Error adding class:', error);
        showMessage('Client-side error: ' + error.message, 'error', 'addClassFormMessage');
    }
});

// Event listener for Edit Class Form submission
document.getElementById('editClassForm')?.addEventListener('submit', async function(event) {
    event.preventDefault();
    const classId = this.elements['edit-class-id'].value;
    const formData = new FormData(this);
    const classData = Object.fromEntries(formData.entries());
    // delete classData['edit-class-id']; // The ID is in the URL, not needed in body
    const editClassFormMessage = document.getElementById('editClassFormMessage');

    if (!classId) {
        showMessage('Class ID is missing. Cannot update.', 'error', 'editClassFormMessage');
        return;
    }

    try {
        const response = await fetch(`/Admin/api/classes/update/${classId}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(classData)
        });
        const result = await response.json();
        if (result.success) {
            showMessage('Class updated successfully!', 'success', 'editClassFormMessage');
            setTimeout(() => {
                closeEditClassModal();
                loadClasses(); // Refresh the list
            }, 1500); // Delay for message visibility
        } else {
            showMessage(result.message || 'Failed to update class.', 'error', 'editClassFormMessage');
        }
    } catch (error) {
        console.error('Error updating class:', error);
        showMessage('Client-side error: ' + error.message, 'error', 'editClassFormMessage');
    }
});

// Announcements Modals
function openAddAnnouncementModal() { openModal('addAnnouncementModal'); }
function closeAddAnnouncementModal() { closeModal('addAnnouncementModal'); }

// Variable to store the ID of the announcement being edited
let currentEditAnnouncementId = null;

async function openEditAnnouncementModal(announcementId) {
  currentEditAnnouncementId = announcementId; // Store the ID
  const modal = document.getElementById('editAnnouncementModal');
  const form = document.getElementById('editAnnouncementForm');
  const formMessage = document.getElementById('editAnnouncementFormMessage');

  if (!modal || !form || !formMessage) {
    console.error('Edit announcement modal elements not found: modal, form, or formMessage');
    // Fallback alert if critical elements for the modal UI are missing
    showMessage('Error: Could not properly initialize the edit announcement form components.', 'error'); 
    return;
  }

  formMessage.textContent = '';
  formMessage.classList.add('hidden');
  form.reset(); // Reset form fields

  fetch(`/Admin/api/announcements/${announcementId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(result => {
      if (result.success && result.announcement) {
        const ann = result.announcement;
        if (form.elements['edit-announcement-title']) {
          form.elements['edit-announcement-title'].value = ann.title || '';
        }
        if (form.elements['edit-announcement-content']) {
          form.elements['edit-announcement-content'].value = ann.content || ''; 
        }
        // Ensure the hidden ID field is also populated if it exists in the form, though it's better practice to handle this via a variable like currentEditAnnouncementId
        if (form.elements['id']) { // Assuming your hidden input has name="id"
          form.elements['id'].value = ann.id; 
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex'); // Make sure modal is displayed with flex
      } else {
        console.error('Could not load announcement details:', result.message);
        displayEditAnnouncementFormMessage('Error: Could not load announcement details. ' + (result.message || 'Unknown error.'), 'error');
      }
    })
    .catch(error => {
      console.error('Error fetching announcement for edit:', error);
      displayEditAnnouncementFormMessage('An error occurred while fetching announcement details: ' + error.message, 'error');
    });
}

function displayEditAnnouncementFormMessage(message, type) {
    const formMessageDiv = document.getElementById('editAnnouncementFormMessage');
    if (formMessageDiv) {
        formMessageDiv.textContent = message;
        formMessageDiv.className = `text-sm mt-2 p-2 rounded ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
        formMessageDiv.classList.remove('hidden');
    } else {
        // Fallback if the specific message div isn't found, though openEditAnnouncementModal should prevent this call if it's missing.
        showMessage('Error: Could not display announcement form message. Please contact support.', 'error'); 
    }
}

function closeEditAnnouncementModal() { 
    const modal = document.getElementById('editAnnouncementModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        const form = modal.querySelector('form');
        if (form) form.reset();
        const formMessage = document.getElementById('editAnnouncementFormMessage');
        if (formMessage) {
            formMessage.classList.add('hidden');
            formMessage.textContent = '';
        }
    }
    currentEditAnnouncementId = null; // Reset the ID when modal closes
}

// Event listener for Add Announcement Form
document.getElementById('addAnnouncementForm')?.addEventListener('submit', async function(event) {
    event.preventDefault();
    const formData = new FormData(this);
    const announcementData = {
        title: formData.get('title'),
        content: formData.get('content')
    };
    const addAnnouncementFormMessage = document.getElementById('addAnnouncementFormMessage');

    try {
        const response = await fetch('/Admin/api/announcements/add', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(announcementData)
        });
        const result = await response.json();
        if (result.success) {
            showMessage('Announcement added successfully!', 'success', 'addAnnouncementFormMessage');
            setTimeout(() => {
                closeAddAnnouncementModal();
                loadAnnouncements();
            }, 1500);
        } else {
            showMessage(result.message || 'Failed to add announcement.', 'error', 'addAnnouncementFormMessage');
        }
    } catch (error) {
        console.error('Error adding announcement:', error);
        showMessage('Client-side error: ' + error.message, 'error', 'addAnnouncementFormMessage');
    }
});

// Event listener for Edit Announcement Form
document.getElementById('editAnnouncementForm')?.addEventListener('submit', async function(event) {
    event.preventDefault();
    if (!currentEditAnnouncementId) {
        showMessage('Announcement ID is missing. Cannot update.', 'error', 'editAnnouncementFormMessage');
        return;
    }

    const formData = new FormData(this);
    const announcementData = {
        title: formData.get('title'),
        content: formData.get('content')
    };
    const editAnnouncementFormMessage = document.getElementById('editAnnouncementFormMessage');

    try {
        const response = await fetch(`/Admin/api/announcements/update/${currentEditAnnouncementId}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(announcementData)
        });
        const result = await response.json();
        if (result.success) {
            showMessage('Announcement updated successfully!', 'success', 'editAnnouncementFormMessage');
            setTimeout(() => {
                closeEditAnnouncementModal();
                loadAnnouncements();
            }, 1500);
        } else {
            showMessage(result.message || 'Failed to update announcement.', 'error', 'editAnnouncementFormMessage');
        }
    } catch (error) {
        console.error('Error updating announcement:', error);
        showMessage('Client-side error: ' + error.message, 'error', 'editAnnouncementFormMessage');
    }
});

function formatTime12Hour(timeStr) {
    if (!timeStr) return '';
    const [hour, minute] = timeStr.split(':');
    let h = parseInt(hour, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; // the hour '0' should be '12'
    return `${h.toString().padStart(2, '0')}:${minute} ${ampm}`;
}

// Load Upcoming Classes
async function loadClasses() {
  try {
    const response = await fetch('/Admin/api/classes');
    const data = await response.json();
    classesData = data.classes; // Store for editing

    const classTableBody = document.getElementById('class-table-body');
    const noClassesMessage = document.getElementById('no-classes-message');

    if (!classTableBody || !noClassesMessage) {
      console.error('Class table body or no classes message element not found.');
      return;
    }

    classTableBody.innerHTML = ''; // Clear existing rows

    if (data.success && data.classes && data.classes.length > 0) {
      noClassesMessage.classList.add('hidden');
      classTableBody.classList.remove('hidden'); // Ensure table body is visible
      data.classes.forEach(cls => {
        const row = `
          <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${cls.id}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${cls.class_name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${cls.day_time}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${cls.faculty || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${cls.semester || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
              <button onclick="openEditClassModal(${cls.id})" class="text-blue-600 hover:text-blue-900 mr-2"><i class="fas fa-edit"></i> Edit</button>
              <button onclick="deleteClass(${cls.id})" class="text-red-600 hover:text-red-900"><i class="fas fa-trash-alt"></i> Delete</button>
            </td>
          </tr>`;
        classTableBody.insertAdjacentHTML('beforeend', row);
      });
    } else {
      classTableBody.classList.add('hidden'); // Hide table body
      noClassesMessage.classList.remove('hidden');
      if (!data.success) {
        showMessage('Failed to load classes.', 'error');
      }
    }
  } catch (error) {
    console.error('Error loading classes:', error);
    showMessage('An error occurred while loading classes.', 'error');
    const noClassesMessage = document.getElementById('no-classes-message');
    if (noClassesMessage) {
        noClassesMessage.textContent = 'Error loading classes. Please try again.';
        noClassesMessage.classList.remove('hidden');
    }
    document.getElementById('class-table-body')?.classList.add('hidden');
  }
}

async function deleteClass(classId) {
  if (!confirm('Are you sure you want to delete this class?')) {
    return;
  }
  try {
    const response = await fetch(`/Admin/api/classes/delete/${classId}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (data.success) {
      showMessage('Class deleted successfully.', 'success');
      loadClasses(); // Refresh the class list
    } else {
      showMessage('Failed to delete class.', 'error');
    }
  } catch (error) {
    console.error('Error deleting class:', error);
    showMessage('An error occurred while deleting the class.', 'error');
  }
}

// Load Announcements
async function loadAnnouncements() {
  try {
    const response = await fetch('/Admin/api/announcements');
    const result = await response.json();
    const tableBody = document.getElementById('announcements-table-body');
    const noAnnouncementsMsg = document.getElementById('no-announcements-message');

    if (!tableBody) {
      console.error('Announcements table body not found');
      if (noAnnouncementsMsg) noAnnouncementsMsg.classList.remove('hidden');
      return;
    }
    tableBody.innerHTML = ''; // Clear existing rows

    const tableHead = tableBody.parentNode.querySelector('thead tr');
    if (tableHead) {
      // Ensure the header row is correct and includes 'Content'
      tableHead.innerHTML = `
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Created</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
      `;
    }

    if (result.success && result.announcements.length > 0) {
      if (noAnnouncementsMsg) noAnnouncementsMsg.classList.add('hidden');
      
      result.announcements.forEach(ann => {
        const row = tableBody.insertRow();
        row.className = 'border-b hover:bg-gray-50';
        // Ensure all parts of the announcement are accessed safely with fallbacks
        const announcementId = ann.id || 'N/A';
        const title = ann.title || 'N/A';
        const content = ann.content || 'N/A';
        const dateCreated = ann.date_created || 'N/A';

        row.innerHTML = `
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${announcementId}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${title}</td>
          <td class="px-6 py-4 text-sm text-gray-500 announcement-content-cell">${truncateText(content, 50)}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(dateCreated).toLocaleDateString()}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
            <button onclick="openEditAnnouncementModal(${announcementId})" class="text-indigo-600 hover:text-indigo-900 mr-3"><i class="fas fa-edit mr-1"></i>Edit</button>
            <button onclick="deleteAnnouncement(${announcementId})" class="text-red-600 hover:text-red-900"><i class="fas fa-trash mr-1"></i>Delete</button>
          </td>
        `;
      });
    } else {
      if (noAnnouncementsMsg) {
        noAnnouncementsMsg.classList.remove('hidden');
        noAnnouncementsMsg.textContent = result.announcements.length === 0 ? 'No announcements found.' : (result.message || 'Failed to load announcements.');
      }
    }
  } catch (error) {
    console.error('Error loading announcements:', error);
    const tableBody = document.getElementById('announcements-table-body');
    const noAnnouncementsMsg = document.getElementById('no-announcements-message');
    if (tableBody) tableBody.innerHTML = ''; // Clear in case of error after some rows
    if (noAnnouncementsMsg) {
      noAnnouncementsMsg.classList.remove('hidden');
      noAnnouncementsMsg.textContent = 'Error loading announcements. Please try again.';
    }
  }
}

function truncateText(text, maxLength) {
  if (text === null || typeof text === 'undefined') {
    return ''; // Handle null or undefined gracefully
  }
  const safeText = String(text); // Ensure text is a string
  if (safeText.length <= maxLength) {
    return safeText;
  }
  return safeText.substr(0, maxLength) + '...';
}

async function deleteAnnouncement(announcementId) {
  if (!confirm('Are you sure you want to delete this announcement?')) {
    return;
  }
  try {
    const response = await fetch(`/Admin/api/announcements/delete/${announcementId}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (data.success) {
      showMessage('Announcement deleted successfully.', 'success');
      loadAnnouncements(); // Refresh the announcement list
    } else {
      showMessage('Failed to delete announcement.', 'error');
    }
  } catch (error) {
    console.error('Error deleting announcement:', error);
    showMessage('An error occurred while deleting the announcement.', 'error');
  }
}

// --- Class Routine Management --- //
let currentEditingRoutineId = null;
let selectedRoutineSemester = null;

function setupRoutineSemesterFilter() {
    const semesterFilter = document.getElementById('routine-semester-filter');
    const addFormContainer = document.getElementById('add-routine-form-container');
    const routineDisplayArea = document.getElementById('routine-display-area');
    const selectSemesterPrompt = document.getElementById('select-semester-prompt');
    const routineTableBody = document.getElementById('class-routine-table-body');

    if (semesterFilter) {
        // Remove any previous event listeners by cloning the node
        const newSemesterFilter = semesterFilter.cloneNode(true);
        semesterFilter.parentNode.replaceChild(newSemesterFilter, semesterFilter);
        newSemesterFilter.addEventListener('change', function() {
            const newSemesterValue = this.value;
            selectedRoutineSemester = newSemesterValue; 
            const semesterSpan = document.getElementById('selected-semester-span');
            // Instantly clear table and show loading spinner
            if (routineTableBody) routineTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Loading routines...</td></tr>';
            if (newSemesterValue) {
                if (addFormContainer) addFormContainer.classList.remove('hidden');
                if (routineDisplayArea) routineDisplayArea.classList.remove('hidden');
                if (selectSemesterPrompt) selectSemesterPrompt.classList.add('hidden');
                if (semesterSpan) semesterSpan.textContent = newSemesterValue;
                loadClassRoutines(newSemesterValue);
            } else {
                if (addFormContainer) addFormContainer.classList.add('hidden');
                if (routineDisplayArea) routineDisplayArea.classList.add('hidden');
                if (selectSemesterPrompt) selectSemesterPrompt.classList.remove('hidden');
                if (semesterSpan) semesterSpan.textContent = '';
                if (routineTableBody) routineTableBody.innerHTML = '';
                loadClassRoutines(null);
            }
        });
    }
}

async function loadClassRoutines(semester) {
    if (!semester) {
      console.warn("[loadClassRoutines] Called with no semester. selectedRoutineSemester is:", selectedRoutineSemester);
      const tableBody = document.getElementById('class-routine-table-body');
      const noRoutineMsg = document.getElementById('no-class-routine-message');
      if(tableBody) tableBody.innerHTML = ''; // Clear table
      if(noRoutineMsg) {
        noRoutineMsg.textContent = 'Please select a semester to view routines.';
        noRoutineMsg.classList.remove('hidden');
      }
      // Ensure form/display area are hidden if no semester is truly selected
      document.getElementById('add-routine-form-container')?.classList.add('hidden');
      document.getElementById('routine-display-area')?.classList.add('hidden');
      document.getElementById('select-semester-prompt')?.classList.remove('hidden');
      return;
    }
    console.log(`[loadClassRoutines] Loading routines for semester: ${semester}. Global selectedRoutineSemester: ${selectedRoutineSemester}`);
    const tableBody = document.getElementById('class-routine-table-body');
    const noRoutineMsg = document.getElementById('no-class-routine-message');

    // Ensure related UI elements exist before proceeding
    if (!tableBody || !noRoutineMsg) {
        console.error('Routine table body or no-routine-message element not found.');
        return;
    }

    // Set loading state
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Loading routines...</td></tr>';
    noRoutineMsg.classList.add('hidden');
    noRoutineMsg.textContent = ''; // Clear previous messages

    try {
        const response = await fetch(`/Admin/api/routines/${semester}`);
        const data = await response.json();
        
        tableBody.innerHTML = ''; // Clear loading message or previous rows

        if (data.success) {
            if (data.routines && data.routines.length > 0) {
                noRoutineMsg.classList.add('hidden'); // Hide message if routines are present
                data.routines.forEach(routine => {
                    const row = tableBody.insertRow();
                    row.className = 'hover:bg-purple-50';
                    // Ensure all parts of the routine are accessed safely with fallbacks
                    const courseId = routine.course_id || 'N/A';
                    const subjectName = routine.subject_name || 'N/A';
                    const dayOfWeek = routine.day_of_week || 'N/A';
                    const courseTime = routine.course_time || 'N/A'; // Already formatted as HH:MM by backend

                    row.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${courseId}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${subjectName}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${dayOfWeek}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${courseTime}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button onclick="openEditRoutineModal(${routine.id}, '${routine.semester || selectedRoutineSemester}', '${courseId}', '${subjectName}', '${dayOfWeek}', '${courseTime}')" class="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-1 px-3 rounded-md text-xs mr-2"><i class="fas fa-edit mr-1"></i>Edit</button>
                            <button onclick="deleteRoutineEntry(${routine.id})" class="bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-md text-xs"><i class="fas fa-trash mr-1"></i>Delete</button>
                        </td>
                    `;
                });
            } else { // Success, but no routines
                noRoutineMsg.textContent = 'No routine entries found for this semester. You can add new ones using the form above.';
                noRoutineMsg.classList.remove('hidden');
            }
        } else { // API call was not successful (data.success is false)
            noRoutineMsg.textContent = data.message || 'Failed to load routines for this semester. Please try again or check server logs.';
            noRoutineMsg.classList.remove('hidden');
            console.error('Failed to load routines:', data.message);
        }
    } catch (error) { // Network error or JSON parsing error
        console.error('Error fetching or processing class routines:', error);
        tableBody.innerHTML = ''; // Clear any partial content or loading message
        noRoutineMsg.textContent = 'An error occurred while loading routines. Please check your connection and try again.';
        noRoutineMsg.classList.remove('hidden');
    }
}

document.getElementById('addRoutineForm')?.addEventListener('submit', async function(event) {
    event.preventDefault();
    const addRoutineFormMessage = document.getElementById('addRoutineFormMessage');

    console.log('[addRoutineForm Submit] Current selectedRoutineSemester:', selectedRoutineSemester); // Log before check

    if (!selectedRoutineSemester) {
        showMessage('Please select a semester first to add a routine.', 'error', 'addRoutineFormMessage');
        console.warn('[addRoutineForm Submit] Submission blocked: selectedRoutineSemester is falsy.');
        return;
    }
  const formData = new FormData(this);
  const routineData = Object.fromEntries(formData.entries());
  routineData.semester = selectedRoutineSemester; // Ensure semester is part of the payload

  try {
      const response = await fetch('/Admin/api/routines/add', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(routineData)
      });
      const result = await response.json();

      if (result.success) {
          showMessage('Routine entry added successfully!', 'success', 'addRoutineFormMessage');
          this.reset(); // Reset the add form
          loadClassRoutines(selectedRoutineSemester); // Refresh the table
      } else {
          showMessage(result.message || 'Failed to add routine entry. Please check your input and try again.', 'error', 'addRoutineFormMessage');
      }
  } catch (error) {
      console.error('Error adding routine entry:', error);
      showMessage('Client-side error: ' + error.message, 'error', 'addRoutineFormMessage');
  }
});

function openEditRoutineModal(id, semester, courseId, subjectName, dayOfWeek, courseTime) {
    currentEditingRoutineId = id;
    const modal = document.getElementById('editRoutineModal');
    const form = document.getElementById('editRoutineForm');
    const formMessage = document.getElementById('editRoutineFormMessage');

    if (!modal || !form || !formMessage) {
        console.error('Edit routine modal elements not found.');
        // Potentially show a general error message if critical modal elements are missing
        showMessage('Critical error: Edit routine modal components are missing. Please contact support.', 'error');
        return;
    }
    formMessage.classList.add('hidden'); // Hide previous messages
    formMessage.textContent = '';

    form.elements['id'].value = id;
    form.elements['original_semester'].value = semester; 
    form.elements['semester'].value = semester;
    form.elements['course_id'].value = courseId;
    form.elements['subject_name'].value = subjectName;
    form.elements['day_of_week'].value = dayOfWeek;
    // HTML time input expects HH:MM or HH:MM:SS. Server sends HH:MM:SS for TIME type, or HH:MM from previous formatting.
    if (courseTime && courseTime.includes(':')) {
        // If it has seconds (HH:MM:SS), substring to HH:MM for compatibility with some browsers if needed, 
        // but modern browsers usually handle HH:MM:SS for <input type="time">
        // For safety, let's stick to HH:MM if that's what UI generally shows or if type=time has issues with seconds consistently.
        // If your <input type="time"> supports seconds, you can use courseTime directly.
        // form.elements['course_time'].value = courseTime.length > 5 ? courseTime.substring(0,5) : courseTime;
        form.elements['course_time'].value = courseTime; // Assuming type=time handles HH:MM:SS
    } else {
        form.elements['course_time'].value = ''; // Clear if format is unexpected
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeEditRoutineModal() {
    const modal = document.getElementById('editRoutineModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    const form = document.getElementById('editRoutineForm');
    if(form) form.reset();
    const formMessage = document.getElementById('editRoutineFormMessage');
    if (formMessage) {
        formMessage.classList.add('hidden');
        formMessage.textContent = '';
    }
    currentEditingRoutineId = null;
}

document.getElementById('editRoutineForm')?.addEventListener('submit', async function(event) {
    event.preventDefault();
    const formData = new FormData(this);
    const routineData = Object.fromEntries(formData.entries());
    const routineId = routineData.id; // This is currentEditingRoutineId, also from hidden form field
    const originalSemesterOnForm = this.elements['original_semester'].value;

    try {
        const response = await fetch(`/Admin/api/routines/update/${routineId}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(routineData) 
        });
        const result = await response.json();
        if (result.success) {
            showMessage('Routine entry updated successfully!', 'success', 'editRoutineFormMessage');
            // Wait a bit for message to be seen then close and reload
            setTimeout(() => {
                closeEditRoutineModal();
                // Determine which semester list to refresh
                const currentSelectedSemesterInFilter = document.getElementById('routine-semester-filter').value;
                if (routineData.semester === originalSemesterOnForm) {
                    loadClassRoutines(originalSemesterOnForm); // Reload the original semester's routines
                } else {
                    // If the semester was changed AND the main filter is still on the old semester,
                    // we might want to switch the main filter to the new semester or just reload the currently viewed list.
                    // For simplicity now, if semester in form changed, we reload based on main filter IF it matches new semester,
                    // otherwise, we stick to reloading the main filter's selection.
                    if(currentSelectedSemesterInFilter == routineData.semester){
                        loadClassRoutines(routineData.semester);
                    } else {
                        // If user edited an item from Sem A, changed it to Sem B, but is still viewing Sem A on main page,
                        // Sem A needs a refresh. If they were viewing Sem B, Sem B also needs a refresh.
                        // The simplest is to refresh what is currently selected by the main filter.
                        loadClassRoutines(currentSelectedSemesterInFilter);
                        // And if the edited item moved to another semester, that one won't show unless filter changes.
                        // This UX might need refinement based on desired behavior.
                    }
                    // A more direct approach could be: After edit, always set main filter to edited item's new semester and load it.
                    // document.getElementById('routine-semester-filter').value = routineData.semester;
                    // selectedRoutineSemester = routineData.semester;
                    // loadClassRoutines(selectedRoutineSemester);
                }
            }, 1500);
        } else {
            showMessage(result.message || 'Failed to update routine entry.', 'error', 'editRoutineFormMessage');
        }
    } catch (error) {
        console.error('Error updating routine entry:', error);
        showMessage('Client-side error updating: ' + error.message, 'error', 'editRoutineFormMessage');
    }
});

async function deleteRoutineEntry(routineId) {
    if (!confirm('Are you sure you want to delete this routine entry?')) return;

    try {
        const response = await fetch(`/Admin/api/routines/delete/${routineId}`, {method: 'DELETE'});
        const result = await response.json();
        if (result.success) {
            showMessage('Routine entry deleted successfully!', 'success', 'addRoutineFormMessage');
            if (selectedRoutineSemester) {
                loadClassRoutines(selectedRoutineSemester); // Refresh the current semester's list
            }
        } else {
            showMessage(result.message || 'Failed to delete routine entry.', 'error', 'addRoutineFormMessage');
        }
    } catch (error) {
        console.error('Error deleting routine entry:', error);
        showMessage('Client-side error deleting: ' + error.message, 'error', 'addRoutineFormMessage');
    }
}

// Final check on DOMContentLoaded to ensure all setups are called
// ... (DOMContentLoaded should already call setupRoutineSemesterFilter)
// Admin Profile Specific Functions REMOVED

// Ensure this runs after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Initialize based on URL path
  const pathSegments = window.location.pathname.split('/'); // e.g., ['', 'Admin', 'dashboard', 'manage-student']
  let initialSection = 'dashboard'; // Default section

  // Check if the path starts with /Admin/dashboard/ and has a section name
  if (pathSegments.length > 3 && pathSegments[1] === 'Admin' && pathSegments[2] === 'dashboard' && pathSegments[3]) {
    initialSection = pathSegments[3];
  } else if (pathSegments.length === 3 && pathSegments[1] === 'Admin' && pathSegments[2] === 'dashboard') {
    // This handles the case where the URL is exactly /Admin/dashboard (or /Admin/dashboard/)
    initialSection = 'dashboard';
  }
  // Add further checks if there are other base URLs like /Admin/profile etc.
  
  const firstLink = document.querySelector(`.sidebar-link[onclick*="showSection('${initialSection}'"]`);

    // --- Attendance Snapshot Logic ---
    function updateAttendanceSnapshot() {
        const tableBody = document.getElementById('attendance-snapshot-table-body');
        if (!tableBody) {
            console.log("Attendance snapshot table not found. Skipping update.");
            return;
        }
        
        fetch('/Admin/reports/today_attendance_summary')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.summary) {
                    tableBody.innerHTML = ''; // Clear existing rows
                    
                    const semesters = Object.keys(data.summary).filter(k => k !== 'all').sort((a, b) => a - b);
                    
                    semesters.forEach(semester => {
                        const stats = data.summary[semester];
                        const row = `
                            <tr class="border-b">
                                <td class="py-3 px-4 font-medium">Semester ${semester}</td>
                                <td class="py-3 px-4 text-center text-green-600 font-bold">${stats.present}</td>
                                <td class="py-3 px-4 text-center text-red-600 font-bold">${stats.absent}</td>
                                <td class="py-3 px-4 text-center text-blue-600 font-bold">${stats.total}</td>
                            </tr>
                        `;
                        tableBody.innerHTML += row;
                    });

                    // Add the 'Overall' total row at the end
                    const overallStats = data.summary['all'];
                    if (overallStats) {
                        const totalRow = `
                            <tr class="bg-gray-50 font-bold border-t-2">
                                <td class="py-3 px-4">Overall Total</td>
                                <td class="py-3 px-4 text-center text-green-700">${overallStats.present}</td>
                                <td class="py-3 px-4 text-center text-red-700">${overallStats.absent}</td>
                                <td class="py-3 px-4 text-center text-blue-700">${overallStats.total}</td>
                            </tr>
                        `;
                        tableBody.innerHTML += totalRow;
                    }

                } else {
                    tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">Error loading data.</td></tr>';
                }
            })
            .catch(error => {
                console.error('Error fetching attendance snapshot:', error);
                tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">Error loading data.</td></tr>';
            });
    }

    // Initial call to load the snapshot data when the section is shown or page loads
    if (document.getElementById('attendance-snapshot-table-body')) {
        updateAttendanceSnapshot();
    }
    // --- End of Attendance Snapshot Logic ---

    // Initial data loads for dashboard elements
    loadDashboardStats(); // For other stats like total students, classes etc.
    updateClock();
    setInterval(updateClock, 1000);
    loadNotifications(); 

// Attach change event to semester filter dropdown once DOM is ready
const semFilter = document.getElementById('manage-student-semester-filter');
if (semFilter) {
    semFilter.addEventListener('change', (e) => {
      const selected = e.target.value || 'all';
      filterStudentsBySemester(selected);
    });
  }

  // Handle admin profile update
  document.getElementById('admin-profile-form')?.addEventListener('submit', async function(e) {
      e.preventDefault();
      const formData = new FormData(this);
      const data = Object.fromEntries(formData.entries());

      try {
          const response = await fetch('/Admin/update-profile', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify(data)
          });
          const result = await response.json();
          displayMessage('profile-update-message', result.message, result.success);
      } catch (error) {
          console.error('Error:', error);
          displayMessage('profile-update-message', 'An error occurred while updating the profile.', false);
      }
  });

  // Handle admin password change
  document.getElementById('admin-password-form')?.addEventListener('submit', async function(e) {
      e.preventDefault();
      const formData = new FormData(this);
      const data = Object.fromEntries(formData.entries());

      if (data.new_password !== data.confirm_new_password) {
          displayMessage('password-change-message', 'New passwords do not match.', false);
          return;
      }

      try {
          const response = await fetch('/Admin/change-password', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify(data)
          });
          const result = await response.json();
          displayMessage('password-change-message', result.message, result.success);
          if (result.success) {
              this.reset();
          }
      } catch (error) {
          console.error('Error:', error);
          displayMessage('password-change-message', 'An error occurred while changing the password.', false);
      }
  });

  // --- Camera and Photo Handling for Add Student Modal ---
  const openCameraBtn = document.getElementById('open-camera-btn');
  const closeCameraBtn = document.getElementById('close-camera-btn');
  const cameraStreamEl = document.getElementById('camera-stream');
  const cameraCanvasEl = document.getElementById('camera-canvas');
  const cameraSnapshotEl = document.getElementById('camera-snapshot');
  const captureBtn = document.getElementById('capture-btn');
  const recaptureBtn = document.getElementById('recapture-btn');
  const usePhotoBtn = document.getElementById('use-photo-btn');
  const inlineCameraContainer = document.getElementById('inline-camera-container');

  const studentPhotoInput = document.getElementById('student-photo');
  const addPhotoPreviewContainer = document.getElementById('add-photo-preview-container');
  const addPhotoPreview = document.getElementById('add-photo-preview');
  const addRemovePhotoBtn = document.getElementById('add-remove-photo-btn');
  const addPhotoButtonsContainer = document.getElementById('add-photo-buttons-container');

  let stream = null;

  // 1. Open Inline Camera and Start Stream
  async function openCamera() {
    if (!inlineCameraContainer) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraStreamEl.srcObject = stream;
      addPhotoButtonsContainer.style.display = 'none';
      inlineCameraContainer.style.display = 'block';
      resetCameraView();
    } catch (err) {
      console.error("Error accessing camera: ", err);
      showMessage('Could not access the camera. Please ensure you have a camera connected and have granted permission.', 'error');
    }
  }

  // 2. Close Inline Camera and Stop Stream
  function closeCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    stream = null;
    inlineCameraContainer.style.display = 'none';
    addPhotoButtonsContainer.style.display = 'flex';
  }

  // 3. Capture Photo
  function capturePhoto() {
    const context = cameraCanvasEl.getContext('2d');
    cameraCanvasEl.width = cameraStreamEl.videoWidth;
    cameraCanvasEl.height = cameraStreamEl.videoHeight;
    context.drawImage(cameraStreamEl, 0, 0, cameraCanvasEl.width, cameraCanvasEl.height);
    
    cameraSnapshotEl.src = cameraCanvasEl.toDataURL('image/jpeg');
    cameraStreamEl.style.display = 'none';
    cameraSnapshotEl.style.display = 'block';

    captureBtn.style.display = 'none';
    recaptureBtn.style.display = 'inline-block';
    usePhotoBtn.style.display = 'inline-block';
  }

  // 4. Recapture Photo
  function recapturePhoto() {
    resetCameraView();
  }

  // 5. Use Captured Photo
  function usePhoto() {
    cameraCanvasEl.toBlob(blob => {
      const file = new File([blob], "camera_photo.jpg", { type: 'image/jpeg' });
      
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      studentPhotoInput.files = dataTransfer.files;

      const event = new Event('change', { bubbles: true });
      studentPhotoInput.dispatchEvent(event);

      closeCamera();
    }, 'image/jpeg');
  }

  // 6. Reset camera view to initial state
  function resetCameraView() {
    cameraStreamEl.style.display = 'block';
    cameraSnapshotEl.style.display = 'none';
    captureBtn.style.display = 'inline-block';
    recaptureBtn.style.display = 'none';
    usePhotoBtn.style.display = 'none';
  }

  // 7. Update Photo Preview for both upload and camera
  function updatePhotoPreview(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        addPhotoPreview.src = e.target.result;
        addPhotoPreviewContainer.style.display = 'block';
        addPhotoButtonsContainer.style.display = 'none';
        inlineCameraContainer.style.display = 'none';
      }
      reader.readAsDataURL(file);
    } else {
      resetPhotoInput();
    }
  }

  // 8. Reset Photo Input and Preview
  function resetPhotoInput() {
    studentPhotoInput.value = '';
    addPhotoPreview.src = '#';
    addPhotoPreviewContainer.style.display = 'none';
    addPhotoButtonsContainer.style.display = 'flex';
    if (stream) {
      closeCamera();
    }
  }

  // Event Listeners
  if(openCameraBtn) openCameraBtn.addEventListener('click', openCamera);
  if(closeCameraBtn) closeCameraBtn.addEventListener('click', closeCamera);
  if(captureBtn) captureBtn.addEventListener('click', capturePhoto);
  if(recaptureBtn) recaptureBtn.addEventListener('click', recapturePhoto);
  if(usePhotoBtn) usePhotoBtn.addEventListener('click', usePhoto);
  if(studentPhotoInput) studentPhotoInput.addEventListener('change', updatePhotoPreview);
  if(addRemovePhotoBtn) addRemovePhotoBtn.addEventListener('click', resetPhotoInput);

  // Extend closeAddStudentModal to also reset the photo input
  const originalCloseAddStudentModal = window.closeAddStudentModal;
  window.closeAddStudentModal = function() {
      if (typeof originalCloseAddStudentModal === 'function') {
          originalCloseAddStudentModal();
      }
      resetPhotoInput();
  };
});